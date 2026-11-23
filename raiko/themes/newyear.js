import { html, raw } from '../../src/views/html.js';
import { corner, needleSprig, range, spread } from '../paper.js';
import { finalActions, letter, photoButton } from '../story.js';

/**
 * Новый год «Маленькое чудо». Сценарий: тёмный экран и снежный шар с именем на подставке → встряхнуть
 * (нажать или провести пальцем) → метель, в окнах загорается свет, на ёлках огоньки → «С Новым годом, Имя!» →
 * письмо под ёлкой → фото окошками внутри шара → на ёлке загорается звезда, «Загадать желание».
 */

const GLOBE_FLAKES = 26;
const LONG_NAME_CHARS = 10;

function fir(x, base, scale, className) {
  return `<g class="${className}" transform="translate(${x} ${base}) scale(${scale})">
    <path d="M0 -92 L22 -58 H11 L30 -30 H15 L36 0 H-36 L-15 -30 H-30 L-11 -58 H-22Z"/>
    <rect x="-5" y="0" width="10" height="10" class="trunk"/>
  </g>`;
}

/** Огоньки на ёлках внутри шара: загораются, когда шар встряхнули. */
const TREE_LIGHTS = [[24, 150], [38, 140], [28, 124], [34, 108], [166, 154], [180, 142], [170, 124], [176, 106]];

const GLOBE_SCENE = raw(`<svg class="globe-scene" viewBox="0 0 200 200" aria-hidden="true">
  <path class="hill-far" d="M0 140 C40 118 80 128 110 120 C140 112 170 122 200 116 V200 H0Z"/>
  ${fir(46, 150, 0.72, 'tree tree-far')}${fir(160, 146, 0.62, 'tree tree-far')}
  <g class="house" transform="translate(98 134)">
    <path class="roof" d="M-30 -22 L0 -48 L30 -22Z"/><rect class="wall" x="-24" y="-22" width="48" height="34"/>
    <rect class="window" x="-14" y="-12" width="12" height="12"/><rect class="window" x="4" y="-12" width="12" height="12"/>
    <path class="roof-snow" d="M-33 -21 L0 -51 L33 -21 L28 -21 L0 -45 L-28 -21Z"/>
  </g>
  ${fir(30, 176, 1, 'tree')}${fir(172, 178, 1.12, 'tree')}
  <g class="tree-lights">${TREE_LIGHTS.map(([x, y], i) => `<circle style="--i:${i}" cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>
  <path class="star" transform="translate(172 72) scale(.5)" d="M0 -20 L6 -6 L21 -6 L9 3 L13 18 L0 9 L-13 18 L-9 3 L-21 -6 L-6 -6Z"/>
  <path class="ground" d="M0 168 C50 154 110 172 200 160 V200 H0Z"/>
</svg>`);

const globeFlakes = () =>
  raw(range(GLOBE_FLAKES)
    .map((i) => `<i style="--x:${(spread(i, 1) * 100).toFixed(1)}%;--s:${(2 + spread(i, 2) * 4).toFixed(1)}px;--d:${(4 + spread(i, 3) * 5).toFixed(2)}s;--delay:-${(spread(i, 4) * 8).toFixed(2)}s"></i>`)
    .join(''));

const globeGlass = () => html`<span class="globe-glass">${GLOBE_SCENE}<span class="globe-snow" aria-hidden="true">${globeFlakes()}</span><span class="globe-shine" aria-hidden="true"></span></span>`;
/** Подставка шара с выгравированным именем получателя. */
const globeBase = (name) => html`<span class="globe-base" aria-hidden="true"><b>${name}</b></span>`;

const SNOWFLAKE = raw(`<svg class="ny-flake" viewBox="-20 -20 40 40" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
  ${range(6).map((i) => `<g transform="rotate(${i * 60})"><path d="M0 0 V-17"/><path d="M0 -10 L-5 -15 M0 -10 L5 -15"/></g>`).join('')}</g></svg>`);

function garland() {
  const bulbs = range(11).map((i) => {
    const t = i / 10;
    const x = 10 + t * 380;
    const y = 18 + Math.sin(t * Math.PI) * 34 + (i % 2) * 4;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-3" y="-4" width="6" height="6" class="cap"/><ellipse class="bulb b${i % 3}" style="--i:${i}" cx="0" cy="9" rx="6" ry="9"/></g>`;
  });
  return raw(`<svg class="ny-garland" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
    <path class="wire" d="M0 14 Q200 74 400 14"/>${bulbs.join('')}</svg>`);
}

/** Еловая ветка над письмом: главный стебель и три боковые веточки с иголками. */
const BRANCH = `<path d="${needleSprig(4, 150, -30, 236, 24, 28)} ${needleSprig(78, 108, -72, 84, 9, 18)} ${needleSprig(150, 68, -6, 76, 8, 16)} ${needleSprig(108, 92, 18, 56, 6, 14)}"/>`;

/** Фото окошками внутри большого шара: x, y центра и ширина окошка в процентах шара, для 1-5 фото. */
const WINDOW_LAYOUTS = {
  1: [[50, 46, 58]],
  2: [[31, 48, 40], [69, 48, 40]],
  3: [[50, 30, 36], [29, 63, 34], [71, 63, 34]],
  4: [[32, 32, 33], [68, 32, 33], [32, 67, 33], [68, 67, 33]],
  5: [[30, 29, 29], [70, 29, 29], [50, 50, 31], [30, 72, 27], [70, 72, 27]],
};

/** Ёлка последнего экрана: звезда на верхушке загорается, огоньки мерцают. */
const FINAL_LIGHTS = [[92, 80], [110, 96], [84, 112], [120, 124], [96, 134], [72, 150], [110, 156], [138, 160], [86, 172], [60, 176], [124, 178]];
const FINAL_TREE = raw(`<svg class="ny-final-tree reveal" viewBox="0 0 200 214" aria-hidden="true">
  <circle class="ft-glow" cx="100" cy="34" r="34"/>
  <path class="ft-tree" d="M100 44 L134 92 H118 L150 136 H130 L168 186 H32 L70 136 H50 L82 92 H66Z"/>
  <rect class="ft-trunk" x="90" y="186" width="20" height="22" rx="2"/>
  ${FINAL_LIGHTS.map(([x, y], i) => `<circle class="ft-light b${i % 3}" style="--i:${i}" cx="${x}" cy="${y}" r="3.6"/>`).join('')}
  <path class="ft-star" d="M100 8 L107 26 L126 27 L111 39 L116 58 L100 47 L84 58 L89 39 L74 27 L93 26Z"/>
</svg>`);

function magicScene(recipient) {
  return html`<section class="scene ny-magic">
    <div class="globe globe-still lit" aria-hidden="true">${globeGlass()}${globeBase(recipient)}</div>
    <h1 class="ny-hello reveal"><span class="ny-hello-line">С Новым годом,</span> <span class="recipient${[...recipient].length > LONG_NAME_CHARS ? ' name-long' : ''}">${recipient}!</span></h1>
    <p class="scroll-hint reveal">Листай вниз</p>
  </section>`;
}

function letterScene({ message, from, sender, song }) {
  return html`<section class="scene ny-letter-scene">
    <article class="ny-letter reveal">
      ${raw(corner('ny-letter-branch', 'tl', '0 0 240 170', BRANCH))}
      <span class="ny-letter-flake" aria-hidden="true">${SNOWFLAKE}</span>
      <p class="ny-letter-kicker">Письмо под ёлкой</p>
      ${letter({ message, from, sender })}
    </article>
    ${song}
  </section>`;
}

function memoriesScene(photoUrls, song) {
  const layout = WINDOW_LAYOUTS[photoUrls.length];
  return html`<section class="scene ny-memories">
    <h2 class="ny-title reveal">Воспоминания</h2>
    <div class="ny-memory-globe reveal">
      <span class="ny-mg-glass" aria-hidden="true"></span>
      ${photoUrls.map((url, i) => {
        const [x, y, width] = layout[i];
        return photoButton(url, i, photoUrls.length, 'ny-window', `--x:${x}%;--y:${y}%;--w:${width}%;--i:${i}`);
      })}
      <span class="globe-snow" aria-hidden="true">${globeFlakes()}</span>
      <span class="globe-shine" aria-hidden="true"></span>
    </div>
    <p class="ny-note reveal">Нажми на окошко, чтобы рассмотреть</p>
    ${song}
  </section>`;
}

function finalScene(sender) {
  return html`<section class="scene ny-final scene-closing">
    ${FINAL_TREE}
    <p class="final-thanks reveal">Пусть твоё маленькое чудо длится весь год.</p>
    <p class="ny-wish-done" role="status" data-done-note hidden>Желание загадано. Пусть сбудется!</p>
    ${finalActions({ sender, action: { id: 'wish', label: 'Загадать желание' } })}
  </section>`;
}

export default {
  gate: ({ recipient }) => html`
    <div class="ny-sky" aria-hidden="true"><i class="ny-moon"></i></div>
    <p class="gate-title">Для ${recipient}</p>
    <p class="ny-lead">Иногда самые большие чудеса скрываются в маленьких вещах.</p>
    <button class="gate-btn globe" type="button" aria-label="Встряхнуть снежный шар">${globeGlass()}${globeBase(recipient)}</button>
    <p class="gate-hint">Встряхни шар: нажми или проведи пальцем</p>`,

  backdrop: () => html`${garland()}<i class="ny-glow" aria-hidden="true"></i>`,

  /** Песня стоит рядом с фото, а если фото нет — под письмом. */
  story: ({ recipient, sender, message, photoUrls, from, song }) => html`
    ${magicScene(recipient)}
    ${letterScene({ message, from, sender, song: photoUrls.length ? '' : song })}
    ${photoUrls.length ? memoriesScene(photoUrls, song) : ''}
    ${finalScene(sender)}`,

  divider: () => html`<span class="ny-divider" aria-hidden="true"><i></i>${SNOWFLAKE}<i></i></span>`,
};
