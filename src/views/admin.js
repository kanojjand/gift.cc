import { LIMITS } from '../config.js';
import { getTemplate, TEMPLATES, templatesForTier, TIERS } from '../tiers.js';
import { asset } from './assets.js';
import { html, raw } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';

const adminHead = html`${brandFonts}<link rel="stylesheet" href="${asset('css/admin.css')}"><script src="${asset('js/admin.js')}" defer></script>`;
const DATE_TIME = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Almaty' });
const STATUS_LABELS = { new: 'Свободен', draft: 'Черновик', active: 'Активен', expired: 'Истёк', blocked: 'Снят' };
const QUANTITY_PRESETS = [10, 25, 50, 100];
const NAV = [
  { key: 'batches', href: '/admin', label: 'Коды' },
  { key: 'songs', href: '/admin/songs', label: 'Музыка' },
];
const NOTICES = {
  'batch-created': 'Партия создана. Можно печатать QR.',
  'batch-deleted': 'Партия удалена.',
  'card-blocked': 'Открытка снята, текст и фото удалены.',
  'song-saved': 'Мелодия сохранена.',
  'song-deleted': 'Мелодия удалена.',
};
const ERRORS = {
  'not-found': 'Открытка с таким кодом не найдена.',
  'bad-batch': 'Выберите тип кода и укажите количество от 1 до 500.',
};

const formatDate = (ms) => (ms ? DATE_TIME.format(ms) : '—');
const tierLabel = (template) => (template.tier === 'premium' ? 'Премиум' : 'Обычный');
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
const ownValue = (map, key) => (Object.hasOwn(map, String(key)) ? map[key] : null);

function flash({ notice, error, errorText }) {
  const success = ownValue(NOTICES, notice);
  const failure = errorText ?? ownValue(ERRORS, error);
  return html`${success ? html`<p class="flash ok" role="status">${success}</p>` : ''}${failure ? html`<p class="flash bad" role="alert">${failure}</p>` : ''}`;
}

function shell(title, body, { active, ...messages } = {}) {
  return documentPage({
    title: `${title} · Админка`,
    head: adminHead,
    bodyClass: 'admin',
    body: html`<header class="top">
      ${brandLockup('/admin')}
      <nav aria-label="Разделы">
        ${NAV.map((item) => html`<a href="${item.href}" ${item.key === active ? raw('aria-current="page"') : ''}>${item.label}</a>`)}
        <a class="nav-site" href="/" target="_blank" rel="noopener">Сайт</a>
      </nav>
      <form method="post" action="/admin/logout"><button class="link">Выйти</button></form>
    </header><main class="wrap">${flash(messages)}${body}</main>`,
  });
}

export function loginPage(error) {
  return documentPage({
    title: 'Вход',
    head: adminHead,
    bodyClass: 'admin login',
    body: html`<form class="panel login-box" method="post" action="/admin/login">
      ${brandLockup('/admin/login')}
      <h1>Вход в админку</h1>
      ${error ? html`<p class="flash bad" role="alert">${error}</p>` : ''}
      <label>Пароль<input type="password" name="password" autocomplete="current-password" required autofocus></label>
      <button class="primary">Войти</button>
    </form>`,
  });
}

const funnelTile = (label, value, note) => html`<div><small>${label}</small><b>${value}</b><span>${note}</span></div>`;

function funnel(batches) {
  const sum = (field) => batches.reduce((total, batch) => total + batch[field], 0);
  const [total, activated, opened] = [sum('total'), sum('activated'), sum('opened')];
  return html`<section class="funnel" aria-label="Статистика">
    ${funnelTile('Кодов выпущено', total, '')}
    ${funnelTile('Активировано', activated, `${percent(activated, total)}% от кодов`)}
    ${funnelTile('Открыто получателем', opened, `${percent(opened, activated)}% от активированных`)}
  </section>`;
}

const TIER_SWATCHES = { basic: ['#f3e9dc', '#8c2f39'], premium: ['#0c0b09', '#d9b25f'] };

function tierTile(tier, index) {
  const [background, accent] = TIER_SWATCHES[tier.id];
  const photos = tier.maxPhotos > 1 ? `до ${tier.maxPhotos} фото` : '1 фото';
  return html`<label class="tile" style="--swatch:${background};--swatch-accent:${accent}">
    <input type="radio" name="tier" value="${tier.id}" ${index === 0 ? raw('checked') : ''} required>
    <i class="swatch" aria-hidden="true"></i>
    <b>${tier.label}</b>
    <small>${templatesForTier(tier.id).length} шаблонов · ${photos}</small>
  </label>`;
}

function createBatchForm(songsLoaded, baseUrl) {
  return html`<section class="panel">
    <h1>Новые QR-коды</h1>
    <form method="post" action="/admin/batches">
      <fieldset class="tiles tiles-two"><legend>1. Тип кода</legend>
        ${Object.values(TIERS).map(tierTile)}
      </fieldset>
      <div class="create-row">
        <label>2. Сколько кодов
          <input id="quantity" type="number" name="quantity" min="1" max="${LIMITS.batchSize}" value="10" required>
          <span class="presets">${QUANTITY_PRESETS.map((qty) => html`<button class="chip" type="button" data-qty="${qty}">${qty}</button>`)}</span>
        </label>
        <label>3. Заметка, необязательно<input name="label" maxlength="80" placeholder="Например, магазин Роза, март"></label>
        <button class="primary big">Создать коды</button>
      </div>
    </form>
    <p class="hint">Коды ведут на ${baseUrl}. Шаблон покупатель выбирает сам. Музыка: ${songsLoaded} из ${TEMPLATES.length * LIMITS.songSlots}.</p>
  </section>`;
}

function batchRow(batch) {
  return html`<tr>
    <td><a href="/admin/batches/${batch.id}">Партия №${batch.id}</a>${batch.label ? html`<small>${batch.label}</small>` : ''}</td>
    <td>${TIERS[batch.tier].label}</td>
    <td class="num">${batch.total}</td><td class="num">${batch.unused}</td><td class="num">${batch.drafts}</td><td class="num">${batch.activated}</td><td class="num">${batch.opened}</td>
    <td>${formatDate(batch.createdAt)}</td>
  </tr>`;
}

const findForm = html`<form class="find" method="get" action="/admin/find" role="search">
  <input name="q" required aria-label="Код, ссылка или текст жалобы" placeholder="Найти открытку: код, ссылка или текст жалобы">
  <button class="ghost">Найти</button>
</form>`;

export function dashboardPage({ batches, baseUrl, songsLoaded, notice, error }) {
  return shell(
    'Коды',
    html`${funnel(batches)}${findForm}${createBatchForm(songsLoaded, baseUrl)}
    <section class="panel">
      <h2>Партии</h2>
      ${batches.length === 0
        ? html`<p class="hint">Партий пока нет. Создайте первую выше.</p>`
        : html`<div class="table-scroll"><table>
            <thead><tr><th>Партия</th><th>Тип</th><th class="num">Всего</th><th class="num">Свободно</th><th class="num">Черновики</th><th class="num">Активировано</th><th class="num">Открыто</th><th>Создана</th></tr></thead>
            <tbody>${batches.map(batchRow)}</tbody>
          </table></div>`}
    </section>`,
    { active: 'batches', notice, error },
  );
}

function cardRow(card, urlOf, found) {
  const canBlock = card.status === 'draft' || card.status === 'active';
  const url = urlOf(card.code);
  return html`<tr id="${card.code}" class="${card.code === found ? 'found' : ''}">
    <td><a href="${url}" target="_blank" rel="noopener"><code>${card.code}</code></a></td>
    <td><span class="status s-${card.status}">${STATUS_LABELS[card.status]}</span></td>
    <td>${getTemplate(card.templateId)?.name ?? '—'}</td>
    <td>${card.recipient ?? '—'}</td>
    <td>${formatDate(card.expiresAt)}</td>
    <td class="num">${card.openCount}</td>
    <td class="row-actions">
      <button class="ghost small" type="button" data-copy="${url}">Ссылка</button>
      <a class="ghost small" href="/admin/cards/${card.code}/qr.png">QR</a>
      ${canBlock ? html`<form method="post" action="/admin/cards/${card.code}/block"><button class="danger small" data-confirm="Снять открытку? Текст и фото будут удалены безвозвратно.">Снять</button></form>` : ''}
    </td>
  </tr>`;
}

function statusFilters(batch, cards, filter) {
  const countOf = (status) => cards.filter((card) => card.status === status).length;
  const statuses = Object.keys(STATUS_LABELS).filter((status) => countOf(status) > 0);
  const chip = (href, label, count, active) => html`<a class="chip" href="${href}" ${active ? raw('aria-current="true"') : ''}>${label} <b>${count}</b></a>`;
  return html`<nav class="filters" aria-label="Фильтр по статусу">
    ${chip(`/admin/batches/${batch.id}`, 'Все', cards.length, !filter)}
    ${statuses.map((status) => chip(`/admin/batches/${batch.id}?status=${status}`, STATUS_LABELS[status], countOf(status), filter === status))}
  </nav>`;
}

export function batchPage({ batch, cards, urlOf, filter, found, notice }) {
  const activeFilter = ownValue(STATUS_LABELS, filter) ? filter : null;
  const visible = activeFilter ? cards.filter((card) => card.status === activeFilter) : cards;
  const canDelete = batch.total === batch.unused;
  return shell(
    `Партия №${batch.id}`,
    html`<p class="back"><a href="/admin">← Все партии</a></p>
    <section class="panel">
      <div class="title-row">
        <div><h1>Партия №${batch.id}</h1><p class="hint">${TIERS[batch.tier].label}${batch.label ? ` · ${batch.label}` : ''}</p></div>
        <div class="batch-actions">
          ${canDelete ? html`<form method="post" action="/admin/batches/${batch.id}/delete"><button class="danger" data-confirm="Удалить всю партию? Напечатанные коды перестанут работать.">Удалить</button></form>` : ''}
          <a class="ghost" href="/admin/batches/${batch.id}/codes.csv">Ссылки в CSV</a>
          <a class="primary" href="/admin/batches/${batch.id}/print" target="_blank" rel="noopener">Печать QR</a>
        </div>
      </div>
      ${statusFilters(batch, cards, activeFilter)}
      <div class="table-scroll"><table>
        <thead><tr><th>Код</th><th>Статус</th><th>Шаблон</th><th>Кому</th><th>Истекает</th><th class="num">Открытий</th><th>Действия</th></tr></thead>
        <tbody>${visible.map((card) => cardRow(card, urlOf, found))}</tbody>
      </table></div>
    </section>`,
    { active: 'batches', notice },
  );
}

export function printPage({ batch, items }) {
  return documentPage({
    title: `Печать партии №${batch.id}`,
    head: html`<link rel="stylesheet" href="${asset('css/print.css')}"><script src="${asset('js/admin.js')}" defer></script>`,
    bodyClass: 'print',
    body: html`<div class="screen-note">
        <span>${items.length ? `Партия №${batch.id}: свободных кодов ${items.length}.` : 'Свободных кодов в этой партии нет.'}</span>
        ${items.length ? html`<button id="print-now" type="button">Печатать</button>` : ''}
      </div>
      <div class="sheet">${items.map((item) => html`<article class="tag">
        <div class="qr">${raw(item.svg)}</div>
        <p class="tag-title">Для тебя есть поздравление</p>
        <p class="tag-sub">Наведи камеру на код</p>
        <p class="tag-meta">${TIERS[batch.tier].label} · CC Lab · ${item.code}</p>
      </article>`)}</div>`,
  });
}

function songSlot(template, slot, song, storage) {
  return html`<form class="slot" method="post" enctype="multipart/form-data" action="/admin/songs/${template.id}/${slot}">
    <b class="slot-n">${slot}</b>
    <input name="title" maxlength="80" placeholder="Название мелодии" value="${song?.title ?? ''}" required aria-label="Название мелодии ${slot}">
    <input type="file" name="file" accept=".mp3,.m4a,.aac,.ogg,.wav,audio/*" aria-label="Файл мелодии ${slot}">
    <button class="primary small">${song ? 'Сохранить' : 'Загрузить'}</button>
    ${song ? html`<audio controls preload="none" src="/media/s/${song.file}"></audio>
      <button class="danger small" formaction="/admin/songs/${song.id}/delete" formnovalidate formenctype="application/x-www-form-urlencoded" data-confirm="Удалить эту мелодию?">Удалить</button>
      <small class="song-size">Размер: ${formatSize(storage.songSize(song.file))}</small>` : ''}
  </form>`;
}

function templateSongs(template, songs, storage, isOpen) {
  const slots = Array.from({ length: LIMITS.songSlots }, (_, i) => i + 1);
  const isFull = songs.length === LIMITS.songSlots;
  return html`<details class="panel tpl" id="${template.id}" ${isOpen ? raw('open') : ''}>
    <summary>
      <i class="swatch" style="--swatch:${template.bg};--swatch-accent:${template.accent}" aria-hidden="true"></i>
      <b>${template.name}</b>
      <small>${tierLabel(template)}</small>
      <span class="count ${isFull ? 'full' : ''}">${songs.length}/${LIMITS.songSlots}</span>
    </summary>
    ${slots.map((slot) => songSlot(template, slot, songs.find((song) => song.slot === slot), storage))}
    <p class="hint"><a href="/demo/${template.id}" target="_blank" rel="noopener">Посмотреть шаблон</a></p>
  </details>`;
}

export function songsPage({ repo, storage, error, notice, open }) {
  const entries = TEMPLATES.map((template) => ({ template, songs: repo.listSongs(template.id) }));
  const total = entries.reduce((sum, entry) => sum + entry.songs.length, 0);
  const firstIncomplete = entries.find((entry) => entry.songs.length < LIMITS.songSlots)?.template.id;
  const openId = getTemplate(open)?.id ?? firstIncomplete;
  return shell(
    'Музыка',
    html`<div class="title-row page-head">
      <div><h1>Музыка</h1><p class="hint">Файл до 60 МБ. Сервер сам обрежет песню до 90 секунд и сожмёт её.</p></div>
      <p class="total"><b>${total}</b> из ${TEMPLATES.length * LIMITS.songSlots} мелодий</p>
    </div>
    ${entries.map(({ template, songs }) => templateSongs(template, songs, storage, template.id === openId))}`,
    { active: 'songs', notice, errorText: error },
  );
}
