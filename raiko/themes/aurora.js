import { html, raw } from '../../src/views/html.js';

/** Сияние: жемчужина света в ночном небе. Касание — и свет заливает экран, проступает северное сияние. */

const HORIZON = raw(`<svg class="au-horizon" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
  <path class="far" d="M0 120 V70 L40 52 L82 74 L130 40 L176 66 L222 34 L270 62 L318 44 L360 64 L400 50 V120Z"/>
  <path class="near" d="M0 120 V92 L56 74 L104 96 L160 78 L214 98 L268 80 L330 100 L400 84 V120Z"/>
</svg>`);

const STAR4 = raw('<svg class="au-star" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -20 C2 -4 4 -2 20 0 C4 2 2 4 0 20 C-2 4 -4 2 -20 0 C-4 -2 -2 -4 0 -20Z"/></svg>');

export default {
  gate: ({ recipient }) => html`
    <p class="au-kicker">Свет для тебя</p>
    <p class="gate-title">${recipient}</p>
    <button class="gate-btn pearl" type="button" aria-label="Коснуться света">
      <i class="ring r1" aria-hidden="true"></i><i class="ring r2" aria-hidden="true"></i><i class="ring r3" aria-hidden="true"></i>
      <span class="orb" aria-hidden="true"></span>
    </button>
    <p class="gate-hint">Коснись света</p>`,

  backdrop: () => html`<i class="ribbon rb1"></i><i class="ribbon rb2"></i><i class="ribbon rb3"></i>${HORIZON}`,

  decor: {
    hello: () => STAR4,
    closing: () => html`<span class="au-orb-small" aria-hidden="true"></span>`,
  },

  divider: () => html`<span class="au-divider" aria-hidden="true"></span>`,

  closingLine: () => 'Сияй ярче всех',
};
