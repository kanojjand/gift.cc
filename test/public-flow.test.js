import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { sweep } from '../src/sweep.js';
import { OCCASIONS } from '../raiko/texts.js';
import { OCCASION_TEXTS, occasionProblems, suggestedOccasion } from '../src/texts.js';
import { CATALOG, designProblems, getTemplate } from '../src/tiers.js';
import { greetingForm, issueCard, JPEG, makeContext, postForm } from './helpers.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

const catalogTiles = (body) => (body.match(/class="cat-card"/g) ?? []).length;

test('every unused code opens the catalog with all templates', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await app.request(`/c/${code}`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(catalogTiles(body), CATALOG.length);
  assert.ok(!body.includes('id="greeting-form"'));
  assert.match(body, /template=bloom/);
  assert.match(body, /до 5 фото/);
  assert.doesNotMatch(body, /Премиум|Базовый/);
});

test('choosing a template opens the form for it, the code stays the same', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const body = await (await app.request(`/c/${code}?template=birthday`)).text();
  assert.match(body, /id="greeting-form"/);
  assert.match(body, /data-template="birthday"/);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'birthday' }));
  const card = repo.getCard(code);
  assert.equal(card.templateId, 'birthday');
  assert.equal(card.status, 'draft');
  assert.match(await (await app.request(`/c/${code}`)).text(), /t-birthday/);
});

test('a new code cannot pick a retired or unknown template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal(catalogTiles(await (await app.request(`/c/${code}?template=gold`)).text()), CATALOG.length);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'gold' }))).status, 400);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'nope' }))).status, 400);
  assert.equal(repo.getCard(code).status, 'new');
});

test('every code takes up to five photos on any template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'bloom' }, Array(6).fill(JPEG)))).status, 400);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'bloom' }, Array(5).fill(JPEG)))).status, 200);
  assert.equal(repo.getCard(code).photos.length, 5);
  assert.match(await (await app.request(`/c/${code}?edit=1`)).text(), /data-max="5"/);
});

test('template can be changed in a draft but not after activation', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm());
  assert.equal(catalogTiles(await (await app.request(`/c/${code}?pick=1`)).text()), CATALOG.length);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'love' }));
  assert.equal(repo.getCard(code).templateId, 'love');
  await app.request(`/c/${code}/activate`, { method: 'POST' });
  const body = await (await app.request(`/c/${code}?pick=1&template=birthday`)).text();
  assert.equal(catalogTiles(body), 0);
  assert.match(body, /t-love/);
});

test('an abandoned draft returns to the catalog', async (t) => {
  const { app, repo, storage, clock } = makeContext(t);
  const code = issueCard(repo);
  await postForm(app, `/c/${code}`, greetingForm({ templateId: 'love' }));
  clock.now += 8 * 24 * 60 * 60 * 1000;
  sweep({ repo, storage, now: clock.now });
  assert.equal(repo.getCard(code).templateId, null);
  assert.equal(catalogTiles(await (await app.request(`/c/${code}`)).text()), CATALOG.length);
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
  const active = issueCard(repo, 'actvecde2345');
  const draft = issueCard(repo, 'draftcde2345');
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
  for (const id of ['newyear', 'birthday', 'love', 'bloom', 'aurora']) {
    const body = await (await app.request(`/demo/${id}`)).text();
    assert.match(body, /id="to-brand"/, id);
    assert.match(body, /id="brand-page"[^>]*hidden/, id);
    assert.match(body, /<svg class="mark"/, id);
    assert.match(body, /wa\.me\/77754815992/, id);
  }
});

test('card styles are inlined and fonts do not hold back the first screen', async (t) => {
  const { app } = makeContext(t);
  const demo = await (await app.request('/demo/bloom')).text();
  const style = /<style>([\s\S]*?)<\/style>/.exec(demo)?.[1] ?? '';
  assert.ok(style.includes(readFileSync(new URL('../raiko/assets/css/card-base.css', import.meta.url), 'utf8')));
  assert.ok(style.includes(readFileSync(new URL('../raiko/assets/css/bloom.css', import.meta.url), 'utf8')));
  assert.doesNotMatch(demo, /<link rel="stylesheet" href="\/static\/design\/css/);
  assert.match(demo, /<link id="card-fonts" rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" media="print">/);
  assert.match(demo, /class="card t-bloom tone-light pal-peony fonts-wait"/);
});

test('styles and scripts carry a content version so caches refresh after a release', async (t) => {
  const { app, repo } = makeContext(t);
  const demo = await (await app.request('/demo/bloom')).text();
  assert.match(demo, /\/static\/design\/js\/card\.js\?v=[a-f0-9]{10}/);
  assert.match(await (await app.request(`/c/${issueCard(repo)}?template=newyear`)).text(), /js\/form\.js\?v=[a-f0-9]{10}/);
});

test('template styles and demo photos are served from the designer folder', async (t) => {
  const { app } = makeContext(t);
  const css = await app.request('/static/design/css/bloom.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('cache-control'), /max-age=/);
  assert.equal((await app.request('/static/design/css/card-base.css')).status, 200);
  assert.equal((await app.request('/static/design/demo/1.svg')).status, 200);
  assert.equal((await app.request('/static/design/js/card.js')).status, 200);
  assert.equal((await app.request('/static/design/../templates.js')).status, 404);
  assert.match(await (await app.request('/demo/bloom')).text(), /\/static\/design\/demo\/1\.svg/);
});

test('a broken template description is reported in plain words', () => {
  const good = { ...getTemplate('bloom'), id: 'gold-copy' };
  assert.deepEqual(designProblems(getTemplate('bloom')), []);
  const problems = designProblems({ ...good, id: 'new-one', fx: 'rain', palettes: [{ ...good.palettes[0], accent: 'red' }] });
  assert.ok(problems.some((p) => p.includes('raiko/assets/css/new-one.css')));
  assert.ok(problems.some((p) => p.includes('fx')));
  assert.ok(problems.some((p) => p.includes('#rrggbb')));
  assert.ok(designProblems(getTemplate('bloom'), new Set(['bloom'])).some((p) => p.includes('уже есть')));
});

test('brand favicon is served', async (t) => {
  const { app } = makeContext(t);
  const res = await app.request('/static/brand/favicon.svg');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /svg/);
});

test('form offers ready-made Kazakh greetings', async (t) => {
  const { app, repo } = makeContext(t);
  assert.match(await (await app.request(`/c/${issueCard(repo)}?template=newyear`)).text(), /Туған күн/);
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
  const ids = ['newyear', 'birthday', 'love', 'bloom', 'aurora'];
  for (const id of ids) {
    const res = await app.request(`/demo/${id}`);
    assert.equal(res.status, 200, id);
    assert.match(res.headers.get('x-robots-tag'), /noindex/);
    assert.match(await res.text(), /cclab\.kz/, id);
  }
});

test('form offers short and long ready texts per occasion in two languages to every code', async (t) => {
  const { app, repo } = makeContext(t);
  const form = await (await app.request(`/c/${issueCard(repo)}?template=bloom`)).text();
  const [birthday] = OCCASIONS;
  const escape = (text) => text.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  assert.ok(form.includes(escape(birthday.short.ru[0])));
  assert.ok(form.includes(escape(birthday.long.ru[0])));
  assert.ok(!form.includes('Премиум-тексты'));
  for (const occasion of OCCASION_TEXTS) {
    assert.match(form, new RegExp(`class="tp-variants" data-occ="${occasion.id}" data-lang="ru"`));
    assert.match(form, new RegExp(`class="tp-variants" data-occ="${occasion.id}" data-lang="kk"`));
  }
  assert.match(form, /<textarea id="message"/);
  assert.match(form, /id="message-undo"/);
});

test('every occasion has three short and three long variants per language and fits the message limit', () => {
  for (const occasion of OCCASION_TEXTS) {
    assert.equal(occasion.texts.ru.length, 6, `${occasion.id} ru`);
    assert.equal(occasion.texts.kk.length, 6, `${occasion.id} kk`);
  }
  assert.deepEqual(occasionProblems({ ...OCCASIONS[0], short: { ru: ['a'], kk: ['b'] }, long: { ru: ['c'], kk: ['d'] } }), []);
  const problems = occasionProblems({ id: 'Bad id', name: { ru: 'x' }, season: ['13-01'], short: { ru: ['x'.repeat(1001)], kk: [] } });
  assert.ok(problems.some((p) => p.includes('латиница')));
  assert.ok(problems.some((p) => p.includes('name')));
  assert.ok(problems.some((p) => p.includes('season')));
  assert.ok(problems.some((p) => p.includes('длиннее')));
  assert.ok(problems.some((p) => p.includes('нет текстов')));
});

test('the nearest holiday is preselected in the form', () => {
  assert.equal(suggestedOccasion(Date.UTC(2026, 2, 5)), 'march-8');
  assert.equal(suggestedOccasion(Date.UTC(2026, 2, 20)), 'nauryz');
  assert.equal(suggestedOccasion(Date.UTC(2026, 11, 30)), 'new-year');
  assert.equal(suggestedOccasion(Date.UTC(2027, 0, 3)), 'new-year');
  assert.equal(suggestedOccasion(Date.UTC(2026, 10, 9)), 'birthday');
});

test('landing page lists every template with one photo limit', async (t) => {
  const { app } = makeContext(t);
  const body = await (await app.request('/')).text();
  assert.match(body, /Шаблоны, до 5 фото/);
  assert.equal((body.match(/class="tpl-link"/g) ?? []).length, CATALOG.length);
  assert.doesNotMatch(body, /Премиум|Базовые/);
});
