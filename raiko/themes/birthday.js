import { html, raw } from '../../src/views/html.js';

/** День рождения: подарок с бантом взрывается конфетти, в конце торт, свечи задувают касанием. */

const range = (count) => Array.from({ length: count }, (_, i) => i);
const CANDLES = 3;

/** Шарики первого экрана: x в процентах ширины, длительность, задержка, цвет 1-3. */
const GATE_BALLOONS = [[6, 19, 0, 1], [22, 23, 6, 2], [78, 21, 3, 3], [92, 25, 9, 1]];
/** Шарики за текстом летят только по краям, чтобы не закрывать поздравление. */
const BALLOONS = [[2, 19, 0, 1], [11, 24, 8, 2], [84, 21, 3, 3], [93, 26, 12, 1], [5, 27, 15, 3], [89, 23, 18, 2]];

const balloon = ([x, duration, delay, color]) =>
  `<i class="balloon c${color}" style="--x:${x}%;--d:${duration}s;--delay:-${delay}s"><b></b></i>`;

/** Наклейки в стиле мемфис вокруг имени: звезда, зигзаг, кольцо, треугольник, точки. */
const STICKERS = raw(`<svg class="bd-stickers" viewBox="0 0 360 260" aria-hidden="true">
  <g transform="translate(40 46) rotate(-12)"><path class="s-star c1" d="M0 -22 L6 -7 L22 -6 L10 4 L14 21 L0 12 L-14 21 L-10 4 L-22 -6 L-6 -7Z"/></g>
  <path class="s-zig c2" d="M276 34 l14 -14 l14 14 l14 -14 l14 14"/>
  <circle class="s-ring c3" cx="318" cy="200" r="16"/>
  <path class="s-tri c1" d="M30 208 l22 -6 l-6 22Z"/>
  <path class="s-squiggle c3" d="M150 18 c10 -12 20 12 30 0 s20 12 30 0"/>
  ${range(5).map((i) => `<circle class="s-dot c${(i % 3) + 1}" cx="${96 + i * 46}" cy="${236 - (i % 2) * 14}" r="4"/>`).join('')}
</svg>`);

const POPPER = raw(`<svg class="bd-popper" viewBox="0 0 120 120" aria-hidden="true">
  <path class="cone" d="M18 104 L44 40 L82 78Z"/><path class="cone-stripe" d="M30 74 L60 58 M24 90 L70 68"/>
  ${range(7).map((i) => {
    const angle = -1.2 + i * 0.32;
    const x = (66 + Math.cos(angle) * 34).toFixed(1);
    const y = (54 + Math.sin(angle) * 34).toFixed(1);
    return `<rect class="bit c${(i % 3) + 1}" x="${x}" y="${y}" width="7" height="12" rx="2" transform="rotate(${i * 37} ${x} ${y})"/>`;
  }).join('')}
</svg>`);

const CAKE = html`<div class="cake-wrap">
  <button class="cake" type="button" aria-label="Задуть свечи" data-done="Сбудется!">
    <span class="candles" aria-hidden="true">${raw(range(CANDLES).map((i) => `<i style="--i:${i}"><b class="flame"></b><s class="smoke"></s></i>`).join(''))}</span>
    <span class="tier tier-top" aria-hidden="true"></span>
    <span class="tier tier-bottom" aria-hidden="true"></span>
    <span class="plate" aria-hidden="true"></span>
  </button>
  <p class="cake-hint">Нажми на торт, чтобы задуть свечи</p>
</div>`;

export default {
  gate: ({ recipient }) => html`
    <div class="bd-gate-bg" aria-hidden="true">${raw(GATE_BALLOONS.map(balloon).join(''))}</div>
    <p class="bd-kicker">Сюрприз для тебя</p>
    <button class="gate-btn gift" type="button" aria-label="Открыть подарок">
      <span class="gift-lid"><span class="gift-bow" aria-hidden="true"><i class="loop loop-l"></i><i class="loop loop-r"></i><i class="tail tail-l"></i><i class="tail tail-r"></i><i class="knot"></i></span></span>
      <span class="gift-box" aria-hidden="true"></span>
    </button>
    <p class="gate-title">${recipient}</p>
    <p class="gate-hint">Нажми на бант</p>`,

  backdrop: () => raw(BALLOONS.map(balloon).join('')),

  decor: {
    hello: () => STICKERS,
    message: () => POPPER,
    closing: () => CAKE,
  },

  divider: () => raw('<svg class="bd-divider" viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8 q7.5 -12 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0"/></svg>'),

  closingLine: () => 'Загадай желание!',
};
