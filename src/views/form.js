import { LIMITS } from '../config.js';
import { asset } from './assets.js';
import { html } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';
import { occasionsForTier, suggestedOccasion, TEXT_LANGS } from '../texts.js';

const LANG_LABELS = Object.freeze({ ru: 'Рус', kk: 'Қаз' });

/** Готовые тексты: язык, повод и три варианта. Выбранный текст попадает в поле, его можно поправить. */
function textPicker(tierId, today) {
  const occasions = occasionsForTier(tierId);
  const current = suggestedOccasion(today);
  const premium = tierId === 'premium';
  return html`<div id="text-picker" class="text-picker${premium ? ' is-premium' : ''}" data-lang="ru" data-occ="${current}">
    <div class="tp-head">
      <span class="tp-title">${premium ? 'Премиум-тексты' : 'Готовые тексты'}</span>
      <div class="tp-lang" role="group" aria-label="Язык готовых текстов">
        ${TEXT_LANGS.map((lang) => html`<button type="button" data-lang="${lang}" aria-pressed="${lang === 'ru' ? 'true' : 'false'}">${LANG_LABELS[lang]}</button>`)}
      </div>
    </div>
    <div class="tp-occasions" role="group" aria-label="Повод">
      ${occasions.map((occasion) => html`<button class="chip" type="button" data-occ="${occasion.id}" aria-pressed="${occasion.id === current ? 'true' : 'false'}">${TEXT_LANGS.map((lang) => html`<span lang="${lang}" data-l="${lang}">${occasion.name[lang]}</span>`)}</button>`)}
    </div>
    ${occasions.flatMap((occasion) =>
      TEXT_LANGS.map((lang) => html`<div class="tp-variants" data-occ="${occasion.id}" data-lang="${lang}" lang="${lang}" ${occasion.id === current && lang === 'ru' ? '' : 'hidden'}>
        ${occasion.texts[lang].map((text, index) => html`<button class="variant" type="button" aria-pressed="false">
          <small>Вариант ${index + 1}</small><span class="variant-text">${text}</span>
        </button>`)}
      </div>`),
    )}
  </div>`;
}

function photoField(maxPhotos, card) {
  const existing = card.photos.map((name) => ({ name, url: `/media/p/${card.code}/${name}` }));
  const label = maxPhotos > 1 ? `Фото, до ${maxPhotos} шт. (по желанию)` : 'Фото (по желанию)';
  return html`<fieldset class="field">
    <legend>${label}</legend>
    <div id="photo-list" class="photo-list" data-max="${maxPhotos}">
      ${existing.map(({ name, url }) => html`<div class="thumb" data-keep="${name}">
        <img src="${url}" alt=""><button type="button" class="thumb-x" aria-label="Убрать фото">×</button>
      </div>`)}
      <label class="thumb add" id="photo-add">
        <input id="photo-input" type="file" accept="image/*" ${maxPhotos > 1 ? 'multiple' : ''} hidden>
        <span aria-hidden="true">+</span><small>Добавить</small>
      </label>
    </div>
    <p id="photo-error" class="field-error" role="alert"></p>
  </fieldset>`;
}

function songField(songs, card) {
  if (songs.length === 0) return '';
  const selected = card.templateId === songs[0].templateId ? card.songId : songs[0].id;
  return html`<fieldset class="field">
    <legend>Музыка</legend>
    <div class="song-list">
      ${songs.map((song) => html`<label class="song">
        <input type="radio" name="songId" value="${song.id}" ${song.id === selected ? 'checked' : ''}>
        <span class="song-name">${song.title}</span>
        <button class="song-play" type="button" data-src="/media/s/${song.file}" aria-label="Послушать: ${song.title}">▶</button>
      </label>`)}
      <label class="song">
        <input type="radio" name="songId" value="" ${selected === null ? 'checked' : ''}>
        <span class="song-name">Без музыки</span>
      </label>
    </div>
  </fieldset>`;
}

/**
 * @param {{ card: object, template: object, songs: object[], maxPhotos: number, today?: number }} input
 */
export function renderForm({ card, template, songs, maxPhotos, today = Date.now() }) {
  return documentPage({
    title: `Открытка «${template.name}»`,
    head: html`${brandFonts}<link rel="stylesheet" href="${asset('css/app.css')}"><script src="${asset('js/form.js')}" defer></script>`,
    bodyClass: 'form-page',
    body: html`<main class="form-wrap">
      <header class="form-head">
        ${brandLockup()}
        <a class="back-link" href="/c/${card.code}?pick=1">← Другой шаблон</a>
        <h1>${template.name}</h1>
        <p class="form-sub">${template.blurb}.</p>
      </header>
      <form id="greeting-form" data-code="${card.code}" data-template="${template.id}" novalidate>
        <label class="field"><span>От кого</span>
          <input name="sender" maxlength="${LIMITS.senderLength}" autocomplete="off" required value="${card.sender ?? ''}" placeholder="Ваше имя">
          <em class="field-error" data-error="sender"></em></label>
        <label class="field"><span>Кому</span>
          <input name="recipient" maxlength="${LIMITS.recipientLength}" autocomplete="off" required value="${card.recipient ?? ''}" placeholder="Имя получателя">
          <em class="field-error" data-error="recipient"></em></label>
        <div class="field">
          <label for="message">Текст поздравления</label>
          <p class="field-hint">Выберите готовый текст или напишите свой. Готовый текст можно изменить.</p>
          ${textPicker(card.tier, today)}
          <textarea id="message" name="message" rows="7" maxlength="${LIMITS.messageLength}" required placeholder="Напишите свои слова или выберите готовый текст выше">${card.message ?? ''}</textarea>
          <div class="message-foot">
            <button id="message-undo" class="link-btn" type="button" hidden>Вернуть мой текст</button>
            <small id="message-count" class="counter" aria-live="polite"></small>
          </div>
          <em class="field-error" data-error="message"></em>
        </div>
        ${photoField(maxPhotos, card)}
        ${songField(songs, card)}
        <p id="form-error" class="form-error" role="alert"></p>
        <button id="submit" class="ui-btn wide" type="submit">Далее</button>
        <p class="form-note">На следующем шаге вы увидите демо. Пока открытка не активирована, её можно изменить.</p>
      </form>
    </main>`,
  });
}
