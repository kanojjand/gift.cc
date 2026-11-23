import { OCCASIONS } from '../raiko/texts.js';
import { LIMITS } from './config.js';

export const TEXT_LANGS = Object.freeze(['ru', 'kk']);
/** Наборы готовых текстов в raiko/texts.js: в форме сначала короткие, потом развёрнутые. */
const TEXT_SETS = Object.freeze(['short', 'long']);
const ID_PATTERN = /^[a-z0-9-]+$/;
const DAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Almaty' });

function textProblems(occasion, where) {
  return TEXT_SETS.flatMap((set) =>
    TEXT_LANGS.flatMap((lang) => {
      const list = occasion?.[set]?.[lang];
      if (!Array.isArray(list) || list.length === 0) return [`${where}: нет текстов ${set}.${lang}`];
      return list.flatMap((text, index) => {
        if (typeof text !== 'string' || !text.trim()) return [`${where}: ${set}.${lang} вариант ${index + 1} пустой`];
        if ([...text].length > LIMITS.messageLength) return [`${where}: ${set}.${lang} вариант ${index + 1} длиннее ${LIMITS.messageLength} символов`];
        return [];
      });
    }),
  );
}

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
  return [...problems, ...textProblems(occasion, where)];
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

const textsOf = (occasion) =>
  Object.freeze(Object.fromEntries(TEXT_LANGS.map((lang) => [lang, Object.freeze(TEXT_SETS.flatMap((set) => occasion[set][lang]))])));

/** Поводы с готовыми текстами для формы: [{ id, name, texts: { ru: [...], kk: [...] } }], короткие тексты первыми. */
export const OCCASION_TEXTS = Object.freeze(ALL.map((occasion) => Object.freeze({ id: occasion.id, name: occasion.name, texts: textsOf(occasion) })));

function inSeason([from, to], day) {
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

/** Повод, который выбран в форме сразу: ближайший праздник по календарю, иначе первый в списке. */
export function suggestedOccasion(timestamp) {
  const day = DAY_FORMAT.format(timestamp);
  return (ALL.find((occasion) => occasion.season && inSeason(occasion.season, day)) ?? ALL[0]).id;
}
