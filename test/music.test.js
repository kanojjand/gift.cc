import assert from 'node:assert/strict';
import { test } from 'node:test';
import { greetingForm, issueCard, makeContext, postForm } from './helpers.js';

const YT_ID = 'dQw4w9WgXcQ';
const SAVED_LINK = `https://www.youtube.com/watch?v=${YT_ID}`;

test('a song link from the form is saved clean and the card shows the official player', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const res = await postForm(app, `/c/${code}`, greetingForm({ musicLink: `https://youtu.be/${YT_ID}?si=tracking123` }));
  assert.equal(res.status, 200);
  assert.equal(repo.getCard(code).musicLink, SAVED_LINK);

  const body = await (await app.request(`/c/${code}`)).text();
  assert.match(body, /class="scene scene-song"/);
  assert.match(body, new RegExp(`<iframe src="https://www.youtube-nocookie.com/embed/${YT_ID}\\?rel=0&amp;playsinline=1"`));
  assert.match(body, /referrerpolicy="strict-origin"/);
  assert.doesNotMatch(body, /class="bg-music"/);
});

test('a link the site does not know is refused and the buyer sees why', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const res = await postForm(app, `/c/${code}`, greetingForm({ musicLink: 'https://vk.com/audio1_2' }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.errors.musicLink, /YouTube, Spotify, Apple Music или Яндекс Музыки/);
  assert.equal(repo.getCard(code).status, 'new');
});

test('without a link the card has no song screen', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ musicLink: '  ' }))).status, 200);
  assert.equal(repo.getCard(code).musicLink, null);
  assert.doesNotMatch(await (await app.request(`/c/${code}`)).text(), /class="scene scene-song"/);
});

test('the song link wins over a template melody, so two songs never play at once', async (t) => {
  const { app, repo } = makeContext(t);
  repo.upsertSong({ templateId: 'newyear', slot: 1, title: 'Мелодия', file: 'aaaaaaaaaaaaaaaaaaaaaaaa.mp3', mime: 'audio/mpeg' });
  const [song] = repo.listSongs('newyear');
  const code = issueCard(repo, 'newyear');
  const res = await postForm(app, `/c/${code}`, greetingForm({ songId: String(song.id), musicLink: SAVED_LINK }));
  assert.equal(res.status, 200);
  assert.equal(repo.getCard(code).songId, null);
  assert.doesNotMatch(await (await app.request(`/c/${code}`)).text(), /class="bg-music"/);
});

test('the demo shows where the buyer’s song will be', async (t) => {
  const { app } = makeContext(t);
  const body = await (await app.request('/demo/birthday')).text();
  assert.match(body, /class="scene scene-song"/);
  assert.match(body, /Здесь будет ваша песня/);
  assert.doesNotMatch(body, /<iframe/);
});

test('pages let the browser show the four official players', async (t) => {
  const { app } = makeContext(t);
  const policy = (await app.request('/demo/newyear')).headers.get('content-security-policy');
  const frameSrc = policy.split('; ').find((rule) => rule.startsWith('frame-src '));
  for (const origin of ['https://www.youtube-nocookie.com', 'https://open.spotify.com', 'https://embed.music.apple.com', 'https://music.yandex.ru']) {
    assert.ok(frameSrc.includes(origin), origin);
  }
});

test('editing a draft keeps the link in the form and the form can check links on the spot', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  await postForm(app, `/c/${code}`, greetingForm({ musicLink: SAVED_LINK }));
  const body = await (await app.request(`/c/${code}?edit=1`)).text();
  assert.match(body, new RegExp(`name="musicLink"[^>]*value="https://www.youtube.com/watch\\?v=${YT_ID}"`));
  assert.match(body, /data-module="\/static\/js\/music-link\.js\?v=/);
});

test('an expired card forgets the song link together with the rest of the greeting', async (t) => {
  const { repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  repo.saveDraft(code, { templateId: 'newyear', sender: 'А', recipient: 'Б', message: 'Текст', songId: null, musicLink: SAVED_LINK, photos: [] }, 1);
  repo.activate(code, 2, 10);
  repo.expireDue(100);
  assert.equal(repo.getCard(code).musicLink, null);
});

test('the buyer picks the moment a YouTube song starts from', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const res = await postForm(app, `/c/${code}`, greetingForm({ musicLink: `https://youtu.be/${YT_ID}`, musicStartMin: '1', musicStartSec: '05' }));
  assert.equal(res.status, 200);
  assert.equal(repo.getCard(code).musicLink, `${SAVED_LINK}&t=65`);
  assert.match(await (await app.request(`/c/${code}`)).text(), /playsinline=1&amp;start=65"/);
  const form = await (await app.request(`/c/${code}?edit=1`)).text();
  assert.match(form, /name="musicStartMin"[^>]*value="1"/);
  assert.match(form, /name="musicStartSec"[^>]*value="05"/);
});

test('empty moment fields start the song from the beginning, a wrong moment is refused', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const link = `https://youtu.be/${YT_ID}?t=42`;
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ musicLink: link, musicStartMin: '', musicStartSec: '' }))).status, 200);
  assert.equal(repo.getCard(code).musicLink, SAVED_LINK);

  const res = await postForm(app, `/c/${code}`, greetingForm({ musicLink: link, musicStartMin: '1', musicStartSec: '75' }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).errors.musicStart, /секунд/);
  assert.equal(repo.getCard(code).musicLink, SAVED_LINK);
});

test('a moment typed for a service that cannot start mid-song is ignored', async (t) => {
  const { app, repo } = makeContext(t);
  const code = issueCard(repo, 'newyear');
  const spotify = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
  assert.equal((await postForm(app, `/c/${code}`, greetingForm({ musicLink: spotify, musicStartMin: '1', musicStartSec: '05' }))).status, 200);
  assert.equal(repo.getCard(code).musicLink, spotify);
});
