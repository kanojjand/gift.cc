import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { dailyCounts, niceAxisMax } from '../src/stats.js';
import { getTemplate } from '../src/tiers.js';
import { adminPost, greetingForm, issueCard, JPEG, loginCookie, makeContext, postForm } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const adminGet = async (app, path, cookie) => (await app.request(path, { headers: { cookie } })).text();

async function activate(app, repo, code, templateId = 'newyear', photos = []) {
  issueCard(repo, code);
  await postForm(app, `/c/${code}`, greetingForm({ templateId }, photos));
  await app.request(`/c/${code}/activate`, { method: 'POST' });
}

test('activations are counted per Almaty day for the last 30 days', () => {
  const now = Date.UTC(2026, 10, 23, 12);
  const lateNightUtc = Date.UTC(2026, 10, 22, 20);
  const days = dailyCounts([now, now - DAY, now - DAY, lateNightUtc, now - 40 * DAY], now, 30);
  assert.equal(days.length, 30);
  assert.equal(days.at(-1).label, '23.11');
  assert.equal(days.at(-1).count, 2, 'late evening in UTC is already the next day in Almaty');
  assert.equal(days.at(-2).count, 2);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 4, 'activations older than 30 days are left out');
});

test('the chart axis ends on a round number', () => {
  assert.deepEqual([0, 1, 3, 7, 12, 100].map(niceAxisMax), [1, 1, 5, 10, 20, 100]);
});

test('the stats page shows codes by status, daily activations and favourite templates', async (t) => {
  const { app, repo } = makeContext(t);
  await activate(app, repo, 'abcdefghjkmn', 'love');
  await activate(app, repo, 'bcdefghjkmnp', 'love');
  issueCard(repo, 'cdefghjkmnpq');
  const cookie = await loginCookie(app);

  const page = await adminGet(app, '/admin/stats', cookie);
  assert.match(page, /href="\/admin\/stats" aria-current="page"/);
  assert.match(page, /<span>Активен<\/span><b>2<\/b>/);
  assert.match(page, /<span>Свободен<\/span><b>1<\/b>/);
  assert.match(page, /За 30 дней: 2/);
  assert.match(page, new RegExp(`<span class="hbar-name">${getTemplate('love').name}</span>`));
});

test('an empty stats page says there is nothing to show yet', async (t) => {
  const { app } = makeContext(t);
  const page = await adminGet(app, '/admin/stats', await loginCookie(app));
  assert.match(page, /Активаций за 30 дней пока нет/);
  assert.match(page, /Шаблоны ещё не выбирали/);
});

test('delete all removes every batch, card and photo only after typing the word', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const cookie = await loginCookie(app);
  await activate(app, repo, 'abcdefghjkmn', 'newyear', [JPEG]);
  const [photo] = repo.getCard('abcdefghjkmn').photos;
  repo.createBatch({ label: 'Роза', codes: ['bcdefghjkmnp', 'cdefghjkmnpq'], now: 1 });

  const page = await adminGet(app, '/admin/delete-all', cookie);
  assert.match(page, /Партий<\/span><b>2</);
  assert.match(page, /Активных открыток<\/span><b>1</);
  assert.match(page, /Свободных кодов<\/span><b>2</);

  assert.equal((await adminPost(app, '/admin/delete-all', cookie, {})).status, 400);
  assert.equal((await adminPost(app, '/admin/delete-all', cookie, { confirm: 'да' })).status, 400);
  assert.equal(repo.listBatches().length, 2, 'nothing is deleted without the word');

  const res = await adminPost(app, '/admin/delete-all', cookie, { confirm: ' Удалить ' });
  assert.equal(res.headers.get('location'), '/admin?ok=all-deleted');
  assert.equal(repo.listBatches().length, 0);
  assert.equal(repo.getCard('abcdefghjkmn'), null);
  assert.equal(existsSync(storage.photoPath('abcdefghjkmn', photo)), false);
  assert.equal((await app.request('/c/abcdefghjkmn')).status, 404);
  assert.match(await adminGet(app, '/admin?ok=all-deleted', cookie), /Все партии удалены/);
});

test('the delete all button appears only when there are batches', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.doesNotMatch(await adminGet(app, '/admin', cookie), /href="\/admin\/delete-all"/);
  const empty = await app.request('/admin/delete-all', { headers: { cookie } });
  assert.equal(empty.headers.get('location'), '/admin');

  issueCard(repo);
  assert.match(await adminGet(app, '/admin', cookie), /href="\/admin\/delete-all"/);
});

test('the music section is gone from the admin', async (t) => {
  const { app } = makeContext(t);
  const cookie = await loginCookie(app);
  const dashboard = await adminGet(app, '/admin', cookie);
  assert.doesNotMatch(dashboard, /\/admin\/songs/);
  assert.doesNotMatch(dashboard, /Музыка:/);
  assert.equal((await app.request('/admin/songs', { headers: { cookie } })).status, 404);
});

test('a batch is created without choosing a code type', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.doesNotMatch(await adminGet(app, '/admin', cookie), /name="tier"/);
  const res = await adminPost(app, '/admin/batches', cookie, { quantity: '2', lifetime: '7' });
  assert.equal(res.status, 302);
  assert.equal(repo.listCards(1).length, 2);
});
