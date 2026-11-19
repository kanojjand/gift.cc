import { html, raw } from '../../src/views/html.js';

/** Для двоих: замок-сердце с инициалами пары. Ключ входит в скважину, дужка поднимается, сердце светится. */

const HEART_PATH = 'M100 252 C34 210 14 176 14 140 C14 108 38 88 64 88 C82 88 94 98 100 112 C106 98 118 88 136 88 C162 88 186 108 186 140 C186 176 166 210 100 252Z';
const SMALL_HEART = 'M12 21 C4 15 1 11 1 7 C1 3.5 3.8 1 7 1 C9.2 1 11 2.4 12 4.2 C13 2.4 14.8 1 17 1 C20.2 1 23 3.5 23 7 C23 11 20 15 12 21Z';

const lock = (pair) => html`<svg class="lock-svg" viewBox="0 0 200 270" aria-hidden="true">
  <defs>
    <linearGradient id="lv-metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" class="metal-hi"/><stop offset=".55" class="metal-mid"/><stop offset="1" class="metal-lo"/>
    </linearGradient>
  </defs>
  <path class="shackle" d="M62 124 V74 a38 38 0 0 1 76 0 V124"/>
  <path class="lock-heart" d="${HEART_PATH}"/>
  <path class="lock-rim" d="${HEART_PATH}" transform="translate(100 170) scale(.86) translate(-100 -170)"/>
  <text class="engrave" x="100" y="170" text-anchor="middle">${pair}</text>
  <g class="keyhole"><circle cx="100" cy="198" r="9"/><path d="M95 202 H105 L108 222 H92Z"/></g>
</svg>`;

const KEY = raw(`<svg class="key-svg" viewBox="0 0 160 60" aria-hidden="true">
  <path class="key-bow" d="M30 30 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M30 30 m-9 0 a9 9 0 1 1 18 0 a9 9 0 1 1 -18 0" fill-rule="evenodd"/>
  <path class="key-blade" d="M52 26 H150 V34 H140 V44 H132 V34 H122 V42 H114 V34 H52Z"/>
</svg>`);

const BEAT = raw(`<svg class="lv-beat" viewBox="0 0 200 40" aria-hidden="true">
  <path class="beat-line" d="M0 22 H58 L66 8 L74 34 L82 22 H88"/>
  <g transform="translate(88 10)"><path class="beat-heart" d="${SMALL_HEART}"/></g>
  <path class="beat-line beat-tail" d="M112 22 H200"/>
</svg>`);

const SEAL = raw(`<svg class="lv-seal" viewBox="0 0 80 80" aria-hidden="true">
  <path class="wax" d="M40 4 C52 6 58 2 66 12 C76 20 72 30 76 40 C74 52 78 58 68 66 C60 76 50 72 40 76 C28 74 22 78 14 68 C4 60 8 50 4 40 C6 28 2 22 12 14 C20 4 30 8 40 4Z"/>
  <path class="wax-heart" transform="translate(28 28)" d="${SMALL_HEART}"/>
</svg>`);

const pairHeart = raw(`<svg class="lv-pair-heart" viewBox="0 0 24 22" aria-hidden="true"><path d="${SMALL_HEART}"/></svg>`);

export default {
  gate: ({ recipient, initial, senderInitial }) => html`
    <i class="lv-halo" aria-hidden="true"></i>
    <p class="lv-kicker">Только для двоих</p>
    <button class="gate-btn lock" type="button" aria-label="Открыть замок">
      ${lock(`${initial} + ${senderInitial}`)}
      <span class="key" aria-hidden="true">${KEY}</span>
    </button>
    <p class="gate-title">${recipient}</p>
    <p class="gate-hint">Нажми на замок</p>`,

  backdrop: () => html`<i class="lv-blob b1"></i><i class="lv-blob b2"></i><i class="lv-blob b3"></i>`,

  decor: {
    message: () => SEAL,
    closing: ({ recipient, sender }) => html`<p class="lv-pair"><span>${recipient}</span>${pairHeart}<span>${sender}</span></p>`,
  },

  divider: () => BEAT,

  closingLine: () => 'Навсегда вместе',
};
