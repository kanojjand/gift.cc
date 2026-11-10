import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createRepo, openDb } from '../src/db.js';
import { createRateLimiter, rateLimitKey } from '../src/security.js';
import { sweep } from '../src/sweep.js';
import { adminPost, greetingForm, issueCard, JPEG, loginCookie, makeContext, ORIGIN, postForm } from './helpers.js';

function songForm(title = 'Весна') {
  const form = new FormData();
  form.append('title', title);
  form.append('file', new File([Buffer.alloc(2000, 7)], 'song.mp3', { type: 'audio/mpeg' }));
  return form;
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
    body: new URLSearchParams({ templateId: 'gold', quantity: '1' }),
  });
  assert.equal(res.status, 403);
});

test('old databases get tiers and unused codes return to the catalog', (t) => {
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
  assert.equal(repo.getBatch(1).tier, 'premium');
  assert.equal(repo.getCard('oldnewcode23').tier, 'premium');
  assert.equal(repo.getCard('oldnewcode23').templateId, null);
  assert.equal(repo.getCard('oldactvcde23').tier, 'basic');
  assert.equal(repo.getCard('oldactvcde23').templateId, 'tulips');
});

test('batch creates the requested number of unique codes for the tier', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const res = await adminPost(app, '/admin/batches', cookie, { tier: 'premium', quantity: '25', label: 'Март' });
  assert.equal(res.status, 302);
  const [batch] = repo.listBatches();
  const cards = repo.listCards(batch.id);
  assert.equal(cards.length, 25);
  assert.equal(new Set(cards.map((c) => c.code)).size, 25);
  assert.ok(cards.every((c) => c.tier === 'premium' && c.templateId === null && c.status === 'new'));
});

test('batch rejects bad quantity and unknown tier', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { tier: 'premium', quantity: '0' })).status, 400);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { tier: 'premium', quantity: '501' })).status, 400);
  assert.equal((await adminPost(app, '/admin/batches', cookie, { tier: 'nope', quantity: '1' })).status, 400);
  assert.equal(repo.listBatches().length, 0);
});

test('print page contains one QR per code pointing at the public domain', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { tier: 'basic', quantity: '3' });
  const [batch] = repo.listBatches();
  const body = await (await app.request(`/admin/batches/${batch.id}/print`, { headers: { cookie } })).text();
  assert.equal(body.match(/<svg/g).length, 3);
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

async function uploadSong(app, cookie, slot, form = songForm()) {
  return app.request(`/admin/songs/envelope/${slot}`, { method: 'POST', headers: { cookie, origin: ORIGIN }, body: form });
}

test('each template holds three song slots and the form offers them', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  assert.equal((await uploadSong(app, cookie, 1)).status, 302);
  assert.equal((await uploadSong(app, cookie, 4)).status, 400);
  const [song] = repo.listSongs('envelope');
  const code = issueCard(repo);
  assert.match(await (await app.request(`/c/${code}?template=envelope`)).text(), /Весна/);

  const res = await postForm(app, `/c/${code}`, greetingForm({ songId: String(song.id) }));
  assert.equal(res.status, 200);
  assert.match(await (await app.request(`/c/${code}`)).text(), new RegExp(`/media/s/${song.file}`));
});

test('card cannot use a song from another template', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await uploadSong(app, cookie, 1);
  const [song] = repo.listSongs('envelope');
  const code = issueCard(repo, 'tulips', 'tupcde234567');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'tulips', songId: String(song.id) }))).status, 400);
});

test('songs support range requests for iPhone playback', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await uploadSong(app, cookie, 1);
  const [song] = repo.listSongs('envelope');
  const res = await app.request(`/media/s/${song.file}`, { headers: { range: 'bytes=0-99' } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 0-99/2000');
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test('rejects a song with an unsupported extension', async (t) => {
  const { app } = makeContext(t);
  const cookie = await loginCookie(app);
  const form = new FormData();
  form.append('title', 'x');
  form.append('file', new File(['x'], 'evil.html'));
  assert.equal((await uploadSong(app, cookie, 1, form)).status, 400);
});

test('uploaded song is replaced by its compressed version', async (t) => {
  const compressSong = async (_input, output) => {
    writeFileSync(output, Buffer.alloc(100, 1));
    return true;
  };
  const { app, repo, config } = makeContext(t, { compressSong });
  const cookie = await loginCookie(app);
  await uploadSong(app, cookie, 1);
  const [song] = repo.listSongs('envelope');
  assert.match(song.file, /\.m4a$/);
  assert.equal(song.mime, 'audio/mp4');
  assert.deepEqual(readdirSync(join(config.dataDir, 'songs')), [song.file]);
  assert.equal((await app.request(`/media/s/${song.file}`)).status, 200);
});

test('song stays as uploaded when compression is unavailable', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await uploadSong(app, cookie, 1);
  const [song] = repo.listSongs('envelope');
  assert.match(song.file, /\.mp3$/);
  assert.equal(song.mime, 'audio/mpeg');
});

test('batch links can be exported as CSV', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await adminPost(app, '/admin/batches', cookie, { tier: 'basic', quantity: '2' });
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
  issueCard(repo, 'envelope', 'defghjkmnpqr');
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
    assert.match(res.headers.get('location'), new RegExp(`/admin/batches/1\\?found=${code}`));
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

test('only a fully unused batch can be deleted', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  const used = issueCard(repo);
  await postForm(app, `/c/${used}`, greetingForm());
  await adminPost(app, '/admin/batches/1/delete', cookie, {});
  assert.ok(repo.getBatch(1));

  repo.createBatch({ tier: 'premium', label: '', codes: ['fghjkmnpqrst'], now: 1 });
  const res = await adminPost(app, '/admin/batches/2/delete', cookie, {});
  assert.equal(res.headers.get('location'), '/admin?ok=batch-deleted');
  assert.equal(repo.getBatch(2), null);
  assert.equal(repo.getCard('fghjkmnpqrst'), null);
});

test('dashboard shows notices only for known keys and warns about templates without music', async (t) => {
  const { app } = makeContext(t);
  const cookie = await loginCookie(app);
  const known = await (await app.request('/admin?ok=batch-deleted', { headers: { cookie } })).text();
  assert.match(known, /Партия удалена/);
  assert.match(known, /Музыка: 0 из 30/);
  const unknown = await (await app.request('/admin?ok=%3Cscript%3E', { headers: { cookie } })).text();
  assert.ok(!unknown.includes('class="flash'));
});

test('an empty suffix range is refused instead of crashing', async (t) => {
  const { app, repo } = makeContext(t);
  const cookie = await loginCookie(app);
  await uploadSong(app, cookie, 1);
  const [song] = repo.listSongs('envelope');
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
  const orphanCode = issueCard(repo, 'envelope', 'bcdefghjkmnp');
  const orphan = storage.savePhoto(orphanCode, JPEG);
  const draftCode = issueCard(repo, 'envelope', 'cdefghjkmnpq');
  await postForm(app, `/c/${draftCode}`, greetingForm({}, [JPEG]));
  const [kept] = repo.getCard(draftCode).photos;

  sweep({ repo, storage, now: clock.now });

  assert.equal(existsSync(storage.photoPath(orphanCode, orphan)), false);
  assert.equal(existsSync(storage.photoPath(draftCode, kept)), true);
});

test('upload larger than the template allows is refused by its declared size', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await app.request(`/c/${code}`, {
    method: 'POST',
    headers: { 'content-length': String(6 * 1024 * 1024) },
    body: greetingForm(),
  });
  assert.equal(res.status, 413);
});
