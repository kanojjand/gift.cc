import { html, raw } from '../../src/views/html.js';
import { finalActions, letter, photoButton } from '../story.js';

/**
 * День рождения «Подарок внутри подарка». Сценарий: прыгающая коробка «нажми на бант» → крышка улетает, конфетти
 * и шарики → «С днём рождения!» и три маленьких подарка с пожеланиями (счастье, приключения, успех) → личная
 * карточка → торт, свечи задувают касанием → фото полароидами на праздничной стене и песня → «Повторить праздник».
 */

const range = (count) => Array.from({ length: count }, (_, i) => i);
const CANDLES = 3;
const LONG_NAME_CHARS = 10;

/** Шарики первого экрана: x в процентах ширины, длительность, задержка, цвет 1-3. */
const GATE_BALLOONS = [[6, 19, 0, 1], [22, 23, 6, 2], [78, 21, 3, 3], [92, 25, 9, 1]];
/** Шарики за текстом летят только по краям, чтобы не закрывать поздравление. */
const BALLOONS = [[2, 19, 0, 1], [11, 24, 8, 2], [84, 21, 3, 3], [93, 26, 12, 1], [5, 27, 15, 3], [89, 23, 18, 2]];

const balloon = ([x, duration, delay, color]) =>
  `<i class="balloon c${color}" style="--x:${x}%;--d:${duration}s;--delay:-${delay}s"><b></b></i>`;

/** Три маленьких подарка из большой коробки: название на коробке и пожелание внутри. */
const MINI_GIFTS = [
  { title: 'Счастье', wish: 'Пусть каждый день начинается с улыбки, а хорошее настроение не покидает тебя весь год.' },
  { title: 'Приключения', wish: 'Пусть впереди будут новые места, яркие встречи и истории, которые захочется рассказывать.' },
  { title: 'Успех', wish: 'Пусть всё задуманное получается, а самые смелые цели становятся большими победами.' },
];

/** Наклон полароидов на стене по очереди, в градусах. */
const PIN_TILTS = [-4, 3, -2, 4, -3];

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
  <button class="cake" type="button" aria-label="Задуть свечи">
    <span class="candles" aria-hidden="true">${raw(range(CANDLES).map((i) => `<i style="--i:${i}"><b class="flame"></b><s class="smoke"></s></i>`).join(''))}</span>
    <span class="tier tier-top" aria-hidden="true"></span>
    <span class="tier tier-bottom" aria-hidden="true"></span>
    <span class="plate" aria-hidden="true"></span>
  </button>
  <p class="cake-hint">Нажми на торт, чтобы задуть свечи</p>
</div>`;

const miniGift = (gift, i) => html`<button class="mini-gift c${i + 1}" type="button" data-gift aria-expanded="false" aria-controls="gift-wish-${i}">
  <span class="mg-lid" aria-hidden="true"></span><span class="mg-box" aria-hidden="true"></span><b>${gift.title}</b>
</button>`;

function hoorayScene() {
  return html`<section class="scene bd-hooray">
    <h1 class="bd-hooray-title reveal">С днём рождения!</h1>
    <p class="bd-hooray-sub reveal">В коробке нашлись ещё три подарка. Открой каждый!</p>
    <div class="bd-gifts reveal">${MINI_GIFTS.map(miniGift)}</div>
    <div class="bd-wishes" aria-live="polite">
      ${MINI_GIFTS.map((gift, i) => html`<p id="gift-wish-${i}" class="bd-wish c${i + 1}" data-done-note hidden><b>${gift.title}.</b> ${gift.wish}</p>`)}
    </div>
    <p class="scroll-hint reveal">Листай вниз</p>
  </section>`;
}

function cardScene({ recipient, message, from, sender, song }) {
  return html`<section class="scene bd-card-scene">
    <article class="bd-card reveal">
      ${POPPER}
      <h2 class="bd-card-title${[...recipient].length > LONG_NAME_CHARS ? ' long-name' : ''}">${recipient}, сегодня твой день!</h2>
      ${letter({ message, from, sender })}
    </article>
    ${song}
  </section>`;
}

function cakeScene() {
  return html`<section class="scene bd-cake-scene">
    <p class="bd-cake-kicker reveal">А теперь самое важное!</p>
    <h2 class="bd-cake-title reveal">Загадай желание и задуй свечи</h2>
    <div class="reveal">${CAKE}</div>
    <p class="bd-cake-done" role="status" data-done-note hidden>Сбудется!</p>
  </section>`;
}

function wallScene(photoUrls, song) {
  return html`<section class="scene bd-wall-scene">
    <h2 class="bd-wall-title reveal">Самые классные кадры</h2>
    <div class="bd-wall reveal" data-count="${photoUrls.length}">
      ${photoUrls.map((url, i) => html`<figure class="bd-polaroid" style="--r:${PIN_TILTS[i]}deg"><i class="bd-pin c${(i % 3) + 1}" aria-hidden="true"></i>${photoButton(url, i, photoUrls.length)}</figure>`)}
    </div>
    ${photoUrls.length > 1 ? html`<p class="swipe-hint reveal">Листай в сторону</p>` : ''}
    ${song}
  </section>`;
}

function finalScene(sender) {
  return html`<section class="scene bd-final scene-closing">
    <p class="final-thanks reveal">Пусть этот год будет громче, ярче и счастливее предыдущего!</p>
    ${finalActions({ sender, action: { id: 'replay', label: 'Повторить праздник' } })}
  </section>`;
}

export default {
  gate: ({ recipient }) => html`
    <div class="bd-gate-bg" aria-hidden="true">${raw(GATE_BALLOONS.map(balloon).join(''))}</div>
    <p class="bd-kicker">Кажется, кое-кто сегодня стал на год круче!</p>
    <button class="gate-btn gift" type="button" aria-label="Открыть подарок">
      <span class="gift-lid"><span class="gift-bow" aria-hidden="true"><i class="loop loop-l"></i><i class="loop loop-r"></i><i class="tail tail-l"></i><i class="tail tail-r"></i><i class="knot"></i></span></span>
      <span class="gift-box" aria-hidden="true"></span>
    </button>
    <p class="gate-title">${recipient},</p>
    <p class="bd-gate-sub">у тебя есть один подарок</p>
    <p class="gate-hint">Нажми на бант!</p>`,

  backdrop: () => raw(BALLOONS.map(balloon).join('')),

  /** Песня стоит на стене с фото, а если фото нет — под карточкой. */
  story: ({ recipient, sender, message, photoUrls, from, song }) => html`
    ${hoorayScene()}
    ${cardScene({ recipient, message, from, sender, song: photoUrls.length ? '' : song })}
    ${cakeScene()}
    ${photoUrls.length ? wallScene(photoUrls, song) : ''}
    ${finalScene(sender)}`,

  divider: () => raw('<svg class="bd-divider" viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8 q7.5 -12 15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0 t15 0"/></svg>'),
};
