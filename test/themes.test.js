import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, getPalette, getTemplate, isPaletteAllowed } from '../src/tiers.js';
import { greetingForm, issueCard, JPEG, makeContext, postForm } from './helpers.js';

test('catalog offers only the new themed templates, the old ones are kept for existing cards', () => {
  assert.deepEqual(CATALOG.map((template) => template.id), ['newyear', 'birthday', 'love', 'bloom', 'aurora']);
  assert.equal(getTemplate('envelope').retired, true);
  assert.equal(getTemplate('envelope').palettes.length, 0);
});

test('every new template has four palettes and knows whether it is light or dark', () => {
  for (const template of CATALOG) {
    assert.equal(template.palettes.length, 4, template.id);
    assert.ok(template.palettes.every((palette) => palette.tone === 'light' || palette.tone === 'dark'), template.id);
  }
  assert.equal(getPalette(getTemplate('newyear'), 'frost').tone, 'light');
  assert.equal(getPalette(getTemplate('newyear'), 'midnight').tone, 'dark');
  assert.equal(getPalette(getTemplate('newyear'), 'nope').id, 'midnight');
  assert.equal(isPaletteAllowed(getTemplate('newyear'), 'nope'), false);
});

test('the chosen palette is saved and paints the card', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const res = await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear', palette: 'fir' }));
  assert.equal(res.status, 200);
  assert.equal(repo.getCard(code).palette, 'fir');
  const body = await (await app.request(`/c/${code}`)).text();
  assert.match(body, /--bg:#0b281e;/);
  assert.match(body, /class="card t-newyear tone-dark pal-fir fonts-wait"/);
});

test('a palette from another template is refused, a missing one falls back to the first', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear', palette: 'peony' }))).status, 400);
  assert.equal(repo.getCard(code).status, 'new');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear' }))).status, 200);
  assert.equal(repo.getCard(code).palette, 'midnight');
});

test('a draft on a retired template can still be edited and shown, but new cards cannot pick it', async (t) => {
  const { app, repo } = makeContext(t);
  const draftCode = issueCard(repo, 'draftcde2345');
  repo.saveDraft(draftCode, { templateId: 'envelope', sender: 'А', recipient: 'Б', message: 'Текст', songId: null, photos: [] }, 1);
  assert.match(await (await app.request(`/c/${draftCode}`)).text(), /t-envelope/);
  assert.match(await (await app.request(`/c/${draftCode}?edit=1`)).text(), /data-template="envelope"/);
  assert.equal((await postForm(app, `/c/${draftCode}`, greetingForm({ templateId: 'envelope' }))).status, 200);

  const freshCode = issueCard(repo, 'freshcde2345');
  assert.doesNotMatch(await (await app.request(`/c/${freshCode}?template=envelope`)).text(), /greeting-form/);
  assert.equal((await postForm(app, `/c/${freshCode}`, greetingForm({ templateId: 'envelope' }))).status, 400);
});

test('demo opened from the catalog lets the buyer switch colours and pick the template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const body = await (await app.request(`/demo/love?p=violet&from=${code}`)).text();
  assert.match(body, /--bg:#100b22;/);
  assert.match(body, new RegExp(`href="/c/${code}\\?template=love&amp;palette=violet"`));
  assert.match(body, new RegExp(`href="\\?p=blush&amp;from=${code}"`));
  const plain = await (await app.request('/demo/love?from=zzzzzzzzzzzz')).text();
  assert.doesNotMatch(plain, />Выбрать этот<\/a>/);
  assert.match(plain, /demo-palettes/);
});

test('every code can pick any template straight from its demo', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  assert.match(await (await app.request(`/demo/bloom?from=${code}`)).text(), />Выбрать этот<\/a>/);
});

test('the form starts with the theme occasion, a ready text and the palette picked in the demo', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo);
  const form = await (await app.request(`/c/${code}?template=birthday&palette=party`)).text();
  assert.match(form, /data-occ="birthday"/);
  assert.match(form, /<textarea[^>]*>С днём рождения!/);
  assert.match(form, /value="party" checked/);
  assert.match(form, /class="steps"/);
});

const cardPage = async (app, code) => (await app.request(`/c/${code}`)).text();
const demoPage = async (app, templateId) => (await app.request(`/demo/${templateId}`)).text();

async function filledCard(app, repo, code, templateId, photos = []) {
  issueCard(repo, code);
  await postForm(app, `/c/${code}`, greetingForm({ templateId }, photos));
  return cardPage(app, code);
}

test('each new template opens its own story with its own way to play', async (t) => {
  const { app } = makeContext(t);
  const stories = {
    newyear: [/Для Айгерим/, /Встряхни шар/, /class="globe globe-still lit"/, /С Новым годом,/, /Письмо под ёлкой/, /data-action="wish"/],
    birthday: [/Кажется, кое-кто сегодня стал на год круче!/, /Нажми на бант!/, /С днём рождения!/, /class="cake"/, /data-action="replay">Повторить праздник/],
    love: [/А ♡ Д/, /Поверни ключ/, /data-envelope/, /Только для Айгерим/, /data-sound="lock-click"/, /data-action="replay">Открыть ещё раз/],
    bloom: [/Special edition/, /Посвящается/, /Этот выпуск — о тебе\./, /Немного о главном/, /data-action="reread">Перечитать этот выпуск/],
    aurora: [/У каждого человека есть свой свет\./, /Смелость/, /Любовь/, /Продолжай сиять, Айгерим\./, /data-action="new-star"/],
  };
  for (const [templateId, patterns] of Object.entries(stories)) {
    const page = await demoPage(app, templateId);
    for (const pattern of patterns) assert.match(page, pattern, `${templateId}: ${pattern}`);
    assert.match(page, /id="to-brand"/, `${templateId} ends with the way to the CC Lab page`);
  }
  const gifts = (await demoPage(app, 'birthday')).match(/data-gift /g) ?? [];
  assert.equal(gifts.length, 3, 'three small gifts: happiness, adventures, success');
});

test('photos become part of every story and open full screen', async (t) => {
  const { app, repo } = makeContext(t);
  const photos = Array(3).fill(JPEG);
  const places = { newyear: /class="photo-btn ny-window"/, birthday: /class="bd-polaroid"/, love: /Тот самый день/, bloom: /class="bl-spread bl-spread-2"/, aurora: /class="photo-btn au-star-photo"/ };
  const codes = { newyear: 'nnyyccde2345', birthday: 'bbddccde2345', love: 'vvwwccde2345', bloom: 'bbmmccde2345', aurora: 'aarrccde2345' };
  for (const [templateId, pattern] of Object.entries(places)) {
    const page = await filledCard(app, repo, codes[templateId], templateId, photos);
    assert.equal((page.match(/data-photo /g) ?? []).length, 3, `${templateId} shows every photo`);
    assert.match(page, pattern, templateId);
  }
  assert.match(await cardPage(app, codes.love), /И это ещё не конец/);
});

test('without photos the story skips its photo screen', async (t) => {
  const { app, repo } = makeContext(t);
  const plain = { newyear: 'ny-memories', birthday: 'bd-wall-scene', love: 'lv-story', bloom: 'bl-moments', aurora: 'au-sky' };
  const codes = { newyear: 'nnyyccde2346', birthday: 'bbddccde2346', love: 'vvwwccde2346', bloom: 'bbmmccde2346', aurora: 'aarrccde2346' };
  for (const [templateId, photoScene] of Object.entries(plain)) {
    const page = await filledCard(app, repo, codes[templateId], templateId);
    assert.doesNotMatch(page, new RegExp(`class="scene ${photoScene}`), templateId);
    assert.doesNotMatch(page, /data-photo /, templateId);
  }
});

test('names and text in a story are escaped', async (t) => {
  const { app, repo } = makeContext(t);
  issueCard(repo, 'xsscde234567');
  await postForm(app, '/c/xsscde234567', greetingForm({ templateId: 'love', recipient: 'Ая<b>', sender: 'Д<i>', message: '<script>alert(1)</script>' }));
  const page = await cardPage(app, 'xsscde234567');
  assert.match(page, /Только для Ая&lt;b&gt;/);
  assert.doesNotMatch(page, /Ая<b>|Д<i>|<script>alert/);
});

test('retired templates keep their screens one after another', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'mnpqcde23456');
  repo.saveDraft(code, { templateId: 'envelope', sender: 'А', recipient: 'Б', message: 'Текст', songId: null, photos: [] }, 1);
  const page = await cardPage(app, code);
  assert.match(page, /class="scene scene-hello"/);
  assert.doesNotMatch(page, /class="scene scene-postcard"/);
});
