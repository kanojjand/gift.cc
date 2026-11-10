import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { sweep } from '../src/sweep.js';
import { designProblems, getTemplate } from '../src/tiers.js';
import { greetingForm, issueCard, JPEG, makeContext, postForm } from './helpers.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

const catalogTiles = (body) => (body.match(/class="cat-card"/g) ?? []).length;

test('unused basic code opens a catalog of basic templates', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await app.request(`/c/${code}`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(catalogTiles(body), 5);
  assert.ok(!body.includes('id="greeting-form"'));
  assert.ok(!body.includes('template=gold'));
});

test('premium code opens all ten templates', async (t) => {
  const { app, repo } = makeContext(t);
  const body = await (await app.request(`/c/${issueCard(repo, 'gold', 'premcde23456')}`)).text();
  assert.equal(catalogTiles(body), 10);
  assert.match(body, /template=envelope/);
});

test('choosing a template opens the form for it, the code stays the same', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const body = await (await app.request(`/c/${code}?template=tulips`)).text();
  assert.match(body, /id="greeting-form"/);
  assert.match(body, /data-template="tulips"/);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'tulips' }));
  const card = repo.getCard(code);
  assert.equal(card.templateId, 'tulips');
  assert.equal(card.status, 'draft');
  assert.match(await (await app.request(`/c/${code}`)).text(), /t-tulips/);
});

test('basic code cannot use a premium template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal(catalogTiles(await (await app.request(`/c/${code}?template=gold`)).text()), 5);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'gold' }))).status, 400);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'nope' }))).status, 400);
  assert.equal(repo.getCard(code).status, 'new');
});

test('premium code gives five photos on any template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'gold', 'premcde23456');
  const form = greetingForm({ templateId: 'envelope' }, Array(5).fill(JPEG));
  assert.equal((await postForm(app, `/c/${code}`, form)).status, 200);
  assert.equal(repo.getCard(code).photos.length, 5);
});

test('template can be changed in a draft but not after activation', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.equal(catalogTiles(await (await app.request(`/c/${code}?pick=1`)).text()), 5);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'night' }));
  assert.equal(repo.getCard(code).templateId, 'night');
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  const body = await (await app.request(`/c/${code}?pick=1&template=tulips`)).text();
  assert.equal(catalogTiles(body), 0);
  assert.match(body, /t-night/);
});

test('an abandoned draft returns to the catalog', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'night' }));
  clock.now += 8 * 24 * 60 * 60 * 1000;
  sweep({ repo, storage, now: clock.now });
  assert.equal(repo.getCard(code).templateId, null);
  assert.equal(catalogTiles(await (await app.request(`/c/${code}`)).text()), 5);
});

test('unknown code returns 404', async (t) => {
  const { app } = makeContext(t);
  assert.equal((await app.request('/c/nosuchcode12')).status, 404);
});

test('saved greeting becomes a draft with demo controls', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm())).status, 200);
  const body = await (await app.request(`/c/${code}`)).text();
  assert.equal(repo.getCard(code).status, 'draft');
  assert.match(body, /Айгерим/);
  assert.match(body, /id="activate"/);
  assert.match(body, /id="edit"/);
});

test('draft can be edited until activation', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await postForm(app, `/c/${code}`, greetingForm({ recipient: 'Мама' }));
  assert.equal(repo.getCard(code).recipient, 'Мама');
  assert.match(await (await app.request(`/c/${code}?edit=1`)).text(), /value="Мама"/);
});

test('rejects empty names and an oversized message', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ recipient: '  ' }))).status, 400);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ message: 'я'.repeat(1001) }))).status, 400);
  assert.equal(repo.getCard(code).status, 'new');
});

test('escapes user text in the card', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm({ recipient: '<script>alert(1)</script>' }));
  const body = await (await app.request(`/c/${code}`)).text();
  assert.ok(!body.includes('<script>alert(1)'));
  assert.match(body, /&lt;script&gt;/);
});

test('activation needs a draft, then locks the card for one week', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await app.request(`/c/${code}/activate`, { method: 'POST' })).status, 409);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.equal((await app.request(`/c/${code}/activate`, { method: 'POST' })).status, 200);
  const card = repo.getCard(code);
  assert.equal(card.status, 'active');
  assert.equal(card.expiresAt, clock.now + WEEK);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ recipient: 'Другой' }))).status, 409);
  const body = await (await app.request(`/c/${code}?edit=1`)).text();
  assert.ok(!body.includes('id="activate"'));
  assert.ok(!body.includes('id="greeting-form"'));
});

test('basic template accepts one photo, premium accepts five', async (t) => {
  const { app, repo } = makeContext(t);
  const basic = issueCard(repo, 'envelope', 'bascccde2345');
  const premium = issueCard(repo, 'gold', 'premcde23456');
  assert.equal((await postForm(app, `/c/${basic}`, greetingForm({}, [JPEG, JPEG]))).status, 400);
  assert.equal((await postForm(app, `/c/${basic}`, greetingForm({}, [JPEG]))).status, 200);
  assert.equal((await postForm(app, `/c/${premium}`, greetingForm({}, Array(6).fill(JPEG)))).status, 400);
  assert.equal((await postForm(app, `/c/${premium}`, greetingForm({}, Array(5).fill(JPEG)))).status, 200);
  assert.equal(repo.getCard(premium).photos.length, 5);
});

test('rejects a non-JPEG upload', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await postForm(app, `/c/${code}`, greetingForm({}, [Buffer.from('<svg></svg>')]));
  assert.equal(res.status, 400);
});

test('replacing a photo removes the old file', async (t) => {
  const { app, repo, storage } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm({}, [JPEG]));
  const [oldName] = repo.getCard(code).photos;
  await postForm(app, `/c/${code}`, greetingForm({}, [JPEG]));
  const [newName] = repo.getCard(code).photos;
  assert.notEqual(oldName, newName);
  assert.equal(existsSync(storage.photoPath(code, oldName)), false);
  assert.equal(existsSync(storage.photoPath(code, newName)), true);
});

test('after a week the card and its photos are gone', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm({}, [JPEG]));
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  const [photo] = repo.getCard(code).photos;

  clock.now += WEEK - 1;
  assert.match(await (await app.request(`/c/${code}`)).text(), /Айгерим/);
  assert.equal((await app.request(`/media/p/${code}/${photo}`)).status, 200);

  clock.now += 1;
  const res = await app.request(`/c/${code}`);
  assert.equal(res.status, 410);
  assert.ok(!(await res.text()).includes('Айгерим'));
  assert.equal((await app.request(`/media/p/${code}/${photo}`)).status, 404);
  assert.equal(existsSync(storage.photoPath(code, photo)), false);
  assert.equal(repo.getCard(code).recipient, null);
});

test('sweep expires due cards and frees abandoned drafts', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const active = issueCard(repo, 'envelope', 'actvecde2345');
  const draft = issueCard(repo, 'envelope', 'draftcde2345');
  await postForm(app, `/c/${active}`, greetingForm());
  await app.request(`/c/${active}/activate`, { method: 'POST' });
  await postForm(app, `/c/${draft}`, greetingForm({}, [JPEG]));
  const [photo] = repo.getCard(draft).photos;

  clock.now += 31 * 24 * 60 * 60 * 1000;
  sweep({ repo, storage, now: clock.now });

  assert.equal(repo.getCard(active).status, 'expired');
  assert.equal(repo.getCard(draft).status, 'new');
  assert.equal(existsSync(storage.photoPath(draft, photo)), false);
});

test('only openings of an active card are counted', async (t) => {
  const { app, repo, clock } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.equal((await app.request(`/c/${code}/opened`, { method: 'POST' })).status, 204);
  assert.equal(repo.getCard(code).openCount, 0);

  await app.request(`/c/${code}/activate`, { method: 'POST' });
  await app.request(`/c/${code}/opened`, { method: 'POST' });
  const firstOpen = clock.now;
  clock.now += 1000;
  await app.request(`/c/${code}/opened`, { method: 'POST' });

  const card = repo.getCard(code);
  assert.equal(card.openCount, 2);
  assert.equal(card.firstOpenedAt, firstOpen);
});

test('the buyer right after activation is not tracked, later visits are', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  assert.match(await (await app.request(`/c/${code}?activated=1`)).text(), /data-track="0"/);
  assert.match(await (await app.request(`/c/${code}`)).text(), /data-track="1"/);
});

test('open statistics survive the content wipe', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  await app.request(`/c/${code}/opened`, { method: 'POST' });
  clock.now += WEEK;
  sweep({ repo, storage, now: clock.now });
  assert.equal(repo.getCard(code).openCount, 1);
  assert.equal(repo.getCard(code).sender, null);
});

test('final page lets the recipient thank the sender and order the same', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  const body = await (await app.request(`/c/${code}`)).text();
  assert.match(body, /href="https:\/\/wa\.me\/\?text=[^"]*%D0%94%D0%B0%D0%BD%D0%B8%D1%8F%D1%80/);
  assert.match(body, /class="order-same" href="\/"/);
});

test('every template ends with a next button leading to the logo and contacts', async (t) => {
  const { app } = makeContext(t);
  for (const id of ['envelope', 'tulips', 'night', 'polaroid', 'watercolor', 'gold', 'garden', 'cinema', 'silk', 'ornament']) {
    const body = await (await app.request(`/demo/${id}`)).text();
    assert.match(body, /id="to-brand"/, id);
    assert.match(body, /id="brand-page"[^>]*hidden/, id);
    assert.match(body, /<svg class="mark"/, id);
    assert.match(body, /wa\.me\/77754815992/, id);
  }
});

test('styles and scripts carry a content version so caches refresh after a release', async (t) => {
  const { app, repo } = makeContext(t);
  const demo = await (await app.request('/demo/gold')).text();
  assert.match(demo, /\/static\/design\/css\/card-base\.css\?v=[a-f0-9]{10}/);
  assert.match(demo, /\/static\/design\/css\/gold\.css\?v=[a-f0-9]{10}/);
  assert.match(demo, /\/static\/design\/js\/card\.js\?v=[a-f0-9]{10}/);
  assert.match(await (await app.request(`/c/${issueCard(repo)}?template=envelope`)).text(), /js\/form\.js\?v=[a-f0-9]{10}/);
});

test('template styles and demo photos are served from the designer folder', async (t) => {
  const { app } = makeContext(t);
  const css = await app.request('/static/design/css/gold.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('cache-control'), /max-age=/);
  assert.equal((await app.request('/static/design/css/card-base.css')).status, 200);
  assert.equal((await app.request('/static/design/demo/1.svg')).status, 200);
  assert.equal((await app.request('/static/design/js/card.js')).status, 200);
  assert.equal((await app.request('/static/design/../templates.js')).status, 404);
  assert.match(await (await app.request('/demo/gold')).text(), /\/static\/design\/demo\/1\.svg/);
});

test('a broken template description is reported in plain words', () => {
  const good = { ...getTemplate('gold'), id: 'gold-copy' };
  assert.deepEqual(designProblems(getTemplate('gold')), []);
  const problems = designProblems({ ...good, id: 'new-one', tier: 'vip', fx: 'rain', accent: 'red' });
  assert.ok(problems.some((p) => p.includes('raiko/assets/css/new-one.css')));
  assert.ok(problems.some((p) => p.includes('tier')));
  assert.ok(problems.some((p) => p.includes('fx')));
  assert.ok(problems.some((p) => p.includes('#rrggbb')));
  assert.ok(designProblems(getTemplate('gold'), new Set(['gold'])).some((p) => p.includes('уже есть')));
});

test('brand favicon is served', async (t) => {
  const { app } = makeContext(t);
  const res = await app.request('/static/brand/favicon.svg');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /svg/);
});

test('form offers ready-made Kazakh greetings', async (t) => {
  const { app, repo } = makeContext(t);
  assert.match(await (await app.request(`/c/${issueCard(repo)}?template=envelope`)).text(), /Туған күн/);
});

test('text responses are gzipped and static files are cached', async (t) => {
  const { app } = makeContext(t);
  const page = await app.request('/', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(page.headers.get('content-encoding'), 'gzip');
  const css = await app.request('/static/css/app.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('cache-control'), /max-age=/);
});

test('photo route rejects path tricks', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await app.request(`/media/p/${code}/..%2F..%2Fsecret.jpg`)).status, 404);
});

test('demo pages exist for all ten templates and pages are not indexed', async (t) => {
  const { app } = makeContext(t);
  const ids = ['envelope', 'tulips', 'night', 'polaroid', 'watercolor', 'gold', 'garden', 'cinema', 'silk', 'ornament'];
  for (const id of ids) {
    const res = await app.request(`/demo/${id}`);
    assert.equal(res.status, 200, id);
    assert.match(res.headers.get('x-robots-tag'), /noindex/);
    assert.match(await res.text(), /cclab\.kz/, id);
  }
});
