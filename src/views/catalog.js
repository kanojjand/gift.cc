import { MAX_PHOTOS } from '../tiers.js';
import { stepsBar } from './form.js';
import { html, raw } from './html.js';
import { APP_BAR_COLOR, appHead, documentPage, topBar } from './pages.js';

/** Маленькие картинки шаблонов на карточках каталога. Цвета берутся из первой палитры через CSS-переменные. */
const ICONS = Object.freeze({
  newyear: '<svg viewBox="0 0 100 100"><circle cx="50" cy="44" r="32" class="i-a2"/><path d="M28 56 L50 30 L72 56Z" class="i-ink"/><circle cx="40" cy="34" r="2.5" class="i-ink"/><circle cx="60" cy="40" r="2" class="i-ink"/><path d="M26 74 L74 74 L68 88 L32 88Z" class="i-a"/></svg>',
  birthday: '<svg viewBox="0 0 100 100"><rect x="20" y="44" width="60" height="44" rx="6" class="i-a"/><rect x="14" y="32" width="72" height="16" rx="5" class="i-a"/><rect x="44" y="32" width="12" height="56" class="i-a2"/><path d="M50 32 C36 14 24 22 34 32Z M50 32 C64 14 76 22 66 32Z" class="i-a2"/></svg>',
  love: '<svg viewBox="0 0 100 100"><path d="M34 46 V32 a16 16 0 0 1 32 0 V46" fill="none" stroke-width="7" class="i-stroke"/><path d="M50 90 C22 72 12 58 12 44 C12 32 22 24 32 24 C40 24 46 28 50 34 C54 28 60 24 68 24 C78 24 88 32 88 44 C88 58 78 72 50 90Z" class="i-a"/><circle cx="50" cy="58" r="5" class="i-ink"/></svg>',
  bloom: `<svg viewBox="-50 -50 100 100">${[0, 60, 120, 180, 240, 300].map((angle) => `<path transform="rotate(${angle})" d="M0 0 C-14 -10 -14 -34 0 -40 C14 -34 14 -10 0 0Z" class="i-a"/>`).join('')}${[30, 150, 270].map((angle) => `<path transform="rotate(${angle})" d="M0 0 C-8 -8 -8 -22 0 -26 C8 -22 8 -8 0 0Z" class="i-a2"/>`).join('')}<circle r="7" class="i-ink"/></svg>`,
  aurora: '<svg viewBox="0 0 100 100"><path d="M0 40 C30 20 60 60 100 30 V50 C60 76 30 40 0 60Z" class="i-a" opacity=".7"/><path d="M0 58 C34 44 64 78 100 52 V64 C64 88 34 58 0 72Z" class="i-a2" opacity=".6"/><circle cx="50" cy="28" r="9" class="i-ink"/></svg>',
});

function catalogCard(template, code) {
  const palette = template.palettes[0];
  const colors = palette ?? { bg: template.bg, bg2: template.bg, ink: '#fff', accent: template.accent, accent2: template.accent };
  return html`<article class="cat-card" style="--c-bg:${colors.bg};--c-bg2:${colors.bg2};--c-ink:${colors.ink};--c-a:${colors.accent};--c-a2:${colors.accent2}">
    <a class="cat-art" href="/demo/${template.id}?from=${code}">
      ${template.tag ? html`<span class="cat-tag">${template.tag}</span>` : ''}
      <span class="cat-icon" aria-hidden="true">${raw(ICONS[template.id] ?? '')}</span>
      <span class="cat-name">${template.name}</span>
      ${template.palettes.length ? html`<span class="cat-dots" aria-label="${template.palettes.length} цвета на выбор">${template.palettes.map((item) => html`<i style="background:${item.accent}"></i>`)}</span>` : ''}
    </a>
    <div class="cat-body">
      <p>${template.blurb}</p>
      <div class="cat-actions">
        <a href="/demo/${template.id}?from=${code}">Посмотреть</a>
        <a class="ui-btn small" href="/c/${code}?template=${template.id}">Выбрать</a>
      </div>
    </div>
  </article>`;
}

/**
 * @param {{ card: { code: string }, templates: object[] }} input
 */
export function renderCatalog({ card, templates }) {
  return documentPage({
    title: 'Выберите открытку',
    head: appHead,
    themeColor: APP_BAR_COLOR,
    body: html`<main class="catalog">
      ${topBar()}
      ${stepsBar(1)}
      <p class="eyebrow">Все шаблоны · до ${MAX_PHOTOS} фото · музыка</p>
      <h1>Выберите открытку</h1>
      <p class="catalog-sub">Нажмите на картинку, чтобы посмотреть, как открытка откроется у получателя. Цвет выберете на следующем шаге.</p>
      <div class="cat-grid">${templates.map((template) => catalogCard(template, card.code))}</div>
    </main>`,
  });
}
