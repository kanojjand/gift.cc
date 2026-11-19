import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DESIGNS } from '../raiko/templates.js';

const BASIC_PHOTOS = 3;
const PREMIUM_PHOTOS = 5;
const FX = new Set(['none', 'petals', 'stars', 'gold', 'snow', 'confetti', 'hearts', 'sparkle']);
const ID_PATTERN = /^[a-z0-9-]+$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const LABEL_KEYS = ['eyebrow', 'from', 'photos'];
/** Цвета палитры. accent3 необязателен: без него берётся accent. */
const PALETTE_COLORS = ['bg', 'bg2', 'ink', 'accent', 'accent2'];
const LIGHT_LUMINANCE = 0.5;

export const TIERS = Object.freeze({
  basic: Object.freeze({ id: 'basic', label: 'Базовый', maxPhotos: BASIC_PHOTOS }),
  premium: Object.freeze({ id: 'premium', label: 'Премиум', maxPhotos: PREMIUM_PHOTOS }),
});

export const MAX_PHOTOS_ANY = PREMIUM_PHOTOS;

export function getTier(id) {
  return Object.hasOwn(TIERS, String(id)) ? TIERS[id] : null;
}

const cssExists = (id) => existsSync(fileURLToPath(new URL(`../raiko/assets/css/${id}.css`, import.meta.url)));
const isColor = (value) => COLOR_PATTERN.test(String(value));

function paletteProblems(palettes, where) {
  if (palettes === undefined) return [];
  if (!Array.isArray(palettes) || palettes.length === 0) return [`${where}: palettes список хотя бы из одной палитры`];
  const seen = new Set();
  return palettes.flatMap((palette, index) => {
    const at = `${where}, палитра ${index + 1}`;
    const problems = [];
    if (!ID_PATTERN.test(String(palette?.id))) problems.push(`${at}: id только латиница, цифры и дефис`);
    else if (seen.has(palette.id)) problems.push(`${at}: такой id уже есть`);
    seen.add(palette?.id);
    if (!palette?.name) problems.push(`${at}: нужен name`);
    const badColors = PALETTE_COLORS.filter((key) => !isColor(palette?.[key]));
    if (palette?.accent3 !== undefined && !isColor(palette.accent3)) badColors.push('accent3');
    if (badColors.length) problems.push(`${at}: ${badColors.join(', ')} в виде #rrggbb`);
    return problems;
  });
}

/** Ошибки в одном шаблоне из raiko/templates.js; пустой массив, если всё верно. */
export function designProblems(design, seenIds = new Set()) {
  const where = `шаблон «${design?.id ?? '?'}»`;
  const problems = [];
  if (!ID_PATTERN.test(String(design?.id))) problems.push(`${where}: id только латиница, цифры и дефис`);
  else if (seenIds.has(design.id)) problems.push(`${where}: такой id уже есть`);
  else if (!cssExists(design.id)) problems.push(`${where}: нет файла raiko/assets/css/${design.id}.css`);
  if (!getTier(design?.tier)) problems.push(`${where}: tier должен быть 'basic' или 'premium'`);
  if (!design?.name || !design?.blurb) problems.push(`${where}: нужны name и blurb`);
  if (!design?.palettes && (!isColor(design?.accent) || !isColor(design?.bg))) {
    problems.push(`${where}: accent и bg в виде #rrggbb (или список palettes)`);
  }
  problems.push(...paletteProblems(design?.palettes, where));
  if (!FX.has(design?.fx)) problems.push(`${where}: fx одно из ${[...FX].join(', ')}`);
  if (!Number.isFinite(design?.openMs) || design.openMs < 0) problems.push(`${where}: openMs число миллисекунд`);
  if (typeof design?.fonts !== 'string') problems.push(`${where}: fonts строка Google Fonts`);
  if (!LABEL_KEYS.every((key) => typeof design?.labels?.[key] === 'string')) {
    problems.push(`${where}: labels нужны ${LABEL_KEYS.join(', ')}`);
  }
  return problems;
}

/** Светлый или тёмный фон: от этого зависят стекло, тени и цвет кнопок. */
function toneOf(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > LIGHT_LUMINANCE ? 'light' : 'dark';
}

function buildPalette(palette) {
  return Object.freeze({ ...palette, accent3: palette.accent3 ?? palette.accent, tone: toneOf(palette.bg) });
}

function buildTemplate(design) {
  const palettes = Object.freeze((design.palettes ?? []).map(buildPalette));
  const first = palettes[0];
  return Object.freeze({
    ...design,
    bg: design.bg ?? first.bg,
    accent: design.accent ?? first.accent,
    palettes,
    retired: design.retired === true,
    labels: Object.freeze({ ...design.labels }),
    maxPhotos: TIERS[design.tier].maxPhotos,
  });
}

function buildTemplates(designs) {
  const seen = new Set();
  const problems = designs.flatMap((design) => {
    const found = designProblems(design, seen);
    seen.add(design?.id);
    return found;
  });
  if (problems.length > 0) throw new Error(`Ошибка в raiko/templates.js:\n${problems.join('\n')}`);
  return Object.freeze(designs.map(buildTemplate));
}

/** Все шаблоны, включая архивные: старые открытки должны открываться и дальше. */
export const TEMPLATES = buildTemplates(DESIGNS);
/** Шаблоны, которые сейчас можно выбрать в каталоге. */
export const CATALOG = Object.freeze(TEMPLATES.filter((template) => !template.retired));

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export function getTemplate(id) {
  return BY_ID.get(String(id)) ?? null;
}

/** Палитра шаблона по id; если такой нет, первая. У старых шаблонов палитр нет: null. */
export function getPalette(template, paletteId) {
  if (!template?.palettes.length) return null;
  return template.palettes.find((palette) => palette.id === paletteId) ?? template.palettes[0];
}

export function isPaletteAllowed(template, paletteId) {
  if (!template?.palettes.length) return !paletteId;
  return template.palettes.some((palette) => palette.id === paletteId);
}

/** Базовый код открывает обычные шаблоны, премиум — все. Порядок как в raiko/templates.js: сезонные темы первыми. */
export function templatesForTier(tierId) {
  if (tierId === 'premium') return CATALOG;
  return CATALOG.filter((template) => template.tier === 'basic');
}

export function isTemplateAllowed(template, tierId) {
  return templatesForTier(tierId).some((allowed) => allowed.id === template?.id);
}
