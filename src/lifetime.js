import { DAY_MS } from './config.js';

/**
 * Сколько хранится открытка после активации. Срок задаёт партия кодов, админ может продлить
 * отдельную открытку или оставить её навсегда. days = null — навсегда (expires_at в базе пустой).
 */
export const DEFAULT_LIFETIME_DAYS = 7;
const FOREVER = 'forever';

export const LIFETIME_CHOICES = Object.freeze([
  Object.freeze({ value: '7', days: 7, label: '7 дней' }),
  Object.freeze({ value: '30', days: 30, label: '30 дней' }),
  Object.freeze({ value: '90', days: 90, label: '3 месяца' }),
  Object.freeze({ value: '365', days: 365, label: '1 год' }),
  Object.freeze({ value: FOREVER, days: null, label: 'Навсегда' }),
]);

/** Значение из формы → число дней, null (навсегда) или undefined, если такого варианта нет. */
export function parseLifetime(value) {
  const choice = LIFETIME_CHOICES.find((item) => item.value === String(value ?? ''));
  return choice ? choice.days : undefined;
}

/** Значение для <option>, отмеченное у партии с этим сроком. */
export const lifetimeValue = (days) => (days === null ? FOREVER : String(days));

/** @param {number | null} days @returns {number | null} */
export const lifetimeMs = (days) => (days === null ? null : days * DAY_MS);

function daysWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return 'день';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'дня';
  return 'дней';
}

/** «7 дней», «3 месяца», «Навсегда»; для нестандартного срока — «12 дней». */
export function lifetimeLabel(days) {
  const choice = LIFETIME_CHOICES.find((item) => item.days === days);
  return choice ? choice.label : `${days} ${daysWord(days)}`;
}

/** Фраза для покупателя перед активацией. */
export function lifetimeSentence(days) {
  return days === null ? 'Открытка будет храниться всегда.' : `Открытка будет доступна ${lifetimeLabel(days)}.`;
}

/** Продление считается от текущего срока, а если он уже прошёл — от сегодня. «Навсегда» не сокращается. */
const extendBy = (days) => (card, now) => (card.expiresAt === null ? null : Math.max(card.expiresAt, now) + days * DAY_MS);

/** Что админ может сделать со сроком одной активной открытки. */
export const CARD_TERMS = Object.freeze({
  'plus-7': Object.freeze({ label: '+7 дней', expiry: extendBy(7) }),
  'plus-30': Object.freeze({ label: '+30 дней', expiry: extendBy(30) }),
  'plus-365': Object.freeze({ label: '+1 год', expiry: extendBy(365) }),
  forever: Object.freeze({ label: 'Хранить навсегда', expiry: () => null }),
  // Только для открыток «навсегда»: устаревшая или поддельная форма не должна сократить обычный срок.
  'limit-7': Object.freeze({
    label: 'Убрать «навсегда»: 7 дней с сегодня',
    expiry: (card, now) => (card.expiresAt === null ? now + 7 * DAY_MS : undefined),
  }),
});

/** Новый срок открытки по кнопке из админки: число, null (навсегда) или undefined, если кнопка неизвестна или неприменима. */
export function termExpiry(term, card, now) {
  const key = String(term ?? '');
  return Object.hasOwn(CARD_TERMS, key) ? CARD_TERMS[key].expiry(card, now) : undefined;
}
