import { LIMITS } from '../config.js';
import { asset } from './assets.js';
import { html } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';
import { occasionsForTier, suggestedOccasion, TEXT_LANGS } from '../texts.js';
import { MUSIC_LINK_MAX_LENGTH, musicEmbed, parseMusicLink, startParts } from '../../public/js/music-link.js';

const LANG_LABELS = Object.freeze({ ru: 'Рус', kk: 'Қаз' });
const STEPS = ['Шаблон', 'Текст и фото', 'Проверка'];

/** Где покупатель сейчас: шаг 1 — каталог, 2 — форма, 3 — проверка демо. */
export function stepsBar(current) {
  return html`<ol class="steps" aria-label="Шаги">
    ${STEPS.map((name, index) => {
      const step = index + 1;
      const state = step < current ? 'done' : step === current ? 'on' : '';
      return html`<li class="${state}" ${step === current ? 'aria-current="step"' : ''}><b>${step}</b>${name}</li>`;
    })}
  </ol>`;
}

/** Повод, выбранный сразу: тема шаблона (Новый год, день рождения, любовь), иначе ближайший праздник. */
function startOccasion(occasions, template, today) {
  return occasions.some((occasion) => occasion.id === template.occasion) ? template.occasion : suggestedOccasion(today);
}

/**
 * Текст в поле: сохранённый в черновике, иначе первый готовый вариант повода — покупателю остаётся
 * только поправить или оставить как есть.
 */
function startMessage(card, occasions, occasionId) {
  if (card.message) return card.message;
  return occasions.find((occasion) => occasion.id === occasionId)?.texts.ru[0] ?? '';
}

/** Палитра, отмеченная в форме: выбранная в демо, из черновика этого шаблона или первая. */
function startPalette(card, template) {
  const ids = template.palettes.map((palette) => palette.id);
  if (ids.includes(card.wantedPalette)) return card.wantedPalette;
  if (card.templateId === template.id && ids.includes(card.palette)) return card.palette;
  return ids[0] ?? null;
}

function paletteField(template, selectedId) {
  if (!template.palettes.length) return '';
  return html`<fieldset class="field palette-field">
    <legend>Цвет открытки</legend>
    <div class="palette-list">
      ${template.palettes.map((palette) => html`<label class="palette" style="--p-bg:${palette.bg};--p-bg2:${palette.bg2};--p-ink:${palette.ink};--p-a:${palette.accent};--p-a2:${palette.accent2}">
        <input type="radio" name="palette" value="${palette.id}" ${palette.id === selectedId ? 'checked' : ''}>
        <span class="palette-art" aria-hidden="true"><i></i></span>
        <span class="palette-name">${palette.name}</span>
      </label>`)}
    </div>
    <a id="palette-preview" class="palette-preview" href="/demo/${template.id}?p=${selectedId}" target="_blank" rel="noopener">Посмотреть шаблон в этом цвете ↗</a>
  </fieldset>`;
}

/** Готовые тексты: язык, повод и три варианта. Выбранный текст попадает в поле, его можно поправить. */
function textPicker(tierId, occasions, current) {
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

/**
 * Песня по ссылке: покупатель сам выбирает её в YouTube, Spotify, Apple Music или Яндекс Музыке,
 * играет официальный плеер сервиса. Форма сразу показывает, узнала ли она ссылку, и сам плеер.
 */
/** Момент, с которого начнётся песня. Виден только для YouTube: остальные без подписки играют свой отрывок. */
function musicStart(card) {
  const music = parseMusicLink(card.musicLink);
  const canStart = Boolean(musicEmbed(music)?.canStart);
  const { minutes, seconds } = startParts(canStart ? music.start : 0);
  return html`<div id="music-start" class="music-start" ${canStart ? '' : 'hidden'}>
    <div class="music-start-row">
      <span>Начать с</span>
      <input class="start-num" name="musicStartMin" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="0" value="${minutes}" aria-label="Минуты">
      <span>мин</span>
      <input class="start-num" name="musicStartSec" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="00" value="${seconds}" aria-label="Секунды">
      <span>сек</span>
    </div>
    <p class="field-hint">Например, с припева. Пусто — с самого начала. Нажмите ▶ в плеере ниже и проверьте.</p>
    <em class="field-error" data-error="musicStart"></em>
  </div>`;
}

function musicField(card) {
  return html`<div class="field music-field">
    <label for="music-link">Песня (по желанию)</label>
    <p class="field-hint">Найдите песню в YouTube, Spotify, Apple Music или Яндекс Музыке, нажмите «Поделиться» → «Копировать ссылку» и вставьте сюда.</p>
    <input id="music-link" name="musicLink" type="url" inputmode="url" maxlength="${MUSIC_LINK_MAX_LENGTH}" autocomplete="off" placeholder="https://youtu.be/…" value="${card.musicLink ?? ''}" data-module="${asset('js/music-link.js')}">
    <p id="music-status" class="music-status" aria-live="polite"></p>
    ${musicStart(card)}
    <div id="music-preview" class="music-preview" hidden></div>
    <em class="field-error" data-error="musicLink"></em>
  </div>`;
}

function songField(songs, card) {
  if (songs.length === 0) return '';
  const selected = card.templateId === songs[0].templateId ? card.songId : songs[0].id;
  return html`<fieldset class="field">
    <legend>Или мелодия шаблона</legend>
    <p class="field-hint">Если вставили ссылку на песню, играть будет она.</p>
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

/** Обложка формы в цветах выбранной палитры: при смене палитры перекрашивается сразу. */
function formHero(template, paletteId) {
  const palette = template.palettes.find((item) => item.id === paletteId);
  const colors = palette ?? { bg: template.bg, bg2: template.bg, ink: '#fff', accent: template.accent, accent2: template.accent };
  return html`<div id="form-hero" class="form-hero" style="--p-bg:${colors.bg};--p-bg2:${colors.bg2};--p-ink:${colors.ink};--p-a:${colors.accent};--p-a2:${colors.accent2}">
    ${template.tag ? html`<span class="hero-tag">${template.tag}</span>` : ''}
    <b>${template.name}</b>
    <small>${template.blurb}</small>
  </div>`;
}

/**
 * @param {{ card: object, template: object, songs: object[], maxPhotos: number, today?: number }} input
 */
export function renderForm({ card, template, songs, maxPhotos, today = Date.now() }) {
  const occasions = occasionsForTier(card.tier);
  const occasion = startOccasion(occasions, template, today);
  const paletteId = startPalette(card, template);
  return documentPage({
    title: `Открытка «${template.name}»`,
    head: html`${brandFonts}<link rel="stylesheet" href="${asset('css/app.css')}"><script src="${asset('js/form.js')}" defer></script>`,
    bodyClass: 'form-page',
    body: html`<main class="form-wrap">
      <header class="form-head">
        ${brandLockup()}
        ${stepsBar(2)}
        <a class="back-link" href="/c/${card.code}?pick=1">← Другой шаблон</a>
        ${formHero(template, paletteId)}
      </header>
      <form id="greeting-form" data-code="${card.code}" data-template="${template.id}" novalidate>
        ${paletteField(template, paletteId)}
        <label class="field"><span>Кому</span>
          <input name="recipient" maxlength="${LIMITS.recipientLength}" autocomplete="off" required value="${card.recipient ?? ''}" placeholder="Имя получателя">
          <em class="field-error" data-error="recipient"></em></label>
        <div class="field">
          <label for="message">Текст поздравления</label>
          <p class="field-hint">Мы уже подставили готовый текст. Оставьте его, выберите другой или напишите свой.</p>
          ${textPicker(card.tier, occasions, occasion)}
          <textarea id="message" name="message" rows="7" maxlength="${LIMITS.messageLength}" required placeholder="Напишите свои слова или выберите готовый текст выше">${startMessage(card, occasions, occasion)}</textarea>
          <div class="message-foot">
            <button id="message-undo" class="link-btn" type="button" hidden>Вернуть мой текст</button>
            <small id="message-count" class="counter" aria-live="polite"></small>
          </div>
          <em class="field-error" data-error="message"></em>
        </div>
        <label class="field"><span>От кого</span>
          <input name="sender" maxlength="${LIMITS.senderLength}" autocomplete="off" required value="${card.sender ?? ''}" placeholder="Ваше имя">
          <em class="field-error" data-error="sender"></em></label>
        ${photoField(maxPhotos, card)}
        ${musicField(card)}
        ${songField(songs, card)}
        <p id="form-error" class="form-error" role="alert"></p>
        <button id="submit" class="ui-btn wide" type="submit">Посмотреть открытку</button>
        <p class="form-note">На следующем шаге вы увидите открытку целиком. Пока она не активирована, её можно изменить.</p>
      </form>
    </main>`,
  });
}
