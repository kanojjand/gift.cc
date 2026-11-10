import { html, raw } from '../src/views/html.js';

const hint = (text) => html`<p class="gate-hint">${text}</p>`;

function tulip(x, scale, color, delay) {
  return raw(`<g transform="translate(${x} 320) scale(${scale})"><g class="grow" style="animation-delay:${delay}s">
    <path d="M0 0 C-3 -50 3 -90 0 -128" fill="none" stroke="#4f9d69" stroke-width="7" stroke-linecap="round"/>
    <path d="M0 -14 C-40 -36 -48 -82 -40 -112 C-22 -92 -6 -60 0 -30Z" fill="#6bb583"/>
    <path d="M0 -8 C36 -30 46 -68 40 -96 C22 -78 6 -50 0 -26Z" fill="#5aa775"/>
    <path d="M-27 -172 C-34 -134 -22 -118 0 -116 C22 -118 34 -134 27 -172 L13 -150 L0 -178 L-13 -150Z" fill="${color}"/>
  </g></g>`);
}

const TULIPS = [
  [60, 0.82, '#f06595', 0.1],
  [130, 1.05, '#e64980', 0.3],
  [200, 1.22, '#d6336c', 0],
  [270, 1, '#f783ac', 0.4],
  [340, 0.8, '#e64980', 0.2],
];

function leaf(x, y, rotation, scale, color) {
  return raw(`<path transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" fill="${color}"
    d="M0 0 C42 -32 112 -32 170 0 C112 32 42 32 0 0Z"/>`);
}

const LEAVES = [
  [-20, 40, 18, 1.5, '#1f5546'], [-30, 170, -8, 1.8, '#2b6d59'], [-10, 300, 22, 1.4, '#184539'],
  [-40, 420, -16, 2, '#2b6d59'], [-14, 560, 12, 1.5, '#1f5546'], [-34, 690, -22, 1.8, '#347c66'],
  [10, 110, 40, 0.9, '#347c66'], [6, 360, -36, 1, '#3f8d74'], [12, 620, 34, 0.9, '#3f8d74'],
];

const leafPanel = (side) => html`
  <svg class="leaf-panel leaf-${side}" viewBox="0 0 240 800" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
    ${LEAVES.map(([x, y, rotation, scale, color]) => leaf(x, y, rotation, scale, color))}
  </svg>`;

/** Рог «қошқар мүйіз»: основа казахского орнамента. */
export const HORN_PATH =
  'M0 34 C0 14 -8 4 -20 4 C-32 4 -36 16 -29 22 C-23 27 -15 23 -17 15 M0 34 C0 14 8 4 20 4 C32 4 36 16 29 22 C23 27 15 23 17 15';

const hornPattern = raw(`<svg class="orn-bg" aria-hidden="true"><defs>
  <pattern id="horns" width="84" height="64" patternUnits="userSpaceOnUse">
    <path d="${HORN_PATH}" transform="translate(42 12)" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="${HORN_PATH}" transform="translate(0 44)" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="${HORN_PATH}" transform="translate(84 44)" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </pattern></defs><rect width="100%" height="100%" fill="url(#horns)"/></svg>`);

const SHANYRAK = raw(`<svg viewBox="-110 -110 220 220" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-linecap="round">
    <circle r="104" stroke-width="5"/><circle r="92" stroke-width="2"/>
    ${Array.from({ length: 36 }, (_, i) => `<path d="M0 -92 V-104" transform="rotate(${i * 10})" stroke-width="3"/>`).join('')}
    ${[-34, 0, 34].map((o) => `<path d="M${o} -92 Q${o * 0.6} 0 ${o} 92" stroke-width="6"/><path d="M-92 ${o} Q0 ${o * 0.6} 92 ${o}" stroke-width="6"/>`).join('')}
  </g></svg>`);

const GATES = {
  envelope: ({ recipient, initial }) => html`
    <div class="env">
      <div class="env-back"></div>
      <div class="env-letter"><small>Кому</small><b>${recipient}</b></div>
      <div class="env-front"></div>
      <div class="env-flap"></div>
      <button class="gate-btn seal" type="button" aria-label="Открыть письмо">${initial}</button>
    </div>
    ${hint('Нажми на печать')}`,

  tulips: ({ recipient }) => html`
    <p class="gate-title">Для тебя, ${recipient}</p>
    <svg class="field" viewBox="0 0 400 320" aria-hidden="true">
      ${TULIPS.map(([x, scale, color, delay]) => tulip(x, scale, color, delay))}
    </svg>
    <button class="gate-btn" type="button">Вырастить цветы</button>`,

  night: ({ recipient }) => html`
    <div class="moon" aria-hidden="true"></div>
    <p class="gate-title">${recipient}, загадай желание</p>
    <button class="gate-btn star" type="button" aria-label="Коснуться звезды">
      <svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0 -48 C5 -12 12 -5 48 0 C12 5 5 12 0 48 C-5 12 -12 5 -48 0 C-12 -5 -5 -12 0 -48Z"/></svg>
    </button>
    ${hint('Коснись звезды')}`,

  polaroid: ({ recipient, firstPhoto }) => html`
    <button class="gate-btn pola" type="button" aria-label="Проявить снимок">
      <span class="tape" aria-hidden="true"></span>
      <span class="film">
        ${firstPhoto ? html`<img src="${firstPhoto}" alt="">` : html`<span class="film-art"></span>`}
        <span class="film-cover"></span>
      </span>
      <span class="pola-caption">${recipient}</span>
    </button>
    ${hint('Нажми, чтобы проявить снимок')}`,

  watercolor: ({ recipient }) => html`
    <i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="blob b4"></i>
    <div class="wc-center">
      <p class="gate-title">${recipient}</p>
      <button class="gate-btn" type="button">Раскрасить день</button>
    </div>`,

  gold: ({ recipient, initial }) => html`
    <div class="door door-l"></div>
    <div class="door door-r"></div>
    <div class="gold-center">
      <button class="gate-btn mono" type="button" aria-label="Открыть двери">${initial}</button>
      <p class="gate-title">${recipient}</p>
      ${hint('Откройте двери')}
    </div>`,

  garden: ({ recipient }) => html`
    ${leafPanel('l')}${leafPanel('r')}
    <div class="wreath">
      <p class="gate-title">${recipient}</p>
      <button class="gate-btn" type="button">Войти в сад</button>
    </div>`,

  cinema: ({ recipient }) => html`
    <div class="leader">
      <div class="sweep"></div>
      <div class="cross"></div>
      <div class="digits" aria-hidden="true"><span>3</span><span>2</span><span>1</span></div>
      <button class="gate-btn play" type="button" aria-label="Смотреть фильм">▶</button>
    </div>
    <p class="gate-title">В главной роли: ${recipient}</p>
    ${hint('Сеанс начинается по вашему нажатию')}`,

  silk: ({ recipient }) => html`
    <div class="curtain curtain-l"></div>
    <div class="curtain curtain-r"></div>
    <div class="silk-center">
      <p class="gate-title">${recipient}</p>
      <button class="gate-btn tassel" type="button">Открыть занавес</button>
    </div>`,

  ornament: ({ recipient }) => html`
    ${hornPattern}
    <button class="gate-btn shan" type="button" aria-label="Открыть шаңырақ">${SHANYRAK}</button>
    <p class="gate-title">${recipient}</p>
    ${hint('Шаңырақты аш · Нажми на шаңырақ')}`,
};

const DIVIDERS = {
  ornament: raw(`<svg class="divider-svg" viewBox="-40 0 80 40" aria-hidden="true"><path d="${HORN_PATH}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`),
};

export function renderGate(templateId, data) {
  return GATES[templateId](data);
}

export function renderDivider(templateId) {
  return DIVIDERS[templateId] ?? html`<span class="divider" aria-hidden="true"></span>`;
}
