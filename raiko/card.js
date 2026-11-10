import { BRAND, whatsappLink } from '../src/brand.js';
import { closingLine, renderBackdrop, renderSceneDecor } from './decor.js';
import { renderDivider, renderGate } from './gates.js';
import { asset, designFileText } from '../src/views/assets.js';
import { html, raw } from '../src/views/html.js';
import { brandMark, contactLinks, documentPage } from '../src/views/pages.js';

const LONG_MESSAGE_CHARS = 280;
const LONG_NAME_CHARS = 10;
const HEXAGON_RADII = [110, 150, 190, 230];

function hexagonPoints(radius) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

const BRAND_HEXAGONS = raw(`<svg class="brand-hex" viewBox="-240 -240 480 480" aria-hidden="true">${HEXAGON_RADII.map((radius) => `<polygon points="${hexagonPoints(radius)}" fill="none" stroke="currentColor"/>`).join('')}</svg>`);
const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' });

const initialOf = (name) => [...name.trim()][0]?.toUpperCase() ?? '♥';

function photoScene(template, photoUrls, decorData) {
  if (photoUrls.length === 0) return '';
  return html`<section class="scene scene-photos">
    ${renderSceneDecor(template.id, 'photos', decorData)}
    <h2 class="reveal section-title">${template.labels.photos}</h2>
    <div class="photos reveal" data-count="${photoUrls.length}">
      ${photoUrls.map((url) => html`<figure><img src="${url}" alt="Фото из поздравления" loading="lazy" decoding="async"></figure>`)}
    </div>
    ${photoUrls.length > 1 ? html`<p class="swipe-hint reveal">Листай в сторону</p>` : ''}
  </section>`;
}

function closingScene(templateId, sender, decorData) {
  const thanksText = encodeURIComponent(`${sender}, спасибо за поздравление! Мне очень приятно.`);
  return html`<section class="scene scene-closing"><div class="panel">
    ${renderSceneDecor(templateId, 'closing', decorData)}
    <p class="reveal final-thanks">${closingLine(templateId)}</p>
    <a class="thanks reveal" href="https://wa.me/?text=${thanksText}" rel="noopener">Сказать спасибо</a>
    <button id="to-brand" class="next-btn reveal" type="button">Далее <span aria-hidden="true">→</span></button>
  </div></section>`;
}

function brandPage(mode, code) {
  const reportText = `Жалоба на открытку ${code}`;
  return html`<section id="brand-page" class="brand-page" aria-label="О нас" hidden>
    ${BRAND_HEXAGONS}
    <button id="brand-back" class="brand-back" type="button"><span aria-hidden="true">←</span> К поздравлению</button>
    <div class="brand-inner">
      ${brandMark()}
      <p class="brand-name">${BRAND.name}<small>Code Collective Laboratory</small></p>
      <p class="brand-tagline">${BRAND.tagline}</p>
      <nav class="final-links" aria-label="Контакты">${contactLinks()}</nav>
      <a class="order-same" href="/">Хочу подарить такое же</a>
      ${mode === 'live' ? html`<a class="report" href="${whatsappLink(reportText)}" rel="noopener">Пожаловаться на открытку</a>` : ''}
    </div>
  </section>`;
}

function draftControls() {
  return html`<div class="draft-bar">
      <span class="draft-label">Демо: проверьте открытку перед активацией</span>
      <div class="draft-actions">
        <a id="edit" class="ui-btn ghost" href="?edit=1">Редактировать</a>
        <button id="activate" class="ui-btn" type="button">Активировать</button>
      </div>
    </div>
    <dialog id="confirm-dialog" class="confirm">
      <h2>Активировать открытку?</h2>
      <p>После активации изменить её будет нельзя. Открытка будет доступна 7 дней.</p>
      <p id="confirm-error" class="confirm-error" role="alert" hidden></p>
      <div class="confirm-actions">
        <button id="confirm-no" class="ui-btn ghost" type="button">Отмена</button>
        <button id="confirm-yes" class="ui-btn" type="button">Да, активировать</button>
      </div>
    </dialog>`;
}

/**
 * Стили открытки встроены в страницу, шрифты грузятся параллельно и не задерживают первый экран:
 * на телефоне открытка показывается сразу после HTML. Имя на первом экране проявляется, когда шрифт готов.
 */
function headLinks(template) {
  const fontsUrl = `https://fonts.googleapis.com/css2?${template.fonts}&display=swap`;
  return html`
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="${fontsUrl}">
    <link id="card-fonts" rel="stylesheet" href="${fontsUrl}" media="print">
    <noscript><link rel="stylesheet" href="${fontsUrl}"></noscript>
    <style>${raw(designFileText('css/card-base.css'))}${raw(designFileText(`css/${template.id}.css`))}</style>
    <script src="${asset('design/js/card.js')}" defer></script>`;
}

/**
 * @param {{ template: object, sender: string, recipient: string, message: string, photoUrls: string[],
 *   songUrl: string | null, mode: 'live' | 'draft' | 'demo', code?: string, activatedNotice?: boolean, expiresAt?: number }} card
 */
export function renderCard({ template, sender, recipient, message, photoUrls, songUrl, mode, code, activatedNotice, expiresAt }) {
  const decorData = { initial: initialOf(recipient) };
  const gate = renderGate(template.id, { recipient, ...decorData, firstPhoto: photoUrls[0] ?? null });
  const longClass = [...message].length > LONG_MESSAGE_CHARS ? 'long' : '';
  return documentPage({
    title: `${recipient}, это поздравление тебе`,
    themeColor: template.bg,
    head: html`${headLinks(template)}${mode === 'draft' ? html`<script src="${asset('js/draft.js')}" defer></script>` : ''}`,
    bodyClass: `locked mode-${mode}`,
    body: html`<main class="card t-${template.id} fonts-wait" data-fx="${template.fx}" data-open-ms="${template.openMs}" data-code="${code ?? ''}" data-track="${mode === 'live' && !activatedNotice ? '1' : '0'}">
      <div class="backdrop" aria-hidden="true">${renderBackdrop(template.id)}</div>
      <canvas class="fx" aria-hidden="true"></canvas>
      ${songUrl ? html`<audio class="bg-music" src="${songUrl}" loop preload="none"></audio>
        <button class="mute" type="button" aria-label="Выключить музыку" aria-pressed="false" hidden>♪</button>` : ''}
      <section class="gate">
        ${activatedNotice ? html`<p class="activated-note">Готово! Открытка активна до ${DATE_FORMAT.format(expiresAt)}</p>` : ''}
        ${mode === 'demo' ? html`<p class="demo-note">Пример шаблона</p>` : ''}
        ${gate}
      </section>
      <div class="scenes">
        <section class="scene scene-hello">
          <div class="panel">
            ${renderSceneDecor(template.id, 'hello', decorData)}
            <p class="eyebrow reveal">${template.labels.eyebrow}</p>
            <h1 class="recipient reveal ${[...recipient].length > LONG_NAME_CHARS ? 'name-long' : ''}">${recipient}</h1>
            <div class="reveal">${renderDivider(template.id)}</div>
          </div>
          <p class="scroll-hint reveal">Листай вниз</p>
        </section>
        <section class="scene scene-message">
          <div class="panel">
            ${renderSceneDecor(template.id, 'message', decorData)}
            <blockquote class="message ${longClass} reveal">${message}</blockquote>
            <p class="signature reveal"><span>${template.labels.from}</span> <b>${sender}</b></p>
          </div>
        </section>
        ${photoScene(template, photoUrls, decorData)}
        ${closingScene(template.id, sender, decorData)}
      </div>
      ${brandPage(mode, code)}
      ${mode === 'draft' ? draftControls() : ''}
    </main>`,
  });
}
