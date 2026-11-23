import { html } from '../src/views/html.js';

/**
 * Общие части историй новых шаблонов (story в файлах тем): песня, фото, письмо с подписью, финальные кнопки.
 * Всё, что пишет покупатель (имена, текст, адреса фото), вставляется только через html — значения экранируются.
 */

const LONG_MESSAGE_CHARS = 280;
const SONG_LABEL = 'Эта песня — для тебя';
const PLAYER_PERMISSIONS = 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write';

function songPlayer(music) {
  return html`<div class="song-player" data-service="${music.service}" style="${music.height ? `--player-h:${music.height}px` : ''}">
    <iframe data-src="${music.controlSrc ?? music.src}" ${music.controlSrc ? html`data-autoplay="${music.service}"` : ''} title="Песня в открытке, ${music.name}" allow="${PLAYER_PERMISSIONS}" referrerpolicy="strict-origin"></iframe>
  </div>`;
}

function songPlaceholder() {
  return html`<div class="song-player song-demo">
    <span class="song-demo-note" aria-hidden="true">♪</span>
    <b>Здесь будет ваша песня</b>
    <small>Ссылка из YouTube, Spotify, Apple Music или Яндекс Музыки</small>
  </div>`;
}

/**
 * Песня, которую выбрал отправитель, в официальном плеере сервиса. Плеер грузится по касанию первого экрана,
 * а включается, когда до него долистали и он на виду (так требует YouTube). Если браузер не дал включить звук
 * (iPhone разрешает его только после нажатия на сам плеер), появляется подсказка. В демо на этом месте заглушка.
 * Подпись над плеером можно задать шаблону в labels.song.
 */
export function songBlock(template, music, mode, revealClass = 'reveal') {
  if (!music && mode !== 'demo') return '';
  return html`<div class="hello-song ${revealClass}">
    <p class="song-label">${template.labels.song ?? SONG_LABEL}</p>
    ${music ? songPlayer(music) : songPlaceholder()}
    ${music ? html`<p class="song-hint" ${music.controlSrc ? 'hidden' : ''}>Нажми ▶ — песня будет играть, пока листаешь</p>` : ''}
  </div>`;
}

/** Фото-кнопка: нажатие открывает фото на весь экран. */
export function photoButton(url, index, total, className = '', style = '') {
  return html`<button class="photo-btn ${className}" type="button" data-photo style="${style}" aria-label="Открыть фото ${index + 1} из ${total}"><img src="${url}" alt="" loading="lazy" decoding="async"></button>`;
}

/** Текст поздравления и подпись отправителя. */
export function letter({ message, from, sender }) {
  return html`<blockquote class="message reveal${[...message].length > LONG_MESSAGE_CHARS ? ' long' : ''}">${message}</blockquote>
    <p class="signature reveal"><span>${from}</span> <b>${sender}</b></p>`;
}

/**
 * Кнопки последнего экрана: действие шаблона (загадать желание, повторить праздник…), «Сказать спасибо»
 * отправителю в WhatsApp и «Далее» — к странице CC Lab.
 * @param {{ sender: string, action: { id: string, label: string } }} input
 */
export function finalActions({ sender, action }) {
  const thanksText = encodeURIComponent(`${sender}, спасибо за поздравление! Мне очень приятно.`);
  return html`<div class="final-actions reveal">
    <button class="story-action" type="button" data-action="${action.id}">${action.label}</button>
    <a class="thanks" href="https://wa.me/?text=${thanksText}" rel="noopener">Сказать спасибо</a>
    <button id="to-brand" class="next-btn" type="button">Далее <span aria-hidden="true">→</span></button>
  </div>`;
}
