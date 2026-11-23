import { LIMITS } from '../config.js';
import { DEFAULT_LIFETIME_DAYS, LIFETIME_CHOICES, lifetimeLabel, lifetimeValue } from '../lifetime.js';
import { getTemplate, MAX_PHOTOS } from '../tiers.js';
import { asset } from './assets.js';
import { html, raw } from './html.js';
import { brandFonts, brandLockup, documentPage } from './pages.js';

const adminHead = html`${brandFonts}<link rel="stylesheet" href="${asset('css/admin.css')}"><script src="${asset('js/admin.js')}" defer></script>`;
const DATE_TIME = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Almaty' });
export const STATUS_LABELS = Object.freeze({ new: 'Свободен', draft: 'Черновик', active: 'Активен', expired: 'Истёк', blocked: 'Снят' });
const QUANTITY_PRESETS = [10, 25, 50, 100];
const NAV = [
  { key: 'batches', href: '/admin', label: 'Коды' },
  { key: 'stats', href: '/admin/stats', label: 'Статистика' },
];
const NOTICES = {
  'batch-created': 'Партия создана. Можно печатать QR.',
  'batch-deleted': 'Партия удалена.',
  'all-deleted': 'Все партии удалены.',
  'batch-saved': 'Настройки партии сохранены.',
  'card-blocked': 'Открытка снята, текст и фото удалены.',
  'card-term': 'Срок хранения открытки изменён.',
  'card-reset': 'Код освобождён: по этому QR можно заполнить новую открытку.',
};
const ERRORS = {
  'not-found': 'Открытка с таким кодом не найдена.',
  'bad-batch': `Укажите количество от 1 до ${LIMITS.batchSize} и срок хранения из списка.`,
  'bad-lifetime': 'Выберите срок хранения из списка.',
  'bad-term': 'Срок не изменён: открытка уже не активна или страница устарела.',
};

export const formatDate = (ms) => (ms ? DATE_TIME.format(ms) : '—');
/** Срок активной открытки: дата или «навсегда». */
export const expiryText = (card) => (card.status === 'active' && card.expiresAt === null ? 'навсегда' : formatDate(card.expiresAt));
export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const ownValue = (map, key) => (Object.hasOwn(map, String(key)) ? map[key] : null);

function flash({ notice, error, errorText }) {
  const success = ownValue(NOTICES, notice);
  const failure = errorText ?? ownValue(ERRORS, error);
  return html`${success ? html`<p class="flash ok" role="status">${success}</p>` : ''}${failure ? html`<p class="flash bad" role="alert">${failure}</p>` : ''}`;
}

export function shell(title, body, { active, ...messages } = {}) {
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

/** Три главные цифры: сколько кодов выпущено, активировано и открыто получателями. */
export function funnel(batches) {
  const sum = (field) => batches.reduce((total, batch) => total + batch[field], 0);
  const [total, activated, opened] = [sum('total'), sum('activated'), sum('opened')];
  return html`<section class="funnel" aria-label="Главные цифры">
    ${funnelTile('Кодов выпущено', total, '')}
    ${funnelTile('Активировано', activated, `${percent(activated, total)}% от кодов`)}
    ${funnelTile('Открыто получателем', opened, `${percent(opened, activated)}% от активированных`)}
  </section>`;
}

function lifetimeSelect(days) {
  const selected = lifetimeValue(days);
  return html`<select name="lifetime">${LIFETIME_CHOICES.map((choice) => html`<option value="${choice.value}" ${choice.value === selected ? raw('selected') : ''}>${choice.label}</option>`)}</select>`;
}

function createBatchForm(baseUrl) {
  return html`<section class="panel">
    <h1>Новые QR-коды</h1>
    <form method="post" action="/admin/batches">
      <div class="create-row">
        <label>1. Сколько кодов
          <input id="quantity" type="number" name="quantity" min="1" max="${LIMITS.batchSize}" value="10" required>
          <span class="presets">${QUANTITY_PRESETS.map((qty) => html`<button class="chip" type="button" data-qty="${qty}">${qty}</button>`)}</span>
        </label>
        <label>2. Срок хранения${lifetimeSelect(DEFAULT_LIFETIME_DAYS)}</label>
        <label>3. Заметка, необязательно<input name="label" maxlength="80" placeholder="Например, магазин Роза, март"></label>
        <button class="primary big">Создать коды</button>
      </div>
    </form>
    <p class="hint">Коды ведут на ${baseUrl}. Любой код открывает все шаблоны и до ${MAX_PHOTOS} фото. Срок хранения считается с активации.</p>
  </section>`;
}

function batchRow(batch) {
  return html`<tr>
    <td><a href="/admin/batches/${batch.id}">Партия №${batch.id}</a>${batch.label ? html`<small>${batch.label}</small>` : ''}</td>
    <td>${lifetimeLabel(batch.lifetimeDays)}</td>
    <td class="num">${batch.total}</td><td class="num">${batch.unused}</td><td class="num">${batch.drafts}</td><td class="num">${batch.activated}</td><td class="num">${batch.opened}</td>
    <td>${formatDate(batch.createdAt)}</td>
  </tr>`;
}

const findForm = html`<form class="find" method="get" action="/admin/find" role="search">
  <input name="q" required aria-label="Код, ссылка или текст жалобы" placeholder="Найти открытку: код, ссылка или текст жалобы">
  <button class="ghost">Найти</button>
</form>`;

export function dashboardPage({ batches, baseUrl, notice, error }) {
  return shell(
    'Коды',
    html`${funnel(batches)}${findForm}${createBatchForm(baseUrl)}
    <section class="panel">
      <div class="title-row">
        <h2>Партии</h2>
        ${batches.length > 0 ? html`<a class="danger small" href="/admin/delete-all">Удалить все</a>` : ''}
      </div>
      ${batches.length === 0
        ? html`<p class="hint">Партий пока нет. Создайте первую выше.</p>`
        : html`<div class="table-scroll"><table>
            <thead><tr><th>Партия</th><th>Срок</th><th class="num">Всего</th><th class="num">Свободно</th><th class="num">Черновики</th><th class="num">Активировано</th><th class="num">Открыто</th><th>Создана</th></tr></thead>
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
    <td><a href="/admin/cards/${card.code}"><code>${card.code}</code></a></td>
    <td><span class="status s-${card.status}">${STATUS_LABELS[card.status]}</span></td>
    <td>${getTemplate(card.templateId)?.name ?? '—'}</td>
    <td>${card.recipient ?? '—'}</td>
    <td>${expiryText(card)}</td>
    <td class="num">${card.openCount}</td>
    <td class="row-actions">
      <a class="ghost small" href="${url}" target="_blank" rel="noopener">Открыть</a>
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

/** Партию без заполненных открыток удаляет одна кнопка, остальные — через страницу подтверждения. */
function deleteBatchButton(batch) {
  if (batch.total !== batch.unused) return html`<a class="danger" href="/admin/batches/${batch.id}/delete">Удалить</a>`;
  return html`<form method="post" action="/admin/batches/${batch.id}/delete"><button class="danger" data-confirm="Удалить всю партию? Напечатанные коды перестанут работать.">Удалить</button></form>`;
}

function batchSettings(batch) {
  return html`<section class="panel">
    <h2>Настройки партии</h2>
    <form class="settings-row" method="post" action="/admin/batches/${batch.id}/settings">
      <label>Заметка<input name="label" maxlength="80" value="${batch.label}" placeholder="Например, магазин Роза, март"></label>
      <label>Срок хранения открыток${lifetimeSelect(batch.lifetimeDays)}</label>
      <button class="primary">Сохранить</button>
      <label class="check"><input type="checkbox" name="extendActive" value="1">Продлить и уже активные открытки (${batch.live}): срок от их активации, только в большую сторону</label>
    </form>
    <p class="hint">Новый срок получают открытки, которые активируют после сохранения. Отдельную открытку можно продлить на её странице — нажмите на код.</p>
  </section>`;
}

export function batchPage({ batch, cards, urlOf, filter, found, notice, error }) {
  const activeFilter = ownValue(STATUS_LABELS, filter) ? filter : null;
  const visible = activeFilter ? cards.filter((card) => card.status === activeFilter) : cards;
  return shell(
    `Партия №${batch.id}`,
    html`<p class="back"><a href="/admin">← Все партии</a></p>
    <section class="panel">
      <div class="title-row">
        <div><h1>Партия №${batch.id}</h1><p class="hint">Хранение: ${lifetimeLabel(batch.lifetimeDays).toLowerCase()}${batch.label ? ` · ${batch.label}` : ''}</p></div>
        <div class="batch-actions">
          ${deleteBatchButton(batch)}
          <a class="ghost" href="/admin/batches/${batch.id}/codes.csv">Ссылки в CSV</a>
          <a class="primary" href="/admin/batches/${batch.id}/print" target="_blank" rel="noopener">Печать QR</a>
        </div>
      </div>
      ${statusFilters(batch, cards, activeFilter)}
      <div class="table-scroll"><table>
        <thead><tr><th>Код</th><th>Статус</th><th>Шаблон</th><th>Кому</th><th>Истекает</th><th class="num">Открытий</th><th>Действия</th></tr></thead>
        <tbody>${visible.map((card) => cardRow(card, urlOf, found))}</tbody>
      </table></div>
    </section>
    ${batchSettings(batch)}`,
    { active: 'batches', notice, error },
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
        <p class="tag-meta">CC Lab · ${item.code}</p>
      </article>`)}</div>`,
  });
}
