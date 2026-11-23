import { html, raw } from '../../src/views/html.js';
import { finalActions, letter, photoButton } from '../story.js';

/**
 * «Сияние» — свет, который есть в тебе. Сценарий: тёмное небо, жемчужина «коснись его» → волны света, сияние
 * заливает экран → в свете по очереди проступают и растворяются слова, затем имя → послание → «Созвездие
 * воспоминаний»: фото как светящиеся звёзды, соединённые линиями → звёзды стягиваются к жемчужине, вспышка,
 * «Продолжай сиять, Имя», «Зажечь ещё одну звезду».
 */

const LONG_NAME_CHARS = 10;

const HORIZON = raw(`<svg class="au-horizon" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
  <path class="far" d="M0 120 V70 L40 52 L82 74 L130 40 L176 66 L222 34 L270 62 L318 44 L360 64 L400 50 V120Z"/>
  <path class="near" d="M0 120 V92 L56 74 L104 96 L160 78 L214 98 L268 80 L330 100 L400 84 V120Z"/>
</svg>`);

/** Слова, которые проступают в свете одно за другим. */
const LIGHT_WORDS = ['Смелость', 'Вдохновение', 'Возможности', 'Счастье', 'Любовь'];

/** Звёзды-фото в созвездии: x, y в процентах неба, для 1-5 фото. Линии соединяют их по порядку. */
const CONSTELLATIONS = {
  1: [[50, 50]],
  2: [[28, 40], [72, 62]],
  3: [[20, 62], [50, 28], [80, 58]],
  4: [[16, 62], [38, 30], [64, 48], [86, 22]],
  5: [[12, 64], [32, 34], [54, 56], [74, 26], [90, 60]],
};

/** Звёзды финала, которые стягиваются к жемчужине: углы, под которыми они стоят вокруг неё. */
const GATHER_ANGLES = [0, 60, 120, 180, 240, 300];

function wordsScene(recipient) {
  return html`<section class="scene au-words">
    <div class="au-waves" aria-hidden="true"><i></i><i></i><i></i></div>
    <ul class="au-word-list" aria-label="${LIGHT_WORDS.join(', ')}">
      ${LIGHT_WORDS.map((word, i) => html`<li style="--i:${i}" aria-hidden="true">${word}</li>`)}
    </ul>
    <p class="au-name${[...recipient].length > LONG_NAME_CHARS ? ' name-long' : ''}">${recipient}</p>
    <p class="scroll-hint au-after-words">Листай вниз</p>
  </section>`;
}

function messageScene({ recipient, message, from, sender, song }) {
  return html`<section class="scene au-message">
    <article class="au-panel reveal">
      <h2 class="au-panel-name">${recipient},</h2>
      ${letter({ message, from, sender })}
    </article>
    ${song}
  </section>`;
}

function skyScene(photoUrls, song) {
  const points = CONSTELLATIONS[photoUrls.length];
  return html`<section class="scene au-sky">
    <h2 class="au-title reveal">Созвездие воспоминаний</h2>
    <div class="au-constellation reveal">
      ${raw(`<svg class="au-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline pathLength="100" points="${points.map(([x, y]) => `${x},${y}`).join(' ')}"/></svg>`)}
      ${photoUrls.map((url, i) => photoButton(url, i, photoUrls.length, 'au-star-photo', `--x:${points[i][0]}%;--y:${points[i][1]}%;--i:${i}`))}
    </div>
    <p class="au-note reveal">Коснись звезды, чтобы увидеть фото</p>
    ${song}
  </section>`;
}

function finalScene(recipient, sender) {
  return html`<section class="scene au-final scene-closing">
    <div class="au-new-stars" aria-hidden="true"></div>
    <div class="au-gather" aria-hidden="true">
      ${GATHER_ANGLES.map((angle, i) => html`<i class="au-gather-star" style="--a:${angle}deg;--i:${i}"></i>`)}
      <span class="au-final-orb"></span>
    </div>
    <p class="final-thanks reveal">Продолжай сиять, ${recipient}.</p>
    ${finalActions({ sender, action: { id: 'new-star', label: 'Зажечь ещё одну звезду' } })}
  </section>`;
}

export default {
  gate: ({ recipient }) => html`
    <p class="au-kicker">Для ${recipient}</p>
    <p class="au-lead">У каждого человека есть свой свет.</p>
    <p class="au-lead au-lead-soft">Сегодня я хочу напомнить тебе о твоём.</p>
    <button class="gate-btn pearl" type="button" aria-label="Коснуться света">
      <i class="ring r1" aria-hidden="true"></i><i class="ring r2" aria-hidden="true"></i><i class="ring r3" aria-hidden="true"></i>
      <span class="orb" aria-hidden="true"></span>
    </button>
    <p class="gate-hint">Коснись его</p>`,

  backdrop: () => html`<i class="ribbon rb1"></i><i class="ribbon rb2"></i><i class="ribbon rb3"></i>${HORIZON}`,

  /** Песня — в созвездии с фото, а без фото — под посланием. */
  story: ({ recipient, sender, message, photoUrls, from, song }) => html`
    ${wordsScene(recipient)}
    ${messageScene({ recipient, message, from, sender, song: photoUrls.length ? '' : song })}
    ${photoUrls.length ? skyScene(photoUrls, song) : ''}
    ${finalScene(recipient, sender)}`,

  divider: () => html`<span class="au-divider" aria-hidden="true"></span>`,
};
