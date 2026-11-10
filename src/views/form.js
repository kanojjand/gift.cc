import { LIMITS } from '../config.js';
import { asset } from './assets.js';
import { html } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';

const PHRASES = Object.freeze([
  ['День рождения', 'С днём рождения! Пусть этот год подарит тебе много радости, тёплых встреч и исполнит то, о чём ты мечтаешь.'],
  ['8 марта', 'С 8 Марта! Пусть в твоей жизни всегда будет весна: много цветов, улыбок и людей, которые тебя берегут.'],
  ['Любимой', 'Ты делаешь каждый мой день лучше. Спасибо, что ты есть. Эти цветы только малая часть того, что я хочу тебе сказать.'],
  ['Маме', 'Мама, спасибо за твою заботу, терпение и любовь. Пусть рядом с тобой всегда будет тепло, а сердце будет спокойно.'],
  ['Спасибо', 'Спасибо за всё, что ты делаешь. Твоя доброта очень много значит, и мне захотелось сказать об этом именно так.'],
  ['Просто так', 'Без особого повода. Просто хочу подарить тебе повод улыбнуться и напомнить, что о тебе думают.'],
]);

const PHRASES_KK = Object.freeze([
  ['Туған күн', 'Туған күніңмен құттықтаймын! Саған зор денсаулық, шексіз бақыт және барлық арманыңның орындалуын тілеймін.'],
  ['8 наурыз', '8 наурыз мерекесімен құттықтаймын! Өміріңде әрқашан көктемдей шуақ пен қуаныш болсын.'],
  ['Анаға', 'Анашым, мейірімің мен қамқорлығың үшін рақмет! Әрқашан аман-сау бол.'],
  ['Рақмет', 'Жасаған жақсылығың үшін шын жүректен рақмет! Өзіңе де сондай жақсылық оралсын.'],
]);

function phraseChips(phrases, label) {
  return html`<div class="chips" role="group" aria-label="${label}">
    ${phrases.map(([name, text]) => html`<button class="chip" type="button" data-text="${text}">${name}</button>`)}
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
 * @param {{ card: object, template: object, songs: object[], maxPhotos: number }} input
 */
export function renderForm({ card, template, songs, maxPhotos }) {
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
          ${phraseChips(PHRASES, 'Готовые тексты на русском')}
          ${phraseChips(PHRASES_KK, 'Готовые тексты на казахском')}
          <textarea id="message" name="message" rows="6" maxlength="${LIMITS.messageLength}" required placeholder="Напишите свои слова или выберите готовые">${card.message ?? ''}</textarea>
          <small id="message-count" class="counter" aria-live="polite"></small>
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
