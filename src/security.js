import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConnInfo } from '@hono/node-server/conninfo';

const MAX_TRACKED_KEYS = 20000;
const IPV6_GROUPS = 8;
const IPV6_NETWORK_GROUPS = 4;
const SESSION_MS = 12 * 60 * 60 * 1000;

export const SESSION_MAX_AGE_SECONDS = SESSION_MS / 1000;

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const left = createHmac('sha256', 'compare').update(a).digest();
  const right = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(left, right);
}

export function passwordMatches(input, expected) {
  return safeEqual(String(input ?? ''), expected);
}

export function createSession(secret, now) {
  const expires = String(now + SESSION_MS);
  return `${expires}.${sign(expires, secret)}`;
}

export function isSessionValid(token, secret, now) {
  const [expires, signature, extra] = String(token ?? '').split('.');
  if (!expires || !signature || extra !== undefined) return false;
  return safeEqual(signature, sign(expires, secret)) && Number(expires) > now;
}

function dropExpired(hits, now) {
  [...hits].filter(([, entry]) => entry.resetAt <= now).forEach(([key]) => hits.delete(key));
}

export function createRateLimiter({ windowMs, max, maxKeys = MAX_TRACKED_KEYS }) {
  const hits = new Map();
  return (key, now) => {
    if (!hits.has(key) && hits.size >= maxKeys) dropExpired(hits, now);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry && hits.size >= maxKeys) return false;
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    hits.set(key, { ...entry, count: entry.count + 1 });
    return entry.count < max;
  };
}

/** Клиенту с IPv6 обычно выдают целую сеть /64, поэтому лимит считается на сеть, а не на адрес. */
export function rateLimitKey(ip) {
  if (!ip.includes(':')) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split('%')[0].split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = Math.max(IPV6_GROUPS - headParts.length - tailParts.length, 0);
  const groups = [...headParts, ...Array(missing).fill('0'), ...tailParts];
  return `${groups.slice(0, IPV6_NETWORK_GROUPS).map((group) => group.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

function remoteAddress(c, trustProxy) {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',').pop().trim();
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function clientIp(c, trustProxy) {
  return rateLimitKey(remoteAddress(c, trustProxy));
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export async function securityHeaders(c, next) {
  await next();
  c.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Robots-Tag', 'noindex, nofollow');
}
