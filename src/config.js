const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

export const LIMITS = Object.freeze({
  senderLength: 60,
  recipientLength: 60,
  messageLength: 1000,
  photoBytes: 1.5 * 1024 * 1024,
  songBytes: 60 * 1024 * 1024,
  batchSize: 500,
  songSlots: 3,
});

export const LIFETIME = Object.freeze({
  activeMs: 7 * DAY_MS,
  abandonedDraftMs: 7 * DAY_MS,
});

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

function parseBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_BASE_URL должен начинаться с http:// или https://');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  const adminPassword = requireEnv(env, 'ADMIN_PASSWORD');
  const sessionSecret = requireEnv(env, 'SESSION_SECRET');
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET должен быть не короче ${MIN_SECRET_LENGTH} символов`);
  }
  const baseUrl = parseBaseUrl(env.PUBLIC_BASE_URL || 'http://localhost:3000');
  return Object.freeze({
    adminPassword,
    sessionSecret,
    baseUrl,
    origin: new URL(baseUrl).origin,
    secureCookies: baseUrl.startsWith('https:'),
    port: Number(env.PORT) || 3000,
    dataDir: env.DATA_DIR || './data',
    trustProxy: env.TRUST_PROXY === '1',
  });
}
