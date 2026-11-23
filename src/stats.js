import { DAY_MS } from './config.js';

/** За сколько последних дней админка показывает активации. */
export const STATS_DAYS = 30;
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' });
const NICE_STEPS = Object.freeze([1, 2, 5, 10]);

const dayKey = (ms) => DAY_KEY.format(ms);

/**
 * Сколько событий пришлось на каждый день по времени Алматы, за days дней до now включительно; сегодня последним.
 * @param {number[]} timestamps мс
 * @returns {{ key: string, label: string, count: number }[]}
 */
export function dailyCounts(timestamps, now, days = STATS_DAYS) {
  const tally = new Map();
  for (const ms of timestamps) tally.set(dayKey(ms), (tally.get(dayKey(ms)) ?? 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const key = dayKey(now - (days - 1 - index) * DAY_MS);
    const [, month, day] = key.split('-');
    return { key, label: `${day}.${month}`, count: tally.get(key) ?? 0 };
  });
}

/** Верх оси графика: ближайшее сверху круглое число вида 1, 2, 5 × 10ⁿ. */
export function niceAxisMax(max) {
  if (max <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  return NICE_STEPS.find((step) => step * power >= max) * power;
}
