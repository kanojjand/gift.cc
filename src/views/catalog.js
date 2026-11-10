import { TIERS } from '../tiers.js';
import { asset } from './assets.js';
import { html } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';

function catalogCard(template, code) {
  return html`<article class="cat-card" style="--swatch:${template.bg};--swatch-accent:${template.accent}">
    <div class="cat-art"><span>${template.name}</span></div>
    <div class="cat-body">
      <p>${template.blurb}</p>
      <div class="cat-actions">
        <a href="/demo/${template.id}" target="_blank" rel="noopener">Посмотреть</a>
        <a class="ui-btn small" href="/c/${code}?template=${template.id}">Выбрать</a>
      </div>
    </div>
  </article>`;
}

/**
 * @param {{ card: { code: string, tier: string }, templates: object[] }} input
 */
export function renderCatalog({ card, templates }) {
  const tier = TIERS[card.tier];
  const photos = tier.maxPhotos > 1 ? `до ${tier.maxPhotos} фото` : '1 фото';
  return documentPage({
    title: 'Выберите открытку',
    head: html`${brandFonts}<link rel="stylesheet" href="${asset('css/app.css')}">`,
    body: html`<main class="catalog">
      ${brandLockup()}
      <p class="eyebrow">${tier.label} код · ${photos}</p>
      <h1>Выберите открытку</h1>
      <div class="cat-grid">${templates.map((template) => catalogCard(template, card.code))}</div>
    </main>`,
  });
}
