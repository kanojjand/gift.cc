/**
 * Ссылка на песню из YouTube, Spotify, Apple Music или Яндекс Музыки → официальный плеер сервиса.
 * Музыку играет сам сервис по своим лицензиям, сайт её не хранит и не раздаёт.
 *
 * Файл общий для сервера и формы в браузере, поэтому в нём только URL, без DOM и без Node.
 * В страницу попадает не ссылка покупателя, а адрес плеера, собранный заново из проверенных id.
 */

export const MUSIC_LINK_MAX_LENGTH = 600;
export const MUSIC_LINK_ERROR = 'Не получилось узнать ссылку. Нужна ссылка на песню из YouTube, Spotify, Apple Music или Яндекс Музыки.';
export const MUSIC_START_ERROR = 'Проверьте момент: минуты и секунды числами, секунд не больше 59.';

const YANDEX_DOMAINS = ['ru', 'kz', 'com', 'by', 'uz'];

/** Откуда страницам можно встраивать плееры (CSP frame-src). */
export const MUSIC_FRAME_ORIGINS = Object.freeze([
  'https://www.youtube-nocookie.com',
  'https://open.spotify.com',
  'https://embed.music.apple.com',
  ...YANDEX_DOMAINS.map((domain) => `https://music.yandex.${domain}`),
]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);
const YOUTUBE_PATHS = new Set(['shorts', 'live', 'embed', 'v']);
const YOUTUBE_TIME = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;
const SECONDS_PER_MINUTE = 60;
const MAX_START_S = 6 * 60 * SECONDS_PER_MINUTE;
const START_MINUTES = /^\d{1,3}$/;
const START_SECONDS = /^\d{1,2}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS = new Set(['track', 'album', 'playlist']);
const SPOTIFY_LANG = /^intl-[a-z]{2}(?:-[a-z]{2})?$/i;
const APPLE_COUNTRY = /^[a-z]{2}$/;
const APPLE_NUMBER = /^\d{1,15}$/;
const APPLE_PLAYLIST = /^pl\.[A-Za-z0-9-]{1,64}$/;
const YANDEX_HOST = new RegExp(`^music\\.yandex\\.(${YANDEX_DOMAINS.join('|')})$`);
const YANDEX_NUMBER = /^\d{1,15}$/;
const EDGE_PUNCTUATION = /^[("'«“[]+|[)"'»”\].,!?;:]+$/g;
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const SERVICE_INFO = Object.freeze({
  youtube: { name: 'YouTube', fullTrack: true, canStart: true, autoplay: true },
  spotify: { name: 'Spotify', fullTrack: false, canStart: false, autoplay: true },
  apple: { name: 'Apple Music', fullTrack: false, canStart: false, autoplay: false },
  yandex: { name: 'Яндекс Музыка', fullTrack: false, canStart: false, autoplay: false },
});

/** Что добавить к адресу плеера, чтобы страница могла его запустить. YouTube слушает команды только с enablejsapi=1. */
const CONTROL_SUFFIX = Object.freeze({ youtube: '&enablejsapi=1', spotify: '' });

/** Высота плеера в пикселях; 0 — по пропорции видео 16:9. */
const PLAYER_HEIGHT = Object.freeze({ spotifyTrack: 152, spotifyList: 352, appleSong: 175, appleList: 450, yandex: 180 });

function toUrl(token) {
  const withScheme = /^https?:\/\//i.test(token) ? token : OTHER_SCHEME.test(token) ? null : `https://${token}`;
  if (!withScheme) return null;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function startSeconds(value) {
  const match = value ? YOUTUBE_TIME.exec(value) : null;
  if (!match) return 0;
  const total = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return total <= MAX_START_S ? total : 0;
}

function parseYoutube(url, host, path) {
  let id = null;
  if (host === 'youtu.be') id = path[0];
  else if (!YOUTUBE_HOSTS.has(host)) return null;
  else if (path[0] === 'watch') id = url.searchParams.get('v');
  else if (YOUTUBE_PATHS.has(path[0])) id = path[1];
  if (!YOUTUBE_ID.test(id ?? '')) return null;
  return { service: 'youtube', id, start: startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start')) };
}

function parseSpotify(host, path) {
  if (host !== 'open.spotify.com' && host !== 'play.spotify.com') return null;
  const [kind, id] = SPOTIFY_LANG.test(path[0] ?? '') ? path.slice(1) : path;
  if (!SPOTIFY_KINDS.has(kind) || !SPOTIFY_ID.test(id ?? '')) return null;
  return { service: 'spotify', kind, id };
}

function parseApple(url, host, path) {
  if (host !== 'music.apple.com') return null;
  const [country, kind, ...rest] = path;
  const id = rest.at(-1) ?? '';
  if (!APPLE_COUNTRY.test(country ?? '') || rest.length < 1 || rest.length > 2) return null;
  const validId = kind === 'playlist' ? APPLE_PLAYLIST.test(id) : (kind === 'album' || kind === 'song') && APPLE_NUMBER.test(id);
  if (!validId) return null;
  const song = url.searchParams.get('i');
  return { service: 'apple', kind, country, id, song: kind === 'album' && APPLE_NUMBER.test(song ?? '') ? song : null };
}

function parseYandex(host, path) {
  const domain = YANDEX_HOST.exec(host)?.[1];
  if (!domain) return null;
  const [album, track] = path[0] === 'album' && path[2] === 'track' ? [path[1], path[3]] : [null, path[0] === 'track' ? path[1] : null];
  if (path.length !== (album ? 4 : 2) || !YANDEX_NUMBER.test(track ?? '') || (album && !YANDEX_NUMBER.test(album))) return null;
  return { service: 'yandex', domain, album, track };
}

function parseUrl(url) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^(?:www\.|m\.)/, '');
  const path = url.pathname.split('/').filter(Boolean);
  return parseYoutube(url, host, path) ?? parseSpotify(host, path) ?? parseApple(url, host, path) ?? parseYandex(host, path);
}

/**
 * Находит ссылку на песню, даже если кнопка «Поделиться» скопировала её вместе с текстом.
 * @param {unknown} text
 * @returns {null | { service: 'youtube' | 'spotify' | 'apple' | 'yandex', [key: string]: string | number | null }}
 */
export function parseMusicLink(text) {
  if (typeof text !== 'string' || text.length > MUSIC_LINK_MAX_LENGTH) return null;
  for (const word of text.trim().split(/\s+/)) {
    const url = toUrl(word.replace(EDGE_PUNCTUATION, ''));
    const music = url && parseUrl(url);
    if (music) return music;
  }
  return null;
}

/**
 * Момент, с которого начнётся песня, из полей «мин» и «сек». Пустые поля — с самого начала (0), ошибка — null.
 * @returns {number | null} секунды
 */
export function readStartTime(minutes, seconds) {
  const min = String(minutes ?? '').trim();
  const sec = String(seconds ?? '').trim();
  if ((min && !START_MINUTES.test(min)) || (sec && !START_SECONDS.test(sec))) return null;
  const total = Number(min || 0) * SECONDS_PER_MINUTE + Number(sec || 0);
  return Number(sec || 0) < SECONDS_PER_MINUTE && total <= MAX_START_S ? total : null;
}

/** Секунды обратно в поля формы: 65 → «1» и «05», 0 → пустые поля. */
export function startParts(total) {
  if (!total) return { minutes: '', seconds: '' };
  return { minutes: String(Math.floor(total / SECONDS_PER_MINUTE)), seconds: String(total % SECONDS_PER_MINUTE).padStart(2, '0') };
}

/** Песня с другого момента. Начинать с середины умеет только YouTube: остальные без подписки играют свой отрывок. */
export function withStart(music, start) {
  return music && SERVICE_INFO[music.service].canStart ? { ...music, start } : music;
}

/** Чистая ссылка для базы: без меток отслеживания, читается обратно в то же самое. */
export function canonicalLink(music) {
  switch (music.service) {
    case 'youtube':
      return `https://www.youtube.com/watch?v=${music.id}${music.start ? `&t=${music.start}` : ''}`;
    case 'spotify':
      return `https://open.spotify.com/${music.kind}/${music.id}`;
    case 'apple':
      return `https://music.apple.com/${music.country}/${music.kind}/${music.id}${music.song ? `?i=${music.song}` : ''}`;
    default:
      return `https://music.yandex.${music.domain}/${music.album ? `album/${music.album}/` : ''}track/${music.track}`;
  }
}

function player(music) {
  switch (music.service) {
    case 'youtube':
      return { src: `https://www.youtube-nocookie.com/embed/${music.id}?rel=0&playsinline=1${music.start ? `&start=${music.start}` : ''}`, height: 0 };
    case 'spotify':
      return { src: `https://open.spotify.com/embed/${music.kind}/${music.id}`, height: music.kind === 'track' ? PLAYER_HEIGHT.spotifyTrack : PLAYER_HEIGHT.spotifyList };
    case 'apple': {
      const oneSong = music.kind === 'song' || Boolean(music.song);
      return { src: `https://embed.music.apple.com/${music.country}/${music.kind}/${music.id}${music.song ? `?i=${music.song}` : ''}`, height: oneSong ? PLAYER_HEIGHT.appleSong : PLAYER_HEIGHT.appleList };
    }
    default: {
      const base = `https://music.yandex.${music.domain}/iframe`;
      return { src: music.album ? `${base}/album/${music.album}/track/${music.track}` : `${base}/#track/${music.track}`, height: PLAYER_HEIGHT.yandex };
    }
  }
}

/**
 * Что вставить в страницу: адрес официального плеера, его высота и играет ли он песню целиком у любого слушателя.
 * Spotify, Apple Music и Яндекс без входа в аккаунт обычно дают только отрывок.
 * controlSrc — адрес плеера, которым страница может управлять (запустить песню сама): у YouTube и Spotify.
 */
export function musicEmbed(music) {
  if (!music) return null;
  const info = SERVICE_INFO[music.service];
  const { src, height } = player(music);
  return { service: music.service, ...info, src, height, controlSrc: info.autoplay ? `${src}${CONTROL_SUFFIX[music.service]}` : null };
}
