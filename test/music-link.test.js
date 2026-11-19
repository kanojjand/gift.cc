import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalLink, MUSIC_FRAME_ORIGINS, musicEmbed, parseMusicLink, readStartTime, startParts, withStart } from '../public/js/music-link.js';

const YT_ID = 'dQw4w9WgXcQ';
const SPOTIFY_ID = '4cOdK2wGLETKBW3PvgPWqT';

test('recognises the usual YouTube links and keeps the start time', () => {
  const links = [
    `https://www.youtube.com/watch?v=${YT_ID}`,
    `https://youtu.be/${YT_ID}?si=AbCdEf123`,
    `https://m.youtube.com/watch?v=${YT_ID}&feature=share`,
    `https://music.youtube.com/watch?v=${YT_ID}&list=RDAMVM`,
    `https://youtube.com/shorts/${YT_ID}`,
    `youtu.be/${YT_ID}`,
  ];
  for (const link of links) {
    assert.deepEqual(parseMusicLink(link), { service: 'youtube', id: YT_ID, start: 0 }, link);
  }
  assert.equal(parseMusicLink(`https://youtu.be/${YT_ID}?t=1m30s`).start, 90);
  assert.equal(parseMusicLink(`https://www.youtube.com/watch?v=${YT_ID}&t=75`).start, 75);
});

test('recognises Spotify tracks, albums and playlists, with or without the language prefix', () => {
  assert.deepEqual(parseMusicLink(`https://open.spotify.com/track/${SPOTIFY_ID}?si=123abc`), { service: 'spotify', kind: 'track', id: SPOTIFY_ID });
  assert.deepEqual(parseMusicLink(`https://open.spotify.com/intl-ru/track/${SPOTIFY_ID}`), { service: 'spotify', kind: 'track', id: SPOTIFY_ID });
  assert.equal(parseMusicLink(`https://open.spotify.com/playlist/${SPOTIFY_ID}`).kind, 'playlist');
  assert.equal(parseMusicLink(`https://open.spotify.com/album/${SPOTIFY_ID}`).kind, 'album');
});

test('recognises Apple Music songs inside an album, single songs and playlists', () => {
  assert.deepEqual(parseMusicLink('https://music.apple.com/kz/album/name-of-album/1440857781?i=1440858007'), {
    service: 'apple', kind: 'album', country: 'kz', id: '1440857781', song: '1440858007',
  });
  assert.deepEqual(parseMusicLink('https://music.apple.com/us/song/some-song/1440858007'), {
    service: 'apple', kind: 'song', country: 'us', id: '1440858007', song: null,
  });
  assert.equal(parseMusicLink('https://music.apple.com/ru/playlist/love/pl.f4d106fed2bd41149aaacabb233eb5eb').id, 'pl.f4d106fed2bd41149aaacabb233eb5eb');
});

test('recognises Yandex Music tracks on any of its domains', () => {
  assert.deepEqual(parseMusicLink('https://music.yandex.ru/album/36094795/track/138181431?utm_source=desktop&utm_medium=copy_link'), {
    service: 'yandex', domain: 'ru', album: '36094795', track: '138181431',
  });
  assert.deepEqual(parseMusicLink('https://music.yandex.kz/track/138181431'), { service: 'yandex', domain: 'kz', album: null, track: '138181431' });
});

test('finds the link inside the text that the share button copies', () => {
  const shared = 'Послушай «Песня» — Артист на Яндекс Музыке https://music.yandex.ru/album/1/track/2?utm_source=web.';
  assert.deepEqual(parseMusicLink(shared), { service: 'yandex', domain: 'ru', album: '1', track: '2' });
  assert.equal(parseMusicLink(`Смотри (https://youtu.be/${YT_ID})`).id, YT_ID);
});

test('refuses links that are not songs from the four services', () => {
  const bad = [
    '',
    '   ',
    'просто текст',
    'https://vk.com/audio123_456',
    `https://evil.example/youtube.com/watch?v=${YT_ID}`,
    `https://youtube.com.evil.example/watch?v=${YT_ID}`,
    'https://www.youtube.com/watch?v=short',
    `javascript:alert(1)//youtu.be/${YT_ID}`,
    'https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT',
    'https://open.spotify.com/track/../../evil',
    'https://music.apple.com/kz/album/name/notanumber',
    'https://music.yandex.ru/artist/123',
    `https://youtu.be/${YT_ID}${'x'.repeat(700)}`,
  ];
  for (const link of bad) assert.equal(parseMusicLink(link), null, link);
  assert.equal(parseMusicLink(null), null);
  assert.equal(parseMusicLink(42), null);
});

test('the saved link is clean and reads back the same', () => {
  const inputs = [
    `https://youtu.be/${YT_ID}?si=AbCdEf&t=42`,
    `https://open.spotify.com/intl-ru/track/${SPOTIFY_ID}?si=1`,
    'https://music.apple.com/kz/album/x/1440857781?i=1440858007&ls',
    'https://music.yandex.kz/album/1/track/2?utm_source=x',
  ];
  for (const input of inputs) {
    const music = parseMusicLink(input);
    const saved = canonicalLink(music);
    assert.doesNotMatch(saved, /si=|utm_|ls/, saved);
    assert.deepEqual(parseMusicLink(saved), music, saved);
  }
  assert.equal(canonicalLink(parseMusicLink(`https://youtu.be/${YT_ID}?t=42`)), `https://www.youtube.com/watch?v=${YT_ID}&t=42`);
});

test('builds the official player address from the parsed ids only', () => {
  assert.deepEqual(musicEmbed(parseMusicLink(`https://youtu.be/${YT_ID}?t=42`)), {
    service: 'youtube',
    name: 'YouTube',
    fullTrack: true,
    canStart: true,
    autoplay: true,
    controlSrc: `https://www.youtube-nocookie.com/embed/${YT_ID}?rel=0&playsinline=1&start=42&enablejsapi=1`,
    src: `https://www.youtube-nocookie.com/embed/${YT_ID}?rel=0&playsinline=1&start=42`,
    height: 0,
  });
  const spotify = musicEmbed(parseMusicLink(`https://open.spotify.com/track/${SPOTIFY_ID}`));
  assert.equal(spotify.src, `https://open.spotify.com/embed/track/${SPOTIFY_ID}`);
  assert.equal(spotify.height, 152);
  assert.equal(spotify.fullTrack, false);
  assert.equal(spotify.autoplay, true);
  assert.equal(spotify.controlSrc, spotify.src);
  const apple = musicEmbed(parseMusicLink('https://music.apple.com/kz/album/x/1440857781?i=1440858007'));
  assert.equal(apple.autoplay, false);
  assert.equal(apple.controlSrc, null);
  assert.equal(musicEmbed(parseMusicLink(`https://open.spotify.com/playlist/${SPOTIFY_ID}`)).height, 352);
  assert.equal(musicEmbed(parseMusicLink('https://music.apple.com/kz/album/x/1440857781?i=1440858007')).src, 'https://embed.music.apple.com/kz/album/1440857781?i=1440858007');
  assert.equal(musicEmbed(parseMusicLink('https://music.apple.com/us/song/x/1440858007')).src, 'https://embed.music.apple.com/us/song/1440858007');
  assert.equal(musicEmbed(parseMusicLink('https://music.yandex.kz/album/1/track/2')).src, 'https://music.yandex.kz/iframe/album/1/track/2');
  assert.equal(musicEmbed(parseMusicLink('https://music.yandex.ru/track/2')).src, 'https://music.yandex.ru/iframe/#track/2');
  assert.equal(musicEmbed(null), null);
});

test('every player address is on the list of allowed frame origins', () => {
  const links = [
    `https://youtu.be/${YT_ID}`,
    `https://open.spotify.com/track/${SPOTIFY_ID}`,
    'https://music.apple.com/kz/album/x/1440857781?i=1440858007',
    'https://music.yandex.ru/album/1/track/2',
    'https://music.yandex.kz/album/1/track/2',
  ];
  for (const link of links) {
    assert.ok(MUSIC_FRAME_ORIGINS.includes(new URL(musicEmbed(parseMusicLink(link)).src).origin), link);
  }
});

test('reads the start moment from the minutes and seconds the buyer typed', () => {
  assert.equal(readStartTime('1', '05'), 65);
  assert.equal(readStartTime('', ''), 0);
  assert.equal(readStartTime('', '30'), 30);
  assert.equal(readStartTime(' 2 ', ''), 120);
  assert.equal(readStartTime(null, undefined), 0);
  for (const [minutes, seconds] of [['1', '75'], ['x', '1'], ['-1', '0'], ['1.5', '0'], ['999', '0'], ['1', '5s']]) {
    assert.equal(readStartTime(minutes, seconds), null, `${minutes}:${seconds}`);
  }
});

test('splits a start moment back into minutes and seconds for the form', () => {
  assert.deepEqual(startParts(65), { minutes: '1', seconds: '05' });
  assert.deepEqual(startParts(0), { minutes: '', seconds: '' });
  assert.deepEqual(startParts(3600), { minutes: '60', seconds: '00' });
});

test('only a YouTube song can start from a chosen moment', () => {
  const youtube = parseMusicLink(`https://youtu.be/${YT_ID}?t=42`);
  const moved = withStart(youtube, 65);
  assert.equal(moved.start, 65);
  assert.equal(youtube.start, 42);
  assert.match(musicEmbed(moved).src, /&start=65$/);
  assert.equal(musicEmbed(moved).canStart, true);
  const spotify = parseMusicLink(`https://open.spotify.com/track/${SPOTIFY_ID}`);
  assert.equal(withStart(spotify, 65), spotify);
  assert.equal(musicEmbed(spotify).canStart, false);
});
