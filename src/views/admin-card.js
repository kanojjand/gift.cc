import { QR_STYLES } from '../qr-styles.js';
import { CARD_TERMS, lifetimeLabel } from '../lifetime.js';
import { getPalette, getTemplate } from '../tiers.js';
import { expiryText, formatDate, shell, STATUS_LABELS } from './admin.js';
import { html } from './html.js';

const HAS_CONTENT = new Set(['draft', 'active']);
const EXTEND_TERMS = ['plus-7', 'plus-30', 'plus-365', 'forever'];

const fact = (label, value) => html`<dt>${label}</dt><dd>${value}</dd>`;
const batchLine = (batch) => `Партия №${batch.id}${batch.label ? ` · ${batch.label}` : ''}`;

function termButtons(card, terms) {
  return html`<form class="term-buttons" method="post" action="/admin/cards/${card.code}/term">
    ${terms.map((term) => html`<button class="${term === 'forever' ? 'primary' : 'ghost'}" name="term" value="${term}">${CARD_TERMS[term].label}</button>`)}
  </form>`;
}

/** Сколько ещё хранится открытка и кнопки, которые меняют срок. */
function termPanel(card, batch) {
  if (card.status === 'active') {
    const forever = card.expiresAt === null;
    return html`<div class="term">
      <p class="term-now">${forever ? 'Хранится навсегда' : `Хранится до ${formatDate(card.expiresAt)}`}</p>
      ${termButtons(card, forever ? ['limit-7'] : EXTEND_TERMS)}
      <p class="hint">${forever ? 'Открытка не удалится сама.' : 'Продление считается от текущего срока.'}</p>
    </div>`;
  }
  if (card.status === 'new' || card.status === 'draft') {
    return html`<p class="hint">После активации открытка будет храниться: ${lifetimeLabel(batch.lifetimeDays).toLowerCase()} (настройка партии).</p>`;
  }
  return html`<p class="hint">Открытка уже удалена, продлить её нельзя. Код можно освободить ниже, чтобы использовать этот QR заново.</p>`;
}

function songText(card, songTitle) {
  if (card.musicLink) return html`<a href="${card.musicLink}" target="_blank" rel="noopener noreferrer">${card.musicLink}</a>`;
  return songTitle ?? 'Без музыки';
}

function photoList(card) {
  if (card.photos.length === 0) return 'Нет';
  return html`<div class="thumbs">${card.photos.map((name, index) => {
    const src = `/media/p/${card.code}/${name}`;
    return html`<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="Фото ${index + 1}" loading="lazy"></a>`;
  })}</div>`;
}

function contentPanel(card, songTitle) {
  if (!HAS_CONTENT.has(card.status)) {
    const why = card.status === 'new' ? 'Код ещё не заполнен.' : 'Текст, фото и песня этой открытки удалены.';
    return html`<section class="panel"><h2>Открытка</h2><p class="hint">${why}</p></section>`;
  }
  const template = getTemplate(card.templateId);
  const palette = getPalette(template, card.palette);
  return html`<section class="panel">
    <h2>Открытка</h2>
    <dl class="facts">
      ${fact('Шаблон', `${template?.name ?? '—'}${palette ? ` · ${palette.name}` : ''}`)}
      ${fact('Кому', card.recipient ?? '—')}
      ${fact('От кого', card.sender ?? '—')}
      ${fact('Текст', html`<p class="message-text">${card.message ?? ''}</p>`)}
      ${fact('Фото', photoList(card))}
      ${fact('Песня', songText(card, songTitle))}
    </dl>
  </section>`;
}

function historyPanel(card, batch) {
  return html`<section class="panel">
    <h2>История</h2>
    <dl class="facts">
      ${fact('Партия создана', formatDate(batch.createdAt))}
      ${fact('Последнее изменение', formatDate(card.updatedAt))}
      ${fact('Активирована', formatDate(card.activatedAt))}
      ${fact('Срок хранения', expiryText(card))}
      ${fact('Открытий', String(card.openCount))}
      ${fact('Первое открытие', formatDate(card.firstOpenedAt))}
      ${fact('Последнее открытие', formatDate(card.lastOpenedAt))}
    </dl>
  </section>`;
}

function dangerPanel(card) {
  const canBlock = HAS_CONTENT.has(card.status);
  const canReset = card.status !== 'new';
  if (!canBlock && !canReset) return '';
  return html`<section class="panel danger-zone">
    <h2>Управление кодом</h2>
    <div class="batch-actions">
      ${canBlock ? html`<form method="post" action="/admin/cards/${card.code}/block?back=card"><button class="danger" data-confirm="Снять открытку? Текст и фото удалятся безвозвратно, QR покажет «Открытка недоступна».">Снять с публикации</button></form>` : ''}
      ${canReset ? html`<form method="post" action="/admin/cards/${card.code}/reset"><button class="danger" data-confirm="Освободить код? Открытка, фото и статистика удалятся, а по этому QR можно будет заполнить новую открытку.">Освободить код</button></form>` : ''}
    </div>
    <p class="hint">«Снять» — QR покажет, что открытка недоступна. «Освободить» — QR снова откроет каталог шаблонов, как новый код.</p>
  </section>`;
}

/**
 * Всё про один код: что в открытке, сколько она хранится, когда её открывали, и что с ней можно сделать.
 * @param {{ card: object, batch: object, url: string, songTitle: string | null, notice?: string, error?: string }} input
 */
export function cardPage({ card, batch, url, songTitle, notice, error }) {
  return shell(
    `Код ${card.code}`,
    html`<p class="back"><a href="/admin/batches/${batch.id}#${card.code}">← Партия №${batch.id}</a></p>
    <section class="panel">
      <div class="title-row">
        <div>
          <h1><code class="big-code">${card.code}</code></h1>
          <p class="hint"><span class="status s-${card.status}">${STATUS_LABELS[card.status]}</span> ${batchLine(batch)}</p>
        </div>
        <div class="batch-actions">
          <button class="ghost" type="button" data-copy="${url}">Ссылка</button>
          <a class="ghost" href="/admin/cards/${card.code}/qr.png">QR</a>
          <details class="qr-style-menu"><summary class="ghost">QR в стиле…</summary>
            ${Object.entries(QR_STYLES).map(([id, s]) => html`<a href="/admin/cards/${card.code}/qr.svg?style=${id}">${s.name}</a>`)}
          </details>
          <a class="primary" href="${url}" target="_blank" rel="noopener">Открыть</a>
        </div>
      </div>
      ${termPanel(card, batch)}
    </section>
    ${contentPanel(card, songTitle)}
    ${historyPanel(card, batch)}
    ${dangerPanel(card)}`,
    { active: 'batches', notice, error },
  );
}
