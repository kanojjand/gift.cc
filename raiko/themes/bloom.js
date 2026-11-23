import { html, raw } from '../../src/views/html.js';
import { finalActions, letter, photoButton } from '../story.js';

/**
 * «Цветение» — особый выпуск журнала о человеке. Сценарий: обложка «Special edition, посвящается Имя» и бутон →
 * касание раскрывает цветок → «Этот выпуск — о тебе» → статья «Немного о главном» с поздравлением →
 * «Моменты»: развороты с фото листаются в сторону, композиция меняется → последняя страница: расцветающий сад,
 * пожелание и «Перечитать этот выпуск».
 */

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

const OUTLINE = (className) => raw(`<svg class="bl-outline ${className}" viewBox="-120 -120 240 240" aria-hidden="true">
  ${range(9).map((i) => `<path transform="rotate(${i * 40})" d="${petalPath(110, 44)}"/>`).join('')}
  ${range(6).map((i) => `<path transform="rotate(${i * 60 + 20})" d="${petalPath(70, 30)}"/>`).join('')}
</svg>`);

/** Сад на последней странице: цветы на стеблях вырастают по очереди. x, высота стебля, размер цветка, цвет. */
const GARDEN = [[30, 70, 0.55, 'c2'], [62, 96, 0.75, 'c1'], [98, 60, 0.5, 'c3'], [130, 110, 0.85, 'c1'], [164, 74, 0.6, 'c2'], [196, 92, 0.7, 'c3'], [226, 62, 0.5, 'c1']];
const GARDEN_SVG = raw(`<svg class="bl-garden reveal" viewBox="0 0 256 146" aria-hidden="true">
  ${GARDEN.map(([x, height, scale, color], i) => `<g class="bl-grow" style="--i:${i}"><path class="g-stem" d="M${x} 146 C${x - 7} ${146 - height / 2} ${x + 7} ${146 - height / 2} ${x} ${146 - height}"/>${smallFlower(x, 146 - height, scale, color)}</g>`).join('')}
</svg>`);

/** Развороты «Моментов»: одно фото — на всю страницу, два — рядом. Для 1-5 фото, номера фото по порядку. */
const SPREAD_PLANS = { 1: [[0]], 2: [[0, 1]], 3: [[0], [1, 2]], 4: [[0], [1, 2], [3]], 5: [[0], [1, 2], [3, 4]] };
const frameLabel = (i) => `Кадр ${String(i + 1).padStart(2, '0')}`;
const pageHead = (page) => html`<header class="bl-page-head" aria-hidden="true"><span>Цветение · Выпуск № 01</span><span>стр. ${String(page).padStart(2, '0')}</span></header>`;

function headlineScene(page) {
  return html`<section class="scene bl-page bl-headline">
    ${pageHead(page)}
    <p class="bl-kicker reveal">Special edition</p>
    <h1 class="bl-headline-title reveal">Этот выпуск — о тебе.</h1>
    <div class="reveal">${SPRIG}</div>
    <p class="scroll-hint reveal">Листай</p>
  </section>`;
}

function articleScene(page, { recipient, message, sender, song }) {
  return html`<section class="scene bl-page bl-article">
    ${pageHead(page)}
    <p class="bl-kicker reveal">Немного о главном</p>
    <h2 class="bl-article-title reveal">${recipient}</h2>
    <span class="bl-quote reveal" aria-hidden="true">“</span>
    ${letter({ message, from: 'С теплом,', sender })}
    ${song}
  </section>`;
}

function momentsScene(page, photoUrls, song) {
  const spreads = SPREAD_PLANS[photoUrls.length].map((indexes) => indexes.map((i) => ({ url: photoUrls[i], i })));
  return html`<section class="scene bl-page bl-moments">
    ${pageHead(page)}
    <p class="bl-kicker reveal">Моменты</p>
    <div class="bl-spreads reveal">
      ${spreads.map((spread, s) => html`<div class="bl-spread bl-spread-${spread.length}">
        ${spread.map(({ url, i }) => html`<figure class="bl-shot">${photoButton(url, i, photoUrls.length)}<figcaption>${frameLabel(i)}</figcaption></figure>`)}
        <span class="bl-spread-no" aria-hidden="true">${s + 1} / ${spreads.length}</span>
      </div>`)}
    </div>
    ${spreads.length > 1 ? html`<p class="swipe-hint reveal">Листай страницы в сторону</p>` : ''}
    ${song}
  </section>`;
}

function lastPageScene(page, { from, sender }) {
  return html`<section class="scene bl-page bl-last scene-closing">
    ${pageHead(page)}
    ${GARDEN_SVG}
    <p class="bl-kicker reveal">Пожелание</p>
    <p class="final-thanks reveal">Жизнь не обязана быть идеальной, чтобы быть прекрасной.</p>
    <p class="bl-last-sub reveal">Пусть у тебя будет много причин расцветать снова и снова.</p>
    <p class="signature reveal"><span>${from}</span> <b>${sender}</b></p>
    ${finalActions({ sender, action: { id: 'reread', label: 'Перечитать этот выпуск' } })}
  </section>`;
}

export default {
  gate: ({ recipient }) => html`
    <p class="bl-mast" aria-hidden="true"><span>Special edition</span><i></i><span>Выпуск № 01</span></p>
    <p class="bl-dedication">Посвящается</p>
    <p class="gate-title">${recipient}</p>
    <button class="gate-btn bud" type="button" aria-label="Коснуться цветка">${FLOWER}</button>
    <p class="bl-cover-line">Некоторые люди делают этот мир красивее просто тем, что в нём есть.</p>
    <p class="gate-hint">Коснись цветка</p>`,

  backdrop: () => html`${OUTLINE('o1')}${OUTLINE('o2')}`,

  /** Страницы журнала с номерами. Песня — на развороте с фото, а без фото — под статьёй. */
  story: ({ recipient, sender, message, photoUrls, from, song }) => {
    const hasPhotos = photoUrls.length > 0;
    return html`
      ${headlineScene(2)}
      ${articleScene(3, { recipient, message, sender, song: hasPhotos ? '' : song })}
      ${hasPhotos ? momentsScene(4, photoUrls, song) : ''}
      ${lastPageScene(hasPhotos ? 5 : 4, { from, sender })}`;
  },

  divider: () => SPRIG,
};
