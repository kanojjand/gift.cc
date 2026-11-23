import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { sweep } from '../src/sweep.js';
import { adminPost, greetingForm, issueCard, JPEG, loginCookie, makeContext, postForm } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;

async function activeCard(app, repo, code = 'abcdefghjkmn', photos = []) {
  issueCard(repo, code);
  await postForm(app, `/c/${code}`, greetingForm({}, photos));
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  return code;
}

const adminGet = async (app, path, cookie) => (await app.request(path, { headers: { cookie } })).text();

test('a batch with live cards is deleted only after typing its number, together with photos', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo, 'abcdefghjkmn', [JPEG]);
  const [photo] = repo.getCard(code).photos;

  const page = await adminGet(app, '/admin/batches/1/delete', cookie);
  assert.match(page, /Активных открыток[^<]*<\/span><b>1</);

  assert.equal((await adminPost(app, '/admin/batches/1/delete', cookie, {})).status, 400);
  assert.equal((await adminPost(app, '/admin/batches/1/delete', cookie, { confirm: '2' })).status, 400);
  assert.ok(repo.getBatch(1), 'nothing is deleted without the right number');

  const res = await adminPost(app, '/admin/batches/1/delete', cookie, { confirm: '1' });
  assert.equal(res.headers.get('location'), '/admin?ok=batch-deleted');
  assert.equal(repo.getBatch(1), null);
  assert.equal(repo.getCard(code), null);
  assert.equal(existsSync(storage.photoPath(code, photo)), false);
  assert.equal((await app.request(`/c/${code}`)).status, 404);
});

test('cards of a forever batch never expire and say so after activation', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { quantity: '1', lifetime: 'forever' });
  const [{ code }] = repo.listCards(1);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.match(await (await app.request(`/c/${code}`)).text(), /будет храниться всегда/);
  await app.request(`/c/${code}/activate`, { method: 'POST' });

  assert.equal(repo.getCard(code).expiresAt, null);
  assert.match(await (await app.request(`/c/${code}?activated=1`)).text(), /сохранена навсегда/);
  clock.now += 3 * YEAR;
  sweep({ repo, storage, now: clock.now });
  assert.equal(repo.getCard(code).status, 'active');
  assert.match(await (await app.request(`/c/${code}`)).text(), /Айгерим/);
});

test('batch lifetime sets the term of new activations and refuses unknown values', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { quantity: '1', lifetime: '12' })).status, 400);
  await adminPost(app, '/admin/batches', cookie, { quantity: '1', lifetime: '30' });
  const [{ code }] = repo.listCards(1);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.match(await (await app.request(`/c/${code}`)).text(), /будет доступна 30 дней/);
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  assert.equal(repo.getCard(code).expiresAt, clock.now + 30 * DAY);
});

test('batch settings can extend live cards but never shorten them', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo);
  const activatedAt = clock.now;

  await adminPost(app, '/admin/batches/1/settings', cookie, { label: 'Роза', lifetime: '90', extendActive: '1' });
  assert.equal(repo.getBatch(1).label, 'Роза');
  assert.equal(repo.getBatch(1).lifetimeDays, 90);
  assert.equal(repo.getCard(code).expiresAt, activatedAt + 90 * DAY);

  await adminPost(app, '/admin/batches/1/settings', cookie, { label: 'Роза', lifetime: '7', extendActive: '1' });
  assert.equal(repo.getCard(code).expiresAt, activatedAt + 90 * DAY, 'a shorter batch term leaves live cards alone');

  await adminPost(app, '/admin/batches/1/settings', cookie, { label: 'Роза', lifetime: 'forever', extendActive: '1' });
  assert.equal(repo.getCard(code).expiresAt, null);
  assert.equal(repo.getBatch(1).lifetimeDays, null);
});

test('one card can be extended, kept forever and limited again from its admin page', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo);
  const weekLater = clock.now + 7 * DAY;

  const res = await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'plus-30' });
  assert.equal(res.headers.get('location'), `/admin/cards/${code}?ok=card-term`);
  assert.equal(repo.getCard(code).expiresAt, weekLater + 30 * DAY);

  await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'forever' });
  assert.equal(repo.getCard(code).expiresAt, null);
  assert.match(await adminGet(app, `/admin/cards/${code}`, cookie), /Хранится навсегда/);

  await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'limit-7' });
  assert.equal(repo.getCard(code).expiresAt, clock.now + 7 * DAY);

  const bad = await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'plus-9999' });
  assert.equal(bad.headers.get('location'), `/admin/cards/${code}?err=bad-term`);
});

test('a stale "remove forever" button never shortens a card that has a long term', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo);
  await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'plus-365' });
  const yearAhead = clock.now + 7 * DAY + YEAR;

  const res = await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'limit-7' });
  assert.equal(res.headers.get('location'), `/admin/cards/${code}?err=bad-term`);
  assert.equal(repo.getCard(code).expiresAt, yearAhead);
});

test('the term of a card that is not live cannot be changed', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'forever' });
  assert.equal(repo.getCard(code).status, 'draft');
  assert.equal(repo.getCard(code).expiresAt, null);
});

test('a used code can be freed so its printed QR starts a new card', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo, 'abcdefghjkmn', [JPEG]);
  const [photo] = repo.getCard(code).photos;
  await app.request(`/c/${code}/opened`, { method: 'POST' });

  const res = await adminPost(app, `/admin/cards/${code}/reset`, cookie, {});
  assert.equal(res.headers.get('location'), `/admin/cards/${code}?ok=card-reset`);
  const card = repo.getCard(code);
  assert.equal(card.status, 'new');
  assert.equal(card.message, null);
  assert.equal(card.openCount, 0);
  assert.equal(card.activatedAt, null);
  assert.equal(existsSync(storage.photoPath(code, photo)), false);
  assert.match(await (await app.request(`/c/${code}`)).text(), /class="cat-card"/);
});

test('the admin card page shows the greeting and its whole history', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const code = await activeCard(app, repo);
  clock.now += DAY;
  await app.request(`/c/${code}/opened`, { method: 'POST' });
  clock.now += DAY;
  await app.request(`/c/${code}/opened`, { method: 'POST' });
  const cookie = await loginCookie(app);

  const card = repo.getCard(code);
  assert.equal(card.lastOpenedAt, clock.now);
  assert.equal(card.firstOpenedAt, clock.now - DAY);

  const page = await adminGet(app, `/admin/cards/${code}`, cookie);
  for (const text of ['Айгерим', 'Данияр', 'С праздником!', 'Активен', 'Последнее открытие', 'Освободить код']) {
    assert.ok(page.includes(text), `card page shows ${text}`);
  }
  assert.equal((await app.request('/admin/cards/zzzzzzzzzzzz', { headers: { cookie } })).status, 404);
});

test('the batch page links each code to its admin page and shows forever cards', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = await activeCard(app, repo);
  await adminPost(app, `/admin/cards/${code}/term`, cookie, { term: 'forever' });
  const page = await adminGet(app, '/admin/batches/1', cookie);
  assert.match(page, new RegExp(`href="/admin/cards/${code}"`));
  assert.match(page, /<td>навсегда<\/td>/);
  assert.match(page, /href="\/admin\/batches\/1\/delete"/);
});
