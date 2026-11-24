import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { csrf } from 'hono/csrf';
import { DAY_MS } from '../config.js';
import { DEFAULT_LIFETIME_DAYS, parseLifetime, termExpiry } from '../lifetime.js';
import { qrPng, qrSvg } from '../qr.js';
import { QR_STYLES, qrStyledSvg } from '../qr-styles.js';
import {
  clientIp,
  createRateLimiter,
  createSession,
  isSessionValid,
  passwordMatches,
  SESSION_MAX_AGE_SECONDS,
} from '../security.js';
import { STATS_DAYS } from '../stats.js';
import { generateCodes, isValidCode, parseQuantity } from '../validation.js';
import { batchPage, dashboardPage, loginPage, printPage } from '../views/admin.js';
import { cardPage } from '../views/admin-card.js';
import { DELETE_ALL_WORD, deleteAllPage, deleteBatchPage } from '../views/admin-delete.js';
import { statsPage } from '../views/admin-stats.js';

const COOKIE = 'admin_session';
const COOKIE_PATH = '/admin';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 8;
const LABEL_LENGTH = 80;
const QR_PNG_WIDTH = 1024;

const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);
const publicUrl = (config, code) => `${config.baseUrl}/c/${code}`;

/** Срок из формы новой партии. Старая форма без поля — прежние 7 дней; неизвестное значение — undefined. */
const batchLifetime = (value) => (value === undefined ? DEFAULT_LIFETIME_DAYS : parseLifetime(value));

function registerAuth(routes, { config, now }) {
  const allowLogin = createRateLimiter({ windowMs: LOGIN_WINDOW_MS, max: LOGIN_ATTEMPTS });

  routes.use('*', csrf({ origin: config.origin }));
  routes.use('*', async (c, next) => {
    if (c.req.path === '/admin/login') return next();
    if (isSessionValid(getCookie(c, COOKIE), config.sessionSecret, now())) return next();
    return c.redirect('/admin/login', 302);
  });

  routes.get('/login', (c) => c.html(loginPage().value));
  routes.post('/login', async (c) => {
    if (!allowLogin(clientIp(c, config.trustProxy), now())) {
      return c.html(loginPage('Слишком много попыток, подождите 15 минут').value, 429);
    }
    const body = await c.req.parseBody();
    if (!passwordMatches(body.password, config.adminPassword)) return c.html(loginPage('Неверный пароль').value, 401);
    setCookie(c, COOKIE, createSession(config.sessionSecret, now()), {
      httpOnly: true,
      sameSite: 'Strict',
      secure: config.secureCookies,
      path: COOKIE_PATH,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return c.redirect('/admin', 302);
  });
  routes.post('/logout', (c) => {
    deleteCookie(c, COOKIE, { path: COOKIE_PATH });
    return c.redirect('/admin/login', 302);
  });
}

function registerBatches(routes, { repo, now, config }) {
  const urlOf = (code) => publicUrl(config, code);
  const batchOf = (c) => repo.getBatch(Number(c.req.param('id')));

  const dashboard = (c, error, status = 200) =>
    c.html(dashboardPage({ batches: repo.listBatches(), baseUrl: config.baseUrl, notice: c.req.query('ok'), error: error ?? c.req.query('err') }).value, status);

  routes.get('/', (c) => dashboard(c));

  routes.get('/find', (c) => {
    const text = String(c.req.query('q') ?? '').trim().toLowerCase();
    const candidates = text.match(/(?<![a-z0-9])[a-z0-9]{12}(?![a-z0-9])/g) ?? [];
    const card = candidates.filter(isValidCode).map((code) => repo.getCard(code)).find(Boolean);
    if (!card) return c.redirect('/admin?err=not-found', 302);
    return c.redirect(`/admin/cards/${card.code}`, 302);
  });

  routes.post('/batches', async (c) => {
    const body = await c.req.parseBody();
    const quantity = parseQuantity(body.quantity);
    const lifetimeDays = batchLifetime(body.lifetime);
    if (!quantity || lifetimeDays === undefined) return dashboard(c, 'bad-batch', 400);
    const batchId = repo.createBatch({ label: cleanText(body.label, LABEL_LENGTH), codes: generateCodes(quantity), now: now(), lifetimeDays });
    return c.redirect(`/admin/batches/${batchId}?ok=batch-created`, 302);
  });

  routes.get('/batches/:id', (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    const { status, found, ok, err } = c.req.query();
    return c.html(batchPage({ batch, cards: repo.listCards(batch.id), urlOf, filter: status, found, notice: ok, error: err }).value);
  });

  routes.post('/batches/:id/settings', async (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    const body = await c.req.parseBody();
    const lifetimeDays = parseLifetime(body.lifetime);
    if (lifetimeDays === undefined) return c.redirect(`/admin/batches/${batch.id}?err=bad-lifetime`, 302);
    repo.updateBatch(batch.id, { label: cleanText(body.label, LABEL_LENGTH), lifetimeDays, extendActive: body.extendActive === '1' });
    return c.redirect(`/admin/batches/${batch.id}?ok=batch-saved`, 302);
  });

  routes.get('/batches/:id/print', (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    const unused = repo.listCards(batch.id).filter((card) => card.status === 'new');
    // ?style=dots|rounded|insta|telegram|rose — красивый QR; без него печатается классический
    const style = Object.hasOwn(QR_STYLES, c.req.query('style') ?? '') ? c.req.query('style') : 'classic';
    const draw = (url) => (style === 'classic' ? qrSvg(url) : qrStyledSvg(url, style));
    const items = unused.map((card) => ({ code: card.code, svg: draw(urlOf(card.code)) }));
    return c.html(printPage({ batch, items, style }).value);
  });

  routes.get('/batches/:id/codes.csv', (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    const rows = repo.listCards(batch.id).map((card) => `${card.code},${urlOf(card.code)},${card.status}`);
    return c.body(['code,url,status', ...rows].join('\r\n') + '\r\n', 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="batch-${batch.id}.csv"`,
    });
  });
}

/** Удаление одной партии или всех сразу; фото удалённых открыток стираются с диска. */
function registerDeletion(routes, { repo, storage }) {
  const batchOf = (c) => repo.getBatch(Number(c.req.param('id')));
  const removePhotos = (codes) => codes.forEach((code) => storage.removePhotos(code));

  routes.get('/batches/:id/delete', (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    return c.html(deleteBatchPage({ batch }).value);
  });

  /** Пустую партию удаляет одна кнопка; партию с открытками — только если ввели её номер. */
  routes.post('/batches/:id/delete', async (c) => {
    const batch = batchOf(c);
    if (!batch) return c.notFound();
    const body = await c.req.parseBody();
    const typed = String(body.confirm ?? '').trim();
    const codes = repo.deleteBatch(batch.id, { allowUsed: typed === String(batch.id) });
    if (!codes) {
      const error = typed ? 'Номер партии не совпал, ничего не удалено.' : 'В партии есть заполненные открытки. Введите номер партии, чтобы удалить её.';
      return c.html(deleteBatchPage({ batch, error }).value, 400);
    }
    removePhotos(codes);
    return c.redirect('/admin?ok=batch-deleted', 302);
  });

  routes.get('/delete-all', (c) => {
    const batches = repo.listBatches();
    if (batches.length === 0) return c.redirect('/admin', 302);
    return c.html(deleteAllPage({ batches }).value);
  });

  routes.post('/delete-all', async (c) => {
    const body = await c.req.parseBody();
    const typed = String(body.confirm ?? '').trim().toLowerCase();
    if (typed !== DELETE_ALL_WORD) {
      const error = typed ? 'Слово не совпало, ничего не удалено.' : `Введите слово «${DELETE_ALL_WORD}», чтобы подтвердить.`;
      return c.html(deleteAllPage({ batches: repo.listBatches(), error }).value, 400);
    }
    removePhotos(repo.deleteAllBatches());
    return c.redirect('/admin?ok=all-deleted', 302);
  });
}

/** Один код: его страница, QR, срок хранения, снятие и освобождение. */
function registerCards(routes, { repo, storage, now, config }) {
  const cardOf = (c) => {
    const code = c.req.param('code');
    return isValidCode(code) ? repo.getCard(code) : null;
  };
  const toCardPage = (c, card, query) => c.redirect(`/admin/cards/${card.code}?${query}`, 302);
  const songTitleOf = (card) => (card.songId ? (repo.getSong(card.songId)?.title ?? null) : null);

  routes.get('/cards/:code', (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    const { ok, err } = c.req.query();
    const page = cardPage({ card, batch: repo.getBatch(card.batchId), url: publicUrl(config, card.code), songTitle: songTitleOf(card), notice: ok, error: err });
    return c.html(page.value);
  });

  routes.get('/cards/:code/qr.png', (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    const png = qrPng(publicUrl(config, card.code), { width: QR_PNG_WIDTH });
    return c.body(png, 200, { 'content-type': 'image/png', 'content-disposition': `attachment; filename="qr-${card.code}.png"` });
  });

  routes.get('/cards/:code/qr.svg', (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    const style = Object.hasOwn(QR_STYLES, c.req.query('style') ?? '') ? c.req.query('style') : 'classic';
    const svg = qrStyledSvg(publicUrl(config, card.code), style);
    return c.body(svg, 200, { 'content-type': 'image/svg+xml', 'content-disposition': `attachment; filename="qr-${card.code}-${style}.svg"` });
  });

  routes.post('/cards/:code/term', async (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    const body = await c.req.parseBody();
    const expiresAt = card.status === 'active' ? termExpiry(body.term, card, now()) : undefined;
    if (expiresAt === undefined || !repo.setExpiry(card.code, expiresAt)) return toCardPage(c, card, 'err=bad-term');
    return toCardPage(c, card, 'ok=card-term');
  });

  routes.post('/cards/:code/reset', (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    repo.resetCard(card.code, now());
    storage.removePhotos(card.code);
    return toCardPage(c, card, 'ok=card-reset');
  });

  routes.post('/cards/:code/block', (c) => {
    const card = cardOf(c);
    if (!card) return c.notFound();
    repo.block(card.code, now());
    storage.removePhotos(card.code);
    if (c.req.query('back') === 'card') return toCardPage(c, card, 'ok=card-blocked');
    return c.redirect(`/admin/batches/${card.batchId}?ok=card-blocked`, 302);
  });
}

function registerStats(routes, { repo, now }) {
  routes.get('/stats', (c) => {
    const time = now();
    const stats = repo.dashboardStats(time - STATS_DAYS * DAY_MS);
    return c.html(statsPage({ batches: repo.listBatches(), stats, now: time }).value);
  });
}

export function adminRoutes(deps) {
  const routes = new Hono();
  registerAuth(routes, deps);
  registerBatches(routes, deps);
  registerDeletion(routes, deps);
  registerCards(routes, deps);
  registerStats(routes, deps);
  return routes;
}
