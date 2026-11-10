import { OCCASIONS } from '../raiko/texts.js';
import { LIMITS } from './config.js';
import { TIERS } from './tiers.js';

export const TEXT_LANGS = Object.freeze(['ru', 'kk']);
const ID_PATTERN = /^[a-z0-9-]+$/;
const DAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Almaty' });

/** Ошибки в одном поводе из raiko/texts.js; пустой массив, если всё верно. */
export function occasionProblems(occasion, seenIds = new Set()) {
  const where = `повод «${occasion?.id ?? '?'}»`;
  const problems = [];
  if (!ID_PATTERN.test(String(occasion?.id))) problems.push(`${where}: id только латиница, цифры и дефис`);
  else if (seenIds.has(occasion.id)) problems.push(`${where}: такой id уже есть`);
  if (!TEXT_LANGS.every((lang) => typeof occasion?.name?.[lang] === 'string' && occasion.name[lang])) {
    problems.push(`${where}: name нужен на ${TEXT_LANGS.join(' и ')}`);
  }
  if (occasion?.season !== undefined) {
    const valid = Array.isArray(occasion.season) && occasion.season.length === 2 && occasion.season.every((day) => DAY_PATTERN.test(day));
    if (!valid) problems.push(`${where}: season в виде ['ММ-ДД', 'ММ-ДД']`);
  }
  for (const tier of Object.keys(TIERS)) {
    for (const lang of TEXT_LANGS) {
      const list = occasion?.[tier]?.[lang];
      if (!Array.isArray(list) || list.length === 0) {
        problems.push(`${where}: нет текстов ${tier}.${lang}`);
        continue;
      }
      list.forEach((text, index) => {
        if (typeof text !== 'string' || !text.trim()) problems.push(`${where}: ${tier}.${lang} вариант ${index + 1} пустой`);
        else if ([...text].length > LIMITS.messageLength) {
          problems.push(`${where}: ${tier}.${lang} вариант ${index + 1} длиннее ${LIMITS.messageLength} символов`);
        }
      });
    }
  }
  return problems;
}

function buildOccasions(occasions) {
  const seen = new Set();
  const problems = occasions.flatMap((occasion) => {
    const found = occasionProblems(occasion, seen);
    seen.add(occasion?.id);
    return found;
  });
  if (problems.length > 0) throw new Error(`Ошибка в raiko/texts.js:\n${problems.join('\n')}`);
  return Object.freeze(occasions.map((occasion) => Object.freeze({ ...occasion })));
}

const ALL = buildOccasions(OCCASIONS);

/** Поводы с текстами нужного тарифа: [{ id, name, texts: { ru: [...], kk: [...] } }]. */
export function occasionsForTier(tierId) {
  const tier = TIERS[tierId] ? tierId : 'basic';
  return ALL.map(({ id, name, [tier]: texts }) => ({ id, name, texts }));
}

function inSeason([from, to], day) {
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

/** Повод, который выбран в форме сразу: ближайший праздник по календарю, иначе первый в списке. */
export function suggestedOccasion(timestamp) {
  const day = DAY_FORMAT.format(timestamp);
  return (ALL.find((occasion) => occasion.season && inSeason(occasion.season, day)) ?? ALL[0]).id;
}
