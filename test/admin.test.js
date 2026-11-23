import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createRepo, openDb } from '../src/db.js';
import { createRateLimiter, rateLimitKey } from '../src/security.js';
import { sweep } from '../src/sweep.js';
import { adminPost, greetingForm, issueCard, JPEG, loginCookie, makeContext, ORIGIN, postForm } from './helpers.js';

/** Мелодия, загруженная до того, как раздел «Музыка» убрали: открытки с ней должны играть дальше. */
function seedSong(repo, storage) {
  const file = 'aaaaaaaaaaaaaaaaaaaaaaaa.mp3';
  writeFileSync(storage.songPath(file), Buffer.alloc(2000, 7));
  repo.upsertSong({ templateId: 'newyear', slot: 1, title: 'Весна', file, mime: 'audio/mpeg' });
  return repo.getSongByFile(file);
}

test('config refuses to start without secrets', () => {
  assert.throws(() => loadConfig({}), /ADMIN_PASSWORD/);
  assert.throws(() => loadConfig({ ADMIN_PASSWORD: 'a', SESSION_SECRET: 'short' }), /SESSION_SECRET/);
});

test('admin pages require login', async (t) => {
  const { app } = makeContext(t);
  const res = await app.request('/admin');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/login');
});

test('wrong password is rejected and repeated attempts are throttled', async (t) => {
  const { app } = makeContext(t);
  const attempt = () =>
    app.request('/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
      body: new URLSearchParams({ password: 'nope' }),
    });
  assert.equal((await attempt()).status, 401);
  for (let i = 0; i < 8; i += 1) await attempt();
  assert.equal((await attempt()).status, 429);
});

test('cross-site admin post is refused', async (t) => {
  const { app } = makeContext(t);
  const cookie = await loginCookie(app);
  const res = await app.request('/admin/batches', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example', cookie },
    body: new URLSearchParams({ templateId: 'bloom', quantity: '1' }),
  });
  assert.equal(res.status, 403);
});

test('old databases keep their cards and unused codes return to the catalog', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flowers-old-'));
  const path = join(dir, 'old.db');
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE batches (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
    CREATE TABLE cards (code TEXT PRIMARY KEY, batch_id INTEGER NOT NULL, template_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', sender TEXT, recipient TEXT, message TEXT, song_id INTEGER, photos TEXT NOT NULL DEFAULT '[]', activated_at INTEGER, expires_at INTEGER, updated_at INTEGER NOT NULL);
    INSERT INTO batches (template_id, created_at) VALUES ('gold', 1), ('tulips', 1);
    INSERT INTO cards (code, batch_id, template_id, updated_at) VALUES ('oldnewcode23', 1, 'gold', 1);
    INSERT INTO cards (code, batch_id, template_id, status, updated_at) VALUES ('oldactvcde23', 2, 'tulips', 'active', 1);`);
  old.close();

  const db = openDb(path);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const repo = createRepo(db);
  assert.equal(repo.getBatch(1).lifetimeDays, 7, 'old batches keep their seven-day term');
  assert.equal(repo.getCard('oldnewcode23').templateId, null);
  assert.equal(repo.getCard('oldactvcde23').status, 'active');
  assert.equal(repo.getCard('oldactvcde23').templateId, 'tulips');
});

test('batch creates the requested number of unique codes', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const res = await adminPost(app, '/admin/batches', cookie, { quantity: '25', label: 'Март' });
  assert.equal(res.status, 302);
  const [batch] = repo.listBatches();
  const cards = repo.listCards(batch.id);
  assert.equal(cards.length, 25);
  assert.equal(new Set(cards.map((c) => c.code)).size, 25);
  assert.ok(cards.every((c) => c.templateId === null && c.status === 'new'));
});

test('batch rejects a bad quantity', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { quantity: '0' })).status, 400);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { quantity: '501' })).status, 400);
  assert.equal(repo.listBatches().length, 0);
});

test('print page contains one QR per code pointing at the public domain', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { quantity: '3' });
  const [batch] = repo.listBatches();
  const body = await (await app.request(`/admin/batches/${batch.id}/print`, { headers: { cookie } })).text();
  assert.equal(body.match(/<svg/g).length, 3);
  assert.equal(body.match(/class="qr-mark"/g).length, 3, 'every printed QR carries the CC Lab mark');
});

test('block takes a card down and removes its content', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  await adminPost(app, `/admin/cards/${code}/block`, cookie, {});
  assert.equal(repo.getCard(code).status, 'blocked');
  assert.equal(repo.getCard(code).message, null);
  assert.equal((await app.request(`/c/${code}`)).status, 410);
});

test('a card keeps playing a template melody uploaded before the music section was removed', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const song = seedSong(repo, storage);
  const code = issueCard(repo);
  assert.match(await (await app.request(`/c/${code}?template=newyear`)).text(), /Весна/);

  const res = await postForm(app, `/c/${code}`, greetingForm({ songId: String(song.id) }));
  assert.equal(res.status, 200);
  assert.match(await (await app.request(`/c/${code}`)).text(), new RegExp(`/media/s/${song.file}`));
});

test('card cannot use a song from another template', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const song = seedSong(repo, storage);
  const code = issueCard(repo, 'tupcde234567');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'birthday', songId: String(song.id) }))).status, 400);
});

test('songs support range requests for iPhone playback', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const song = seedSong(repo, storage);
  const res = await app.request(`/media/s/${song.file}`, { headers: { range: 'bytes=0-99' } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 0-99/2000');
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test('batch links can be exported as CSV', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { quantity: '2' });
  const [batch] = repo.listBatches();
  const res = await app.request(`/admin/batches/${batch.id}/codes.csv`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const lines = (await res.text()).trim().split('\r\n');
  assert.equal(lines[0], 'code,url,status');
  assert.equal(lines.length, 3);
  assert.match(lines[1], new RegExp(`,${ORIGIN}/c/[a-z0-9]{12},new$`));
});

test('dashboard shows the activation and opening funnel', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = issueCard(repo);
  issueCard(repo, 'defghjkmnpqr');
  await postForm(app, `/c/${code}`, greetingForm());
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  await app.request(`/c/${code}/opened`, { method: 'POST' });
  const body = await (await app.request('/admin', { headers: { cookie } })).text();
  assert.match(body, /Активировано<\/small><b>1<\/b><span>50%/);
  assert.match(body, /Открыто получателем<\/small><b>1<\/b><span>100%/);
});

test('card can be found by a pasted code, link or complaint text', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = issueCard(repo);
  for (const q of [code, `${ORIGIN}/c/${code}?activated=1`, `Жалоба на открытку ${code}`]) {
    const res = await app.request(`/admin/find?q=${encodeURIComponent(q)}`, { headers: { cookie } });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `/admin/cards/${code}`);
  }
  const missing = await app.request('/admin/find?q=nothing', { headers: { cookie } });
  assert.equal(missing.headers.get('location'), '/admin?err=not-found');
});

test('a single QR can be downloaded as PNG', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const res = await app.request(`/admin/cards/${issueCard(repo)}/qr.png`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
});

test('batch page filters codes by status', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  const drafts = await (await app.request('/admin/batches/1?status=draft', { headers: { cookie } })).text();
  assert.match(drafts, new RegExp(`<code>${code}</code>`));
  const unused = await (await app.request('/admin/batches/1?status=new', { headers: { cookie } })).text();
  assert.ok(!unused.includes(`<code>${code}</code>`));
});

test('a used batch needs confirmation, a fully unused one is deleted at once', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const used = issueCard(repo);
  await postForm(app, `/c/${used}`, greetingForm());
  assert.equal((await adminPost(app, '/admin/batches/1/delete', cookie, {})).status, 400);
  assert.ok(repo.getBatch(1));

  repo.createBatch({ label: '', codes: ['fghjkmnpqrst'], now: 1 });
  const res = await adminPost(app, '/admin/batches/2/delete', cookie, {});
  assert.equal(res.headers.get('location'), '/admin?ok=batch-deleted');
  assert.equal(repo.getBatch(2), null);
  assert.equal(repo.getCard('fghjkmnpqrst'), null);
});

test('dashboard shows notices only for known keys', async (t) => {
  const { app } = makeContext(t);
  const cookie = await loginCookie(app);
  const known = await (await app.request('/admin?ok=batch-deleted', { headers: { cookie } })).text();
  assert.match(known, /Партия удалена/);
  const unknown = await (await app.request('/admin?ok=%3Cscript%3E', { headers: { cookie } })).text();
  assert.ok(!unknown.includes('class="flash'));
});

test('an empty suffix range is refused instead of crashing', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const song = seedSong(repo, storage);
  const res = await app.request(`/media/s/${song.file}`, { headers: { range: 'bytes=-0' } });
  assert.equal(res.status, 416);
});

test('rate limit treats one IPv6 network as a single client', () => {
  assert.equal(rateLimitKey('2001:db8:1:2:aaaa::1'), rateLimitKey('2001:db8:1:2:bbbb::9'));
  assert.notEqual(rateLimitKey('2001:db8:1:2::1'), rateLimitKey('2001:db8:1:3::1'));
  assert.equal(rateLimitKey('::ffff:10.0.0.1'), '10.0.0.1');
  assert.equal(rateLimitKey('10.0.0.1'), '10.0.0.1');
});

test('a full rate limiter keeps existing counters', () => {
  const allow = createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 2 });
  assert.equal(allow('a', 0), true);
  assert.equal(allow('b', 0), true);
  assert.equal(allow('c', 0), false);
  assert.equal(allow('a', 0), false);
  assert.equal(allow('c', 1000), true);
});

test('sweep removes orphaned photos but keeps photos of live drafts', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const orphanCode = issueCard(repo, 'bcdefghjkmnp');
  const orphan = storage.savePhoto(orphanCode, JPEG);
  const draftCode = issueCard(repo, 'cdefghjkmnpq');
  await postForm(app, `/c/${draftCode}`, greetingForm({}, [JPEG]));
  const [kept] = repo.getCard(draftCode).photos;

  sweep({ repo, storage, now: clock.now });

  assert.equal(existsSync(storage.photoPath(orphanCode, orphan)), false);
  assert.equal(existsSync(storage.photoPath(draftCode, kept)), true);
});

test('an upload larger than five photos allow is refused by its declared size', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await app.request(`/c/${code}`, {
    method: 'POST',
    headers: { 'content-length': String(8 * 1024 * 1024) },
    body: greetingForm(),
  });
  assert.equal(res.status, 413);
});
