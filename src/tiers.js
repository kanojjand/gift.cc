import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DESIGNS } from '../raiko/templates.js';

const BASIC_PHOTOS = 3;
const PREMIUM_PHOTOS = 5;
const FX = new Set(['none', 'petals', 'stars', 'gold']);
const ID_PATTERN = /^[a-z0-9-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const LABEL_KEYS = ['eyebrow', 'from', 'photos'];

export const TIERS = Object.freeze({
  basic: Object.freeze({ id: 'basic', label: 'Базовый', maxPhotos: BASIC_PHOTOS }),
  premium: Object.freeze({ id: 'premium', label: 'Премиум', maxPhotos: PREMIUM_PHOTOS }),
});

export const MAX_PHOTOS_ANY = PREMIUM_PHOTOS;

export function getTier(id) {
  return Object.hasOwn(TIERS, String(id)) ? TIERS[id] : null;
}

const cssExists = (id) => existsSync(fileURLToPath(new URL(`../raiko/assets/css/${id}.css`, import.meta.url)));

/** Ошибки в одном шаблоне из raiko/templates.js; пустой массив, если всё верно. */
export function designProblems(design, seenIds = new Set()) {
  const where = `шаблон «${design?.id ?? '?'}»`;
  const problems = [];
  if (!ID_PATTERN.test(String(design?.id))) problems.push(`${where}: id только латиница, цифры и дефис`);
  else if (seenIds.has(design.id)) problems.push(`${where}: такой id уже есть`);
  else if (!cssExists(design.id)) problems.push(`${where}: нет файла raiko/assets/css/${design.id}.css`);
  if (!getTier(design?.tier)) problems.push(`${where}: tier должен быть 'basic' или 'premium'`);
  if (!design?.name || !design?.blurb) problems.push(`${where}: нужны name и blurb`);
  if (!COLOR_PATTERN.test(String(design?.accent)) || !COLOR_PATTERN.test(String(design?.bg))) {
    problems.push(`${where}: accent и bg в виде #rrggbb`);
  }
  if (!FX.has(design?.fx)) problems.push(`${where}: fx одно из ${[...FX].join(', ')}`);
  if (!Number.isFinite(design?.openMs) || design.openMs < 0) problems.push(`${where}: openMs число миллисекунд`);
  if (typeof design?.fonts !== 'string') problems.push(`${where}: fonts строка Google Fonts`);
  if (!LABEL_KEYS.every((key) => typeof design?.labels?.[key] === 'string')) {
    problems.push(`${where}: labels нужны ${LABEL_KEYS.join(', ')}`);
  }
  return problems;
}

function buildTemplates(designs) {
  const seen = new Set();
  const problems = designs.flatMap((design) => {
    const found = designProblems(design, seen);
    seen.add(design?.id);
    return found;
  });
  if (problems.length > 0) throw new Error(`Ошибка в raiko/templates.js:\n${problems.join('\n')}`);
  return Object.freeze(
    designs.map((design) =>
      Object.freeze({ ...design, labels: Object.freeze({ ...design.labels }), maxPhotos: TIERS[design.tier].maxPhotos }),
    ),
  );
}

export const TEMPLATES = buildTemplates(DESIGNS);

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export function getTemplate(id) {
  return BY_ID.get(String(id)) ?? null;
}

/** Базовый код открывает обычные шаблоны, премиум — все, премиальные идут первыми. */
export function templatesForTier(tierId) {
  const basicTemplates = TEMPLATES.filter((template) => template.tier === 'basic');
  if (tierId !== 'premium') return basicTemplates;
  return [...TEMPLATES.filter((template) => template.tier === 'premium'), ...basicTemplates];
}

export function isTemplateAllowed(template, tierId) {
  return templatesForTier(tierId).some((allowed) => allowed.id === template?.id);
}
