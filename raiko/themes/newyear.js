import { html, raw } from '../../src/views/html.js';

/** Новый год: снежный шар. Нажатие трясёт шар, снег закручивается, камера «влетает» внутрь. */

const range = (count) => Array.from({ length: count }, (_, i) => i);
const GLOBE_FLAKES = 26;
const GARLAND_BULBS = 11;

/** Детерминированный «случайный» разброс от 0 до 1: одинаковый при каждой отрисовке, без Math.random на сервере. */
const spread = (i, salt) => {
  const value = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function fir(x, base, scale, className) {
  return `<g class="${className}" transform="translate(${x} ${base}) scale(${scale})">
    <path d="M0 -92 L22 -58 H11 L30 -30 H15 L36 0 H-36 L-15 -30 H-30 L-11 -58 H-22Z"/>
    <rect x="-5" y="0" width="10" height="10" class="trunk"/>
  </g>`;
}

const GLOBE_SCENE = raw(`<svg class="globe-scene" viewBox="0 0 200 200" aria-hidden="true">
  <path class="hill-far" d="M0 140 C40 118 80 128 110 120 C140 112 170 122 200 116 V200 H0Z"/>
  ${fir(46, 150, 0.72, 'tree tree-far')}${fir(160, 146, 0.62, 'tree tree-far')}
  <g class="house" transform="translate(98 134)">
    <path class="roof" d="M-30 -22 L0 -48 L30 -22Z"/><rect class="wall" x="-24" y="-22" width="48" height="34"/>
    <rect class="window" x="-14" y="-12" width="12" height="12"/><rect class="window" x="4" y="-12" width="12" height="12"/>
    <path class="roof-snow" d="M-33 -21 L0 -51 L33 -21 L28 -21 L0 -45 L-28 -21Z"/>
  </g>
  ${fir(30, 176, 1, 'tree')}${fir(172, 178, 1.12, 'tree')}
  <path class="star" transform="translate(172 72) scale(.5)" d="M0 -20 L6 -6 L21 -6 L9 3 L13 18 L0 9 L-13 18 L-9 3 L-21 -6 L-6 -6Z"/>
  <path class="ground" d="M0 168 C50 154 110 172 200 160 V200 H0Z"/>
</svg>`);

const globeFlakes = () =>
  raw(range(GLOBE_FLAKES)
    .map((i) => `<i style="--x:${(spread(i, 1) * 100).toFixed(1)}%;--s:${(2 + spread(i, 2) * 4).toFixed(1)}px;--d:${(4 + spread(i, 3) * 5).toFixed(2)}s;--delay:-${(spread(i, 4) * 8).toFixed(2)}s"></i>`)
    .join(''));

const SNOWFLAKE = raw(`<svg class="ny-flake" viewBox="-20 -20 40 40" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
  ${range(6).map((i) => `<g transform="rotate(${i * 60})"><path d="M0 0 V-17"/><path d="M0 -10 L-5 -15 M0 -10 L5 -15"/></g>`).join('')}</g></svg>`);

function garland() {
  const bulbs = range(GARLAND_BULBS).map((i) => {
    const t = i / (GARLAND_BULBS - 1);
    const x = 10 + t * 380;
    const y = 18 + Math.sin(t * Math.PI) * 34 + (i % 2) * 4;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-3" y="-4" width="6" height="6" class="cap"/><ellipse class="bulb b${i % 3}" style="--i:${i}" cx="0" cy="9" rx="6" ry="9"/></g>`;
  });
  return raw(`<svg class="ny-garland" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
    <path class="wire" d="M0 14 Q200 74 400 14"/>${bulbs.join('')}</svg>`);
}

const BAUBLE = raw(`<svg class="ny-bauble" viewBox="0 0 80 140" aria-hidden="true">
  <path class="string" d="M40 0 V48"/><rect class="cap" x="32" y="46" width="16" height="10" rx="2"/>
  <circle class="ball" cx="40" cy="92" r="36"/>
  <path class="band" d="M6 84 Q40 98 74 84 L74 96 Q40 110 6 96Z"/>
  <ellipse class="shine" cx="26" cy="76" rx="9" ry="14" transform="rotate(30 26 76)"/>
</svg>`);

const GLASSES = raw(`<svg class="ny-glasses" viewBox="0 0 200 150" aria-hidden="true">
  <g class="glass-l" transform="rotate(-14 70 140)">
    <path class="bowl" d="M48 20 H92 L86 70 C84 86 56 86 54 70Z"/><path class="drink" d="M51 38 H89 L85 70 C83 82 57 82 55 70Z"/>
    <path class="stem" d="M70 84 V128 M54 132 H86"/>
  </g>
  <g class="glass-r" transform="rotate(14 130 140)">
    <path class="bowl" d="M108 20 H152 L146 70 C144 86 116 86 114 70Z"/><path class="drink" d="M111 38 H149 L145 70 C143 82 117 82 115 70Z"/>
    <path class="stem" d="M130 84 V128 M114 132 H146"/>
  </g>
  <g class="clink">${range(5).map((i) => `<path d="M100 12 L${(100 + Math.cos((i * Math.PI) / 4 + Math.PI) * 18).toFixed(1)} ${(12 + Math.sin((i * Math.PI) / 4 + Math.PI) * 18).toFixed(1)}"/>`).join('')}</g>
  ${range(6).map((i) => `<circle class="bubble" style="--i:${i}" cx="${62 + (i % 3) * 8 + (i > 2 ? 60 : 0)}" cy="${66 - (i % 3) * 8}" r="${1.6 + (i % 2)}"/>`).join('')}
</svg>`);

export default {
  gate: ({ recipient, year }) => html`
    <div class="ny-sky" aria-hidden="true"><i class="ny-moon"></i></div>
    <p class="ny-kicker">Новогодняя открытка · ${year}</p>
    <button class="gate-btn globe" type="button" aria-label="Встряхнуть снежный шар">
      <span class="globe-glass">
        ${GLOBE_SCENE}
        <span class="globe-snow" aria-hidden="true">${globeFlakes()}</span>
        <span class="globe-shine" aria-hidden="true"></span>
      </span>
      <span class="globe-base" aria-hidden="true"><b>${year}</b></span>
    </button>
    <p class="gate-title">${recipient}</p>
    <p class="gate-hint">Нажми на шар, чтобы встряхнуть</p>`,

  backdrop: () => html`${garland()}<i class="ny-glow" aria-hidden="true"></i>`,

  decor: {
    hello: ({ year }) => html`<p class="ny-year" aria-hidden="true">${year}</p>`,
    message: () => BAUBLE,
    photos: () => SNOWFLAKE,
    closing: () => GLASSES,
  },

  divider: () => html`<span class="ny-divider" aria-hidden="true"><i></i>${SNOWFLAKE}<i></i></span>`,

  closingLine: ({ year }) => `Пусть ${year} будет волшебным!`,
};
