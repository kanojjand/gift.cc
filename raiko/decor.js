import { html, raw } from '../src/views/html.js';
import { HORN_PATH } from './gates.js';

const svg = (className, viewBox, body) => raw(`<svg class="${className}" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`);
const range = (count) => Array.from({ length: count }, (_, i) => i);

function petals(cx, cy, count, rx, ry, offset, fill, opacity = 1, turn = 0) {
  return range(count)
    .map((i) => `<ellipse cx="${cx}" cy="${cy - offset}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" transform="rotate(${(360 / count) * i + turn} ${cx} ${cy})"/>`)
    .join('');
}

function rose(cx, cy, size, [outer, middle, inner]) {
  return `${petals(cx, cy, 6, size * 0.5, size * 0.62, size * 0.56, outer)}
    ${petals(cx, cy, 5, size * 0.4, size * 0.48, size * 0.32, middle, 1, 30)}
    ${petals(cx, cy, 4, size * 0.26, size * 0.32, size * 0.14, inner, 1, 15)}
    <circle cx="${cx}" cy="${cy}" r="${size * 0.13}" fill="${outer}"/>`;
}

function sprig(x, y, angle, scale, color) {
  const leaves = range(5)
    .map((i) => {
      const at = 34 + i * 38;
      const side = i % 2 ? 1 : -1;
      return `<path transform="translate(${at} 0) rotate(${side * 42})" fill="${color}" d="M0 0 C18 -18 56 -18 78 0 C56 18 18 18 0 0Z"/>`;
    })
    .join('');
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><path d="M0 0 H230" stroke="${color}" stroke-width="4" fill="none"/>${leaves}<path transform="translate(226 0)" fill="${color}" d="M0 0 C18 -16 50 -16 70 0 C50 16 18 16 0 0Z"/></g>`;
}

function tulipShape(x, base, scale, color) {
  return `<g transform="translate(${x} ${base}) scale(${scale})">
    <path d="M0 0 C-3 -40 3 -80 0 -118" fill="none" stroke="#4f9d69" stroke-width="7" stroke-linecap="round"/>
    <path d="M0 -6 C-40 -28 -48 -74 -40 -104 C-22 -84 -6 -52 0 -24Z" fill="#6bb583"/>
    <path d="M0 -2 C36 -24 46 -62 40 -90 C22 -72 6 -44 0 -20Z" fill="#5aa775"/>
    <path d="M-27 -162 C-34 -124 -22 -108 0 -106 C22 -108 34 -124 27 -162 L13 -140 L0 -168 L-13 -140Z" fill="${color}"/>
  </g>`;
}

const TULIP_ROW = [
  [20, 215, 0.62, '#f783ac'], [78, 225, 0.8, '#e64980'], [138, 215, 0.66, '#fcc2d7'], [200, 230, 0.92, '#d6336c'],
  [262, 215, 0.64, '#f783ac'], [322, 225, 0.82, '#e64980'], [382, 215, 0.6, '#fcc2d7'],
];

const horn = (x, y, angle = 0, scale = 1) => `<path d="${HORN_PATH}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" fill="none" stroke="currentColor" stroke-width="2"/>`;

function perforation(width, height, color) {
  const horizontal = range(9).flatMap((i) => [`<circle cx="${i * 12.5}" cy="0" r="4" fill="${color}"/>`, `<circle cx="${i * 12.5}" cy="${height}" r="4" fill="${color}"/>`]);
  const vertical = range(11).flatMap((i) => [`<circle cx="0" cy="${i * 12.4}" r="4" fill="${color}"/>`, `<circle cx="${width}" cy="${i * 12.4}" r="4" fill="${color}"/>`]);
  return [...horizontal, ...vertical].join('');
}

const STAMP = svg('stamp', '0 0 100 124', `<rect width="100" height="124" fill="#f4dcc0"/>${perforation(100, 124, '#fffaf2')}
  <rect x="11" y="11" width="78" height="102" fill="#8c2f39"/>${petals(50, 58, 7, 11, 17, 19, '#f7dcc0')}<circle cx="50" cy="58" r="10" fill="#e9b949"/>`);
const POSTMARK = svg('postmark', '0 0 150 90', `<g fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="45" cy="45" r="40"/><circle cx="45" cy="45" r="30"/>
  ${range(4).map((i) => `<path d="M88 ${24 + i * 14} q15 -8 30 0 t30 0"/>`).join('')}</g>`);
const PAPERCLIP = svg('paperclip', '0 0 70 150', '<path d="M34 12 V112 a15 15 0 0 0 30 0 V30 a10 10 0 0 0 -20 0 V104" transform="translate(-14 0)" fill="none" stroke="#8a8f94" stroke-width="5" stroke-linecap="round"/>');
const HEART = svg('doodle doodle-heart', '0 0 60 56', '<path d="M30 50 C6 32 2 20 8 11 C15 2 26 6 30 16 C35 5 47 2 53 11 C58 21 53 33 30 50Z" fill="none" stroke="#c0392b" stroke-width="3.5" stroke-linejoin="round"/>');
const STAR = svg('doodle doodle-star', '0 0 60 60', '<path d="M30 5 L37 24 L56 25 L41 37 L46 55 L30 45 L14 55 L19 37 L4 25 L23 24Z" fill="#f4c542" stroke="#7a4a21" stroke-width="2.5" stroke-linejoin="round"/>');
const BRUSH = svg('brush', '0 0 400 130', `<g fill="#f2b5cc"><path opacity=".7" d="M14 70 C70 22 180 30 250 26 C320 22 372 34 392 58 C360 92 280 98 196 104 C120 110 44 110 14 70Z"/></g>
  <path opacity=".55" fill="#d7bdf0" d="M40 88 C110 60 230 62 372 44 C350 100 230 122 120 118 C80 116 50 106 40 88Z"/>`);
const WATER_FLOWERS = svg('water-flowers', '0 0 240 170', `${petals(70, 80, 7, 24, 42, 42, '#ef8fb1', 0.55)}<circle cx="70" cy="80" r="15" fill="#e9b949" opacity=".85"/>
  ${petals(172, 58, 6, 17, 30, 30, '#b79be8', 0.55)}<circle cx="172" cy="58" r="10" fill="#f0c674" opacity=".85"/>
  ${petals(170, 132, 6, 12, 22, 22, '#f5a97f', 0.55)}<circle cx="170" cy="132" r="7" fill="#f0c674" opacity=".85"/>`);
const FAN = svg('fan', '0 0 300 150', `<g fill="none" stroke="currentColor">${range(19).map((i) => {
  const angle = (Math.PI * (i + 0.5)) / 19;
  const reach = i % 2 ? 148 : 118;
  return `<path stroke-width="1.2" d="M${(150 + Math.cos(angle) * 34).toFixed(1)} ${(150 - Math.sin(angle) * 34).toFixed(1)} L${(150 + Math.cos(angle) * reach).toFixed(1)} ${(150 - Math.sin(angle) * reach).toFixed(1)}"/>`;
}).join('')}<path stroke-width="1.5" d="M116 150 a34 34 0 0 1 68 0"/></g>`);
const PEONY = svg('peony', '0 0 200 200', rose(100, 100, 62, ['#e7a6b5', '#f3c6cf', '#fbe3e6']));
const PRESSED_LEAF = svg('pressed-leaf', '0 0 300 120', sprig(10, 60, 0, 0.92, '#3f7d68'));
const RED_ROSE = svg('rose', '0 0 240 240', `${sprig(118, 150, 62, 0.42, '#3d6b4f')}${sprig(118, 150, 120, 0.42, '#325c43')}${rose(120, 110, 66, ['#a61e3e', '#c9304f', '#e6607a'])}`);
const CONSTELLATION = svg('constellation', '0 0 300 120', (() => {
  const points = [[18, 92], [70, 46], [128, 72], [176, 22], [236, 54], [284, 16]];
  const line = points.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polyline points="${line}" fill="none" stroke="#f5c66b" stroke-width="1" opacity=".55"/>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff3d0"/>`).join('')}`;
})());
const MEDALLION = svg('medallion', '-130 -130 260 260', `<g color="#e8c36a"><circle r="122" fill="none" stroke="currentColor" stroke-width="2"/><circle r="110" fill="none" stroke="currentColor" stroke-width="1"/>
  ${range(12).map((i) => `<g transform="rotate(${i * 30})">${horn(0, -106, 0, 0.62)}</g>`).join('')}</g>`);
const HORN_CORNER = svg('horn-row', '0 0 240 40', `<g color="#e8c36a">${range(5).map((i) => horn(24 + i * 48, 2, 0, 0.9)).join('')}</g>`);

const hornBand = (className) => raw(`<svg class="horn-band ${className}" aria-hidden="true"><defs><pattern id="${className}-p" width="62" height="42" patternUnits="userSpaceOnUse">
  ${horn(31, 3, 0, 1)}</pattern></defs><rect width="100%" height="100%" fill="url(#${className}-p)"/></svg>`);

const BACKDROPS = {
  envelope: () => html`<i class="airmail airmail-top"></i><i class="airmail airmail-bottom"></i>`,
  tulips: () => html`<i class="sun"></i>${svg('garden-row', '0 0 400 240', `<path d="M0 210 C90 180 170 232 260 206 C320 190 370 200 400 212 V240 H0Z" fill="#9fd3ad"/>${TULIP_ROW.map(([x, base, scale, color]) => tulipShape(x, base, scale, color)).join('')}`)}`,
  night: () => html`<i class="big-moon"></i>${svg('mountains', '0 0 400 170', '<path fill="#1a2353" d="M0 170 V96 L66 42 L128 104 L196 26 L276 110 L336 64 L400 112 V170Z"/><path fill="#111838" d="M0 170 V136 L90 92 L174 140 L262 98 L344 142 L400 120 V170Z"/>')}`,
  polaroid: () => '',
  watercolor: () => html`<i class="wash w1"></i><i class="wash w2"></i><i class="wash w3"></i>`,
  gold: () => '',
  garden: () => raw(`<svg class="vine vine-top" viewBox="0 0 300 300" aria-hidden="true">${sprig(-10, 30, 18, 1, '#1f5546')}${sprig(20, -6, 58, 0.9, '#2b6d59')}</svg><svg class="vine vine-bottom" viewBox="0 0 300 300" aria-hidden="true">${sprig(-10, 30, 18, 1, '#1f5546')}${sprig(20, -6, 58, 0.9, '#2b6d59')}</svg>`),
  cinema: () => html`<i class="spot spot-l"></i><i class="spot spot-r"></i>`,
  silk: () => svg('valance', '0 0 400 90', `<rect width="400" height="34" fill="#6f1630"/>${range(5).map((i) => `<path d="M${i * 80} 28 q40 58 80 0" fill="#8f1f3f" stroke="#e9c98f" stroke-width="2.5"/>`).join('')}`),
  ornament: () => html`${hornBand('band-top')}${hornBand('band-bottom')}`,
};

const initialSeal = ({ initial }) => html`<span class="wax" aria-hidden="true">${initial}</span>`;

const SCENE_DECOR = {
  envelope: { hello: () => html`${STAMP}${POSTMARK}`, photos: () => PAPERCLIP, closing: initialSeal },
  tulips: { message: () => svg('corner-tulip', '-60 -180 120 190', tulipShape(0, 0, 1, '#e64980')) },
  night: { hello: () => CONSTELLATION, photos: () => html`<i class="orbit" aria-hidden="true"><b></b></i>` },
  polaroid: { hello: () => html`${HEART}${STAR}`, message: () => html`<i class="tape-strip" aria-hidden="true"></i>`, photos: () => html`<i class="string" aria-hidden="true"></i>`, closing: () => HEART },
  watercolor: { hello: () => BRUSH, message: () => WATER_FLOWERS, closing: () => WATER_FLOWERS },
  gold: { hello: () => FAN, closing: () => FAN },
  garden: { hello: () => PEONY, message: () => PRESSED_LEAF, closing: () => PEONY },
  cinema: { hello: () => html`<p class="poster-tag">Премьера · один сеанс · только для тебя</p><p class="poster-stars" aria-hidden="true">★ ★ ★ ★ ★</p>` },
  silk: { hello: () => RED_ROSE, closing: () => RED_ROSE },
  ornament: { hello: () => MEDALLION, message: () => HORN_CORNER, closing: () => MEDALLION },
};

const CLOSING_LINES = {
  envelope: 'Запечатано с любовью',
  tulips: 'Пусть всё цветёт!',
  night: 'Пусть всё сбудется',
  polaroid: 'Хранить на память',
  watercolor: 'Пусть день будет ярким',
  gold: 'С наилучшими пожеланиями',
  garden: 'Пусть всё расцветает',
  cinema: 'Конец. Продолжение следует…',
  silk: 'Занавес',
  ornament: 'Бақытты бол!',
};

export function renderBackdrop(templateId) {
  return BACKDROPS[templateId]();
}

/**
 * @param {string} templateId
 * @param {'hello' | 'message' | 'photos' | 'closing'} scene
 * @param {{ initial: string }} data
 */
export function renderSceneDecor(templateId, scene, data) {
  return SCENE_DECOR[templateId][scene]?.(data) ?? '';
}

export function closingLine(templateId) {
  return CLOSING_LINES[templateId];
}
