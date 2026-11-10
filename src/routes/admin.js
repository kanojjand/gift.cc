import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { csrf } from 'hono/csrf';
import QRCode from 'qrcode';
import { LIMITS } from '../config.js';
import {
  clientIp,
  createRateLimiter,
  createSession,
  isSessionValid,
  passwordMatches,
  SESSION_MAX_AGE_SECONDS,
} from '../security.js';
import { getTemplate, getTier, TEMPLATES } from '../tiers.js';
import { generateCodes, isValidCode, parseQuantity, SONG_TYPES, songExtension } from '../validation.js';
import { batchPage, dashboardPage, loginPage, printPage, songsPage } from '../views/admin.js';

const COOKIE = 'admin_session';
const COOKIE_PATH = '/admin';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 8;
const LABEL_LENGTH = 80;
const TITLE_LENGTH = 80;
const SONG_OVERHEAD_BYTES = 64 * 1024;
const COMPRESSED_SONG_EXTENSION = 'm4a';
const QR_PNG_WIDTH = 1024;

const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);

function parseSlot(value) {
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= 1 && slot <= LIMITS.songSlots ? slot : null;
}

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

function registerBatches(routes, { repo, storage, now, config }) {
  const urlOf = (code) => `${config.baseUrl}/c/${code}`;

  const songsLoaded = () => TEMPLATES.reduce((sum, template) => sum + repo.listSongs(template.id).length, 0);
  const dashboard = (c, error, status = 200) =>
    c.html(
      dashboardPage({ batches: repo.listBatches(), baseUrl: config.baseUrl, songsLoaded: songsLoaded(), notice: c.req.query('ok'), error: error ?? c.req.query('err') }).value,
      status,
    );

  routes.get('/', (c) => dashboard(c));

  routes.get('/find', (c) => {
    const text = String(c.req.query('q') ?? '').trim().toLowerCase();
    const candidates = text.match(/(?<![a-z0-9])[a-z0-9]{12}(?![a-z0-9])/g) ?? [];
    const card = candidates.filter(isValidCode).map((code) => repo.getCard(code)).find(Boolean);
    if (!card) return c.redirect('/admin?err=not-found', 302);
    return c.redirect(`/admin/batches/${card.batchId}?found=${card.code}#${card.code}`, 302);
  });

  routes.post('/batches', async (c) => {
    const body = await c.req.parseBody();
    const tier = getTier(body.tier);
    const quantity = parseQuantity(body.quantity);
    if (!tier || !quantity) return dashboard(c, 'bad-batch', 400);
    const batchId = repo.createBatch({
      tier: tier.id,
      label: cleanText(body.label, LABEL_LENGTH),
      codes: generateCodes(quantity),
      now: now(),
    });
    return c.redirect(`/admin/batches/${batchId}?ok=batch-created`, 302);
  });

  routes.get('/batches/:id', (c) => {
    const batch = repo.getBatch(Number(c.req.param('id')));
    if (!batch) return c.notFound();
    return c.html(
      batchPage({ batch, cards: repo.listCards(batch.id), urlOf, filter: c.req.query('status'), found: c.req.query('found'), notice: c.req.query('ok') }).value,
    );
  });

  routes.post('/batches/:id/delete', (c) => {
    const id = Number(c.req.param('id'));
    if (!repo.getBatch(id)) return c.notFound();
    if (!repo.deleteUnusedBatch(id)) return c.redirect(`/admin/batches/${id}`, 302);
    return c.redirect('/admin?ok=batch-deleted', 302);
  });

  routes.get('/cards/:code/qr.png', async (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code) || !repo.getCard(code)) return c.notFound();
    const png = await QRCode.toBuffer(urlOf(code), { type: 'png', width: QR_PNG_WIDTH, margin: 2, errorCorrectionLevel: 'M' });
    return c.body(png, 200, { 'content-type': 'image/png', 'content-disposition': `attachment; filename="qr-${code}.png"` });
  });

  routes.get('/batches/:id/print', async (c) => {
    const batch = repo.getBatch(Number(c.req.param('id')));
    if (!batch) return c.notFound();
    const unused = repo.listCards(batch.id).filter((card) => card.status === 'new');
    const items = await Promise.all(
      unused.map(async (card) => ({
        code: card.code,
        svg: await QRCode.toString(urlOf(card.code), { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }),
      })),
    );
    return c.html(printPage({ batch, items }).value);
  });

  routes.get('/batches/:id/codes.csv', (c) => {
    const batch = repo.getBatch(Number(c.req.param('id')));
    if (!batch) return c.notFound();
    const rows = repo.listCards(batch.id).map((card) => `${card.code},${urlOf(card.code)},${card.status}`);
    return c.body(['code,url,status', ...rows].join('\r\n') + '\r\n', 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="batch-${batch.id}.csv"`,
    });
  });

  routes.post('/cards/:code/block', (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) return c.notFound();
    const card = repo.getCard(code);
    if (!card) return c.notFound();
    repo.block(code, now());
    storage.removePhotos(code);
    return c.redirect(`/admin/batches/${card.batchId}?ok=card-blocked`, 302);
  });
}

async function optimizeSong({ storage, compressSong }, file, extension) {
  const compressed = storage.newSongName(COMPRESSED_SONG_EXTENSION);
  const isSmaller = await compressSong(storage.songPath(file), storage.songPath(compressed));
  if (!isSmaller) return { file, mime: SONG_TYPES[extension] };
  storage.removeSong(file);
  return { file: compressed, mime: SONG_TYPES[COMPRESSED_SONG_EXTENSION] };
}

function registerSongs(routes, { repo, storage, compressSong }) {
  const invalid = (c, message) => c.html(songsPage({ repo, storage, error: message, open: c.req.param('templateId') }).value, 400);
  const backToSongs = (c, templateId) => c.redirect(`/admin/songs?ok=song-saved&open=${templateId}#${templateId}`, 302);

  routes.get('/songs', (c) => c.html(songsPage({ repo, storage, notice: c.req.query('ok'), open: c.req.query('open') }).value));

  routes.post(
    '/songs/:templateId/:slot',
    bodyLimit({
      maxSize: LIMITS.songBytes + SONG_OVERHEAD_BYTES,
      onError: (c) => invalid(c, 'Файл слишком большой, максимум 60 МБ'),
    }),
    async (c) => {
      const template = getTemplate(c.req.param('templateId'));
      const slot = parseSlot(c.req.param('slot'));
      if (!template || !slot) return invalid(c, 'Неизвестный шаблон или место для песни');

      const body = await c.req.parseBody();
      const title = cleanText(body.title, TITLE_LENGTH);
      if (!title) return invalid(c, 'Укажите название мелодии');
      const previous = repo.getSongBySlot(template.id, slot);
      const hasFile = body.file instanceof File && body.file.size > 0;
      if (!hasFile) {
        if (!previous) return invalid(c, 'Выберите файл');
        repo.renameSong(previous.id, title);
        return backToSongs(c, template.id);
      }

      const extension = songExtension(body.file.name);
      if (!extension) return invalid(c, 'Подойдут файлы mp3, m4a, aac, ogg или wav');
      const uploaded = storage.saveSong(Buffer.from(await body.file.arrayBuffer()), extension);
      const optimized = await optimizeSong({ storage, compressSong }, uploaded, extension);
      repo.upsertSong({ templateId: template.id, slot, title, ...optimized });
      if (previous) storage.removeSong(previous.file);
      return backToSongs(c, template.id);
    },
  );

  routes.post('/songs/:id/delete', (c) => {
    const song = repo.getSong(Number(c.req.param('id')));
    if (!song) return c.notFound();
    repo.deleteSong(song.id);
    storage.removeSong(song.file);
    return c.redirect(`/admin/songs?ok=song-deleted&open=${song.templateId}#${song.templateId}`, 302);
  });
}

export function adminRoutes(deps) {
  const routes = new Hono();
  registerAuth(routes, deps);
  registerBatches(routes, deps);
  registerSongs(routes, deps);
  return routes;
}
