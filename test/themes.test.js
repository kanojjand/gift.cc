import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG, getPalette, getTemplate, isPaletteAllowed } from '../src/tiers.js';
import { greetingForm, issueCard, makeContext, postForm } from './helpers.js';

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
  const code = issueCard(repo, 'newyear');
  const res = await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear', palette: 'fir' }));
  assert.equal(res.status, 200);
  assert.equal(repo.getCard(code).palette, 'fir');
  const body = await (await app.request(`/c/${code}`)).text();
  assert.match(body, /--bg:#0b281e;/);
  assert.match(body, /class="card t-newyear tone-dark pal-fir fonts-wait"/);
});

test('a palette from another template is refused, a missing one falls back to the first', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear', palette: 'peony' }))).status, 400);
  assert.equal(repo.getCard(code).status, 'new');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ templateId: 'newyear' }))).status, 200);
  assert.equal(repo.getCard(code).palette, 'midnight');
});

test('a draft on a retired template can still be edited and shown, but new cards cannot pick it', async (t) => {
  const { app, repo } = makeContext(t);
  const draftCode = issueCard(repo, 'newyear', 'draftcde2345');
  repo.saveDraft(draftCode, { templateId: 'envelope', sender: 'А', recipient: 'Б', message: 'Текст', songId: null, photos: [] }, 1);
  assert.match(await (await app.request(`/c/${draftCode}`)).text(), /t-envelope/);
  assert.match(await (await app.request(`/c/${draftCode}?edit=1`)).text(), /data-template="envelope"/);
  assert.equal((await postForm(app, `/c/${draftCode}`, greetingForm({ templateId: 'envelope' }))).status, 200);

  const freshCode = issueCard(repo, 'newyear', 'freshcde2345');
  assert.doesNotMatch(await (await app.request(`/c/${freshCode}?template=envelope`)).text(), /greeting-form/);
  assert.equal((await postForm(app, `/c/${freshCode}`, greetingForm({ templateId: 'envelope' }))).status, 400);
});

test('demo opened from the catalog lets the buyer switch colours and pick the template', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const body = await (await app.request(`/demo/love?p=violet&from=${code}`)).text();
  assert.match(body, /--bg:#100b22;/);
  assert.match(body, new RegExp(`href="/c/${code}\\?template=love&amp;palette=violet"`));
  assert.match(body, new RegExp(`href="\\?p=blush&amp;from=${code}"`));
  const plain = await (await app.request('/demo/love?from=zzzzzzzzzzzz')).text();
  assert.doesNotMatch(plain, />Выбрать этот<\/a>/);
  assert.match(plain, /demo-palettes/);
});

test('premium template demo does not offer a basic code to pick it', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  assert.doesNotMatch(await (await app.request(`/demo/bloom?from=${code}`)).text(), />Выбрать этот<\/a>/);
});

test('the form starts with the theme occasion, a ready text and the palette picked in the demo', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const form = await (await app.request(`/c/${code}?template=birthday&palette=party`)).text();
  assert.match(form, /data-occ="birthday"/);
  assert.match(form, /<textarea[^>]*>С днём рождения!/);
  assert.match(form, /value="party" checked/);
  assert.match(form, /class="steps"/);
});

test('new year card greets the coming year and love card engraves both initials', async (t) => {
  const { app } = makeContext(t);
  assert.match(await (await app.request('/demo/newyear')).text(), /Пусть 2027 будет волшебным!/);
  assert.match(await (await app.request('/demo/love')).text(), /А \+ Д/);
  assert.match(await (await app.request('/demo/birthday')).text(), /class="cake"/);
});
