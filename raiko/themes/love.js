import { html, raw } from '../../src/views/html.js';
import { finalActions, letter, photoButton } from '../story.js';

/**
 * Для двоих «Письмо, которое только для тебя». Сценарий: замок с инициалами пары и ключ → ключ поворачивается
 * с негромким щелчком, замок открывается → светящийся конверт «Только для Имя» → касание открывает письмо →
 * «Наша история»: фото как кадры фильма с подписями → половинки замка становятся двумя сердцами, «Открыть ещё раз».
 * Тексты без рода отправителя: дарить может и он, и она.
 */

const HEART_PATH = 'M100 252 C34 210 14 176 14 140 C14 108 38 88 64 88 C82 88 94 98 100 112 C106 98 118 88 136 88 C162 88 186 108 186 140 C186 176 166 210 100 252Z';
const SMALL_HEART = 'M12 21 C4 15 1 11 1 7 C1 3.5 3.8 1 7 1 C9.2 1 11 2.4 12 4.2 C13 2.4 14.8 1 17 1 C20.2 1 23 3.5 23 7 C23 11 20 15 12 21Z';

/** Подписи кадров «Нашей истории»: последний кадр всегда «И это ещё не конец». */
const STORY_CAPTIONS = ['Наше начало', 'Тот самый день', 'Момент, который я не забуду', 'Просто мы'];
const LAST_CAPTION = 'И это ещё не конец';
const captionsFor = (count) => (count === 1 ? ['Просто мы'] : [...STORY_CAPTIONS.slice(0, count - 1), LAST_CAPTION]);

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

/** Финал: замок раскрывается, его половинки расходятся и становятся двумя светящимися сердцами. */
const HEARTS_FINALE = raw(`<svg class="lv-finale" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <clipPath id="lv-half-l"><rect x="0" y="0" width="100" height="270"/></clipPath>
    <clipPath id="lv-half-r"><rect x="100" y="0" width="100" height="270"/></clipPath>
  </defs>
  <g transform="translate(0 -60) scale(1)">
    <path class="lf-shackle" d="M62 124 V74 a38 38 0 0 1 76 0 V124"/>
    <path class="lf-half lf-left" clip-path="url(#lv-half-l)" d="${HEART_PATH}"/>
    <path class="lf-half lf-right" clip-path="url(#lv-half-r)" d="${HEART_PATH}"/>
  </g>
  <g class="lf-heart lf-heart-l" transform="translate(36 70) scale(2.4)"><path d="${SMALL_HEART}"/></g>
  <g class="lf-heart lf-heart-r" transform="translate(108 70) scale(2.4)"><path d="${SMALL_HEART}"/></g>
</svg>`);

function envelopeScene(recipient) {
  return html`<section class="scene lv-envelope-scene">
    <button class="lv-envelope reveal" type="button" data-envelope aria-expanded="false" aria-controls="lv-letter">
      <span class="env-back" aria-hidden="true"></span>
      <span class="env-paper" aria-hidden="true"></span>
      <span class="env-front" aria-hidden="true"></span>
      <span class="env-flap" aria-hidden="true"></span>
      <span class="env-seal" aria-hidden="true">${SEAL}</span>
      <span class="env-label">Только для ${recipient}</span>
    </button>
    <p class="lv-env-hint reveal">Нажми на конверт</p>
  </section>`;
}

function letterScene({ message, from, sender, song }) {
  return html`<section id="lv-letter" class="scene lv-letter-scene lv-after">
    <article class="lv-letter reveal">
      ${BEAT}
      ${letter({ message, from, sender })}
    </article>
    ${song}
  </section>`;
}

function storyScene(photoUrls, song) {
  const captions = captionsFor(photoUrls.length);
  return html`<section class="scene lv-story lv-after">
    <h2 class="lv-title reveal">Наша история</h2>
    ${photoUrls.map((url, i) => html`<figure class="lv-frame reveal">${photoButton(url, i, photoUrls.length)}<figcaption>${captions[i]}</figcaption></figure>`)}
    ${song}
  </section>`;
}

function finalScene(sender) {
  return html`<section class="scene lv-final lv-after scene-closing">
    <div class="reveal">${HEARTS_FINALE}</div>
    <p class="final-thanks reveal">Среди миллионов людей мне повезло встретить именно тебя.</p>
    <p class="lv-final-sub reveal">Это письмо — лишь маленькая часть того, что я хочу тебе сказать.</p>
    ${finalActions({ sender, action: { id: 'replay', label: 'Открыть ещё раз' } })}
  </section>`;
}

export default {
  /** Щелчок замка, когда ключ поворачивается (см. OPENING_SOUNDS в assets/js/card.js). */
  sound: 'lock-click',

  gate: ({ initial, senderInitial }) => html`
    <i class="lv-halo" aria-hidden="true"></i>
    <p class="lv-lead">Есть кое-что, что давно хочется тебе сказать.</p>
    <p class="lv-lead lv-lead-soft">Но некоторые слова заслуживают особенного момента.</p>
    <button class="gate-btn lock" type="button" aria-label="Повернуть ключ">
      ${lock(`${initial} ♡ ${senderInitial}`)}
      <span class="key" aria-hidden="true">${KEY}</span>
    </button>
    <p class="gate-hint">Поверни ключ</p>`,

  backdrop: () => html`<i class="lv-blob b1"></i><i class="lv-blob b2"></i><i class="lv-blob b3"></i>`,

  /** Письмо и всё после него появляются, когда открыли конверт. Песня — у фото, а без фото — под письмом. */
  story: ({ recipient, sender, message, photoUrls, from, song }) => html`
    ${envelopeScene(recipient)}
    ${letterScene({ message, from, sender, song: photoUrls.length ? '' : song })}
    ${photoUrls.length ? storyScene(photoUrls, song) : ''}
    ${finalScene(sender)}`,

  divider: () => BEAT,
};
