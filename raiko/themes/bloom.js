import { html, raw } from '../../src/views/html.js';

/** Цветение: бутон раскрывается в цветок, открытка свёрстана как журнал о флористике. */

const range = (count) => Array.from({ length: count }, (_, i) => i);
const BUD_TILT = 0.125;

/** Лепесток-капля с небольшой выемкой на конце; основание в точке 0,0, лепесток смотрит вверх. */
function petalPath(length, width) {
  const l = length;
  const w = width;
  return `M0 0 C${-w} ${-l * 0.28} ${-w * 0.92} ${-l * 0.86} ${-w * 0.28} ${-l * 0.98} Q0 ${-l * 0.9} ${w * 0.28} ${-l * 0.98} C${w * 0.92} ${-l * 0.86} ${w} ${-l * 0.28} 0 0Z`;
}

/** Слои цветка снаружи внутрь: число лепестков, длина, ширина, поворот, класс цвета. */
const LAYERS = [
  [9, 96, 40, 0, 'l1'],
  [7, 74, 32, 20, 'l2'],
  [5, 50, 24, 8, 'l3'],
];

function flowerPetals() {
  let index = 0;
  return LAYERS.map(([count, length, width, turn, className]) =>
    range(count)
      .map((i) => {
        const angle = turn + (360 / count) * i;
        /* В бутоне лепестки смотрят почти вверх: наклон к вертикали от -180° до 180°, ужатый в 8 раз. */
        const budAngle = (((angle + 180) % 360) - 180) * BUD_TILT;
        index += 1;
        return `<path class="petal ${className}" style="--a:${angle.toFixed(1)}deg;--b:${budAngle.toFixed(1)}deg;--i:${index}" d="${petalPath(length, width)}"/>`;
      })
      .join(''),
  ).join('');
}

const STAMENS = range(10)
  .map((i) => {
    const angle = (Math.PI * 2 * i) / 10;
    return `<circle class="stamen" cx="${(Math.cos(angle) * 9).toFixed(1)}" cy="${(Math.sin(angle) * 9).toFixed(1)}" r="2.4"/>`;
  })
  .join('');

const FLOWER = raw(`<svg class="bl-flower" viewBox="-130 -140 260 330" aria-hidden="true">
  <g class="stem-group">
    <path class="stem" d="M0 6 C-6 60 8 110 -2 186"/>
    <path class="leaf leaf-l" d="M-2 120 C-40 96 -70 104 -86 84 C-58 78 -24 90 -2 112Z"/>
    <path class="leaf leaf-r" d="M2 84 C36 58 64 64 82 42 C54 38 24 52 2 76Z"/>
  </g>
  <g class="bloom-head">${flowerPetals()}<circle class="core" r="15"/>${STAMENS}</g>
</svg>`);

/** Маленький раскрытый цветок для украшений (без анимации). */
function smallFlower(x, y, scale, className) {
  const petals = range(6).map((i) => `<path transform="rotate(${i * 60})" d="${petalPath(30, 14)}"/>`).join('');
  return `<g class="sf ${className}" transform="translate(${x} ${y}) scale(${scale})">${petals}<circle class="sf-core" r="6"/></g>`;
}

const SPRIG = raw(`<svg class="bl-sprig" viewBox="0 0 220 60" aria-hidden="true">
  <path class="sprig-line" d="M6 40 C60 28 120 44 214 22"/>
  ${range(6).map((i) => {
    const x = 28 + i * 32;
    const y = 36 - i * 2.6;
    const up = i % 2 === 0;
    return `<path class="sprig-leaf" d="M${x} ${y} c6 ${up ? -14 : 14} 18 ${up ? -16 : 16} 24 ${up ? -14 : 14} c-8 ${up ? 2 : -2} -16 ${up ? 8 : -8} -24 ${up ? 14 : -14}Z"/>`;
  }).join('')}
</svg>`);

const BOUQUET = raw(`<svg class="bl-bouquet" viewBox="-100 -90 200 190" aria-hidden="true">
  <path class="b-stem" d="M-30 0 L-4 92 M0 -10 L0 92 M34 2 L6 92"/>
  ${smallFlower(-34, -8, 1, 'c2')}${smallFlower(36, -2, 0.9, 'c3')}${smallFlower(0, -34, 1.15, 'c1')}
  <path class="b-wrap" d="M-34 50 L34 50 L14 96 L-14 96Z"/>
</svg>`);

const OUTLINE = (className) => raw(`<svg class="bl-outline ${className}" viewBox="-120 -120 240 240" aria-hidden="true">
  ${range(9).map((i) => `<path transform="rotate(${i * 40})" d="${petalPath(110, 44)}"/>`).join('')}
  ${range(6).map((i) => `<path transform="rotate(${i * 60 + 20})" d="${petalPath(70, 30)}"/>`).join('')}
</svg>`);

export default {
  gate: ({ recipient }) => html`
    <p class="bl-mast" aria-hidden="true"><span>Цветение</span><i></i><span>№ 01</span></p>
    <p class="gate-title">${recipient}</p>
    <button class="gate-btn bud" type="button" aria-label="Раскрыть бутон">${FLOWER}</button>
    <p class="gate-hint">Коснись бутона</p>`,

  backdrop: () => html`${OUTLINE('o1')}${OUTLINE('o2')}`,

  decor: {
    hello: () => html`<p class="bl-mast bl-mast-small" aria-hidden="true"><span>Для тебя</span><i></i><span>Выпуск о главном</span></p>`,
    message: () => html`<span class="bl-quote" aria-hidden="true">“</span>`,
    photos: () => raw(`<svg class="bl-mini" viewBox="-40 -40 80 80" aria-hidden="true">${smallFlower(0, 0, 1, 'c1')}</svg>`),
    closing: () => BOUQUET,
  },

  divider: () => SPRIG,

  closingLine: () => 'Пусть всё цветёт',
};
