import { MARK } from './brand.js';
import { codeMatrix, markBox, markPlacement } from './qr.js';

/**
 * Стили QR-кода «как в Instagram и Telegram»: круглые точки, скруглённые «глаза», градиенты.
 * Код остаётся с коррекцией H и знаком CC Lab в центре; цвета подобраны тёмными на светлом фоне,
 * чтобы камера читала их так же уверенно, как чёрно-белый.
 */
export const QR_STYLES = Object.freeze({
  classic: { name: 'Классика', dot: 'square', eye: 'square', colors: ['#000000'], bg: '#ffffff' },
  dots: { name: 'Точки', dot: 'dot', eye: 'round', colors: ['#141414'], bg: '#ffffff' },
  rounded: { name: 'Скруглённый', dot: 'round', eye: 'round', colors: ['#141414'], bg: '#ffffff' },
  insta: { name: 'Как в Instagram', dot: 'round', eye: 'round', colors: ['#f58529', '#dd2a7b', '#8134af', '#515bd4'], bg: '#ffffff' },
  telegram: { name: 'Как в Telegram', dot: 'dot', eye: 'round', colors: ['#1478c2', '#0e4f8c'], bg: '#ffffff' },
  rose: { name: 'Роза и золото', dot: 'dot', eye: 'round', colors: ['#a3324f', '#6b1530'], eyeColor: '#a67c2e', bg: '#fff8f5' },
});

const FINDER = 7;
const r4 = (value) => Number(value.toFixed(3));

function inFinder(x, y, size) {
  const corner = (cx, cy) => x >= cx && x < cx + FINDER && y >= cy && y < cy + FINDER;
  return corner(0, 0) || corner(size - FINDER, 0) || corner(0, size - FINDER);
}

function moduleShape(kind, x, y) {
  if (kind === 'dot') return `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.48"/>`;
  if (kind === 'round') return `<rect x="${x + 0.06}" y="${y + 0.06}" width="0.88" height="0.88" rx="0.3"/>`;
  return `<rect x="${x}" y="${y}" width="1" height="1"/>`;
}

/** «Глаз» в углу: внешнее кольцо 7×7 и центр 3×3 нужной формы. */
function eye(kind, x, y, fill) {
  if (kind === 'circle') {
    return `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3" fill="none" stroke="${fill}" stroke-width="1"/><circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5" fill="${fill}"/>`;
  }
  const rx = kind === 'round' ? [2, 1] : [0, 0];
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${rx[0]}" fill="none" stroke="${fill}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${rx[1]}" fill="${fill}"/>`;
}

/**
 * QR в выбранном стиле, SVG.
 * @param {string} text
 * @param {keyof typeof QR_STYLES} styleId
 * @param {{ margin?: number }} [options] тихая зона в модулях
 */
export function qrStyledSvg(text, styleId = 'classic', { margin = 2 } = {}) {
  const style = QR_STYLES[styleId] ?? QR_STYLES.classic;
  const { size, isDark } = codeMatrix(text);
  const box = markBox(size);
  const mark = markPlacement(box);
  const full = size + margin * 2;
  const gradient = style.colors.length > 1;
  const gradientId = `qr-fill-${styleId}`;
  const fill = gradient ? `url(#${gradientId})` : style.colors[0];
  const eyeFill = style.eyeColor ?? fill;

  let dots = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isDark(x, y) && !box.covers(x, y) && !inFinder(x, y, size)) dots += moduleShape(style.dot, x, y);
    }
  }
  const eyes = [[0, 0], [size - FINDER, 0], [0, size - FINDER]].map(([x, y]) => eye(style.eye, x, y, eyeFill)).join('');
  const stops = style.colors.map((color, i) => `<stop offset="${r4(i / (style.colors.length - 1 || 1))}" stop-color="${color}"/>`).join('');
  const defs = gradient ? `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>` : '';
  const markTransform = `translate(${r4(mark.x)} ${r4(mark.y)}) scale(${r4(mark.scale)})`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}">${defs}` +
    `<rect width="${full}" height="${full}" fill="${style.bg}" rx="${style.dot === 'square' ? 0 : 2}"/>` +
    `<g transform="translate(${margin} ${margin})"><g fill="${fill}">${dots}</g>${eyes}` +
    `<g fill="${eyeFill}" transform="${markTransform}">${MARK.paths}</g></g></svg>`
  );
}
