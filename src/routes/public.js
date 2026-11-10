import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { LIFETIME, LIMITS } from '../config.js';
import { clientIp, createRateLimiter } from '../security.js';
import { serveFile } from '../serve-file.js';
import { sweep } from '../sweep.js';
import { getTemplate, getTier, isTemplateAllowed, MAX_PHOTOS_ANY, templatesForTier } from '../tiers.js';
import { isJpeg, isValidCode, isValidPhotoName, isValidSongFile, validateGreeting } from '../validation.js';
import { renderCard } from '../views/card.js';
import { renderCatalog } from '../views/catalog.js';
import { renderForm } from '../views/form.js';
import { goneInfo, landingPage } from '../views/pages.js';

const MINUTE_MS = 60 * 1000;
const FORM_OVERHEAD_BYTES = 64 * 1024;
const DEMO = Object.freeze({
  sender: 'Данияр',
  recipient: 'Айгерим',
  message: 'Пусть этот день будет таким же нежным, как эти цветы, а каждый следующий приносит тебе повод улыбнуться.\n\nС праздником!',
  photoUrls: [1, 2, 3, 4, 5].map((n) => `/static/design/demo/${n}.svg`),
});

const fail = (c, status, error, errors) => c.json({ success: false, error, errors }, status);

function selectSong(repo, template, rawId) {
  if (!rawId) return { ok: true, songId: null };
  const song = repo.getSong(Number(rawId));
  return song && song.templateId === template.id ? { ok: true, songId: song.id } : { ok: false };
}

function collectPhotos(form, card) {
  const { maxPhotos } = getTier(card.tier);
  const keep = form.getAll('keep').filter((name) => card.photos.includes(name));
  const files = form.getAll('photos').filter((file) => file instanceof File && file.size > 0);
  if (keep.length + files.length > maxPhotos) return { error: `Можно добавить не больше ${maxPhotos} фото` };
  if (files.some((file) => file.size > LIMITS.photoBytes)) return { error: 'Фото слишком большое' };
  return { keep, files };
}

async function readJpegs(files) {
  const buffers = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isJpeg(buffer)) return null;
    buffers.push(buffer);
  }
  return buffers;
}

function exceedsTierSize(c, tierId) {
  const declared = Number(c.req.header('content-length'));
  return declared > getTier(tierId).maxPhotos * LIMITS.photoBytes + FORM_OVERHEAD_BYTES;
}

export function publicRoutes({ repo, storage, now, config }) {
  const routes = new Hono();
  const allowRead = createRateLimiter({ windowMs: MINUTE_MS, max: 300 });
  const allowWrite = createRateLimiter({ windowMs: MINUTE_MS, max: 40 });

  const limit = (allow) => async (c, next) => {
    if (!allow(clientIp(c, config.trustProxy), now())) return c.text('Слишком много запросов, попробуйте через минуту', 429);
    return next();
  };

  const freshCard = (code) => {
    if (!isValidCode(code)) return null;
    const card = repo.getCard(code);
    if (card?.status === 'active' && card.expiresAt <= now()) {
      sweep({ repo, storage, now: now() });
      return repo.getCard(code);
    }
    return card;
  };

  const songUrlOf = (card) => {
    const song = card.songId ? repo.getSong(card.songId) : null;
    return song ? `/media/s/${song.file}` : null;
  };

  const showCard = (c, card, mode, extra = {}) =>
    c.html(
      renderCard({
        template: getTemplate(card.templateId),
        sender: card.sender,
        recipient: card.recipient,
        message: card.message,
        photoUrls: card.photos.map((name) => `/media/p/${card.code}/${name}`),
        songUrl: songUrlOf(card),
        mode,
        code: card.code,
        ...extra,
      }).value,
    );

  const showForm = (c, card, template) =>
    c.html(renderForm({ card, template, songs: repo.listSongs(template.id), maxPhotos: getTier(card.tier).maxPhotos }).value);

  routes.get('/', (c) => c.html(landingPage().value));

  routes.get('/demo/:templateId', (c) => {
    const template = getTemplate(c.req.param('templateId'));
    if (!template) return c.notFound();
    const [song] = repo.listSongs(template.id);
    return c.html(
      renderCard({
        template,
        ...DEMO,
        photoUrls: DEMO.photoUrls.slice(0, template.maxPhotos),
        songUrl: song ? `/media/s/${song.file}` : null,
        mode: 'demo',
      }).value,
    );
  });

  routes.get('/c/:code', limit(allowRead), (c) => {
    const card = freshCard(c.req.param('code'));
    if (!card) return c.notFound();
    if (card.status === 'expired' || card.status === 'blocked') return c.html(goneInfo(card.status).value, 410);
    if (card.status === 'active') {
      return showCard(c, card, 'live', { activatedNotice: c.req.query('activated') === '1', expiresAt: card.expiresAt });
    }
    const chosen = getTemplate(c.req.query('template'));
    const wantsCatalog = c.req.query('pick') === '1';
    if (!wantsCatalog && isTemplateAllowed(chosen, card.tier)) return showForm(c, card, chosen);
    if (card.status === 'draft' && !wantsCatalog) {
      return c.req.query('edit') === '1' ? showForm(c, card, getTemplate(card.templateId)) : showCard(c, card, 'draft');
    }
    return c.html(renderCatalog({ card, templates: templatesForTier(card.tier) }).value);
  });

  routes.post(
    '/c/:code',
    limit(allowWrite),
    bodyLimit({
      maxSize: MAX_PHOTOS_ANY * LIMITS.photoBytes + FORM_OVERHEAD_BYTES,
      onError: (c) => fail(c, 413, 'Файлы слишком большие'),
    }),
    async (c) => {
      const card = freshCard(c.req.param('code'));
      if (!card) return c.notFound();
      if (card.status !== 'new' && card.status !== 'draft') return fail(c, 409, 'Открытка уже активирована');
      if (exceedsTierSize(c, card.tier)) return fail(c, 413, 'Файлы слишком большие');

      const form = await c.req.formData();
      const template = getTemplate(form.get('templateId'));
      if (!isTemplateAllowed(template, card.tier)) return fail(c, 400, 'Этот шаблон недоступен для вашего кода');
      const greeting = validateGreeting(Object.fromEntries(form));
      if (!greeting.ok) return fail(c, 400, 'Проверьте поля формы', greeting.errors);
      const song = selectSong(repo, template, form.get('songId'));
      if (!song.ok) return fail(c, 400, 'Такой мелодии нет у этого шаблона');
      const photos = collectPhotos(form, card);
      if (photos.error) return fail(c, 400, photos.error);
      const buffers = await readJpegs(photos.files);
      if (!buffers) return fail(c, 400, 'Не удалось прочитать фото, выберите другое');
      const latestPhotos = repo.getCard(card.code).photos;
      if (!photos.keep.every((name) => latestPhotos.includes(name))) return fail(c, 409, 'Открытку только что изменили');

      const added = buffers.map((buffer) => storage.savePhoto(card.code, buffer));
      const finalPhotos = [...photos.keep, ...added];
      const saved = repo.saveDraft(card.code, { ...greeting.value, templateId: template.id, songId: song.songId, photos: finalPhotos }, now());
      if (!saved) {
        storage.prunePhotos(card.code, repo.getCard(card.code).photos);
        return fail(c, 409, 'Открытка уже активирована');
      }
      storage.prunePhotos(card.code, finalPhotos);
      return c.json({ success: true });
    },
  );

  routes.post('/c/:code/activate', limit(allowWrite), (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) return c.notFound();
    if (!repo.activate(code, now(), LIFETIME.activeMs)) return fail(c, 409, 'Сначала заполните открытку');
    return c.json({ success: true });
  });

  routes.post('/c/:code/opened', limit(allowWrite), (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) return c.notFound();
    repo.recordOpen(code, now());
    return c.body(null, 204);
  });

  routes.get('/media/p/:code/:name', limit(allowRead), (c) => {
    const { code, name } = c.req.param();
    if (!isValidPhotoName(name)) return c.notFound();
    const card = freshCard(code);
    if (!card || !card.photos.includes(name)) return c.notFound();
    return serveFile(c, storage.photoPath(code, name), 'image/jpeg', 'private, max-age=3600');
  });

  routes.get('/media/s/:file', limit(allowRead), (c) => {
    const file = c.req.param('file');
    const song = isValidSongFile(file) ? repo.getSongByFile(file) : null;
    if (!song) return c.notFound();
    return serveFile(c, storage.songPath(file), song.mime, 'public, max-age=86400');
  });

  return routes;
}
