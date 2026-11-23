import { BRAND, MARK, whatsappLink } from '../brand.js';
import { CATALOG, MAX_PHOTOS } from '../tiers.js';
import { asset } from './assets.js';
import { html, raw } from './html.js';

export const brandFonts = html`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Manrope:wght@400;500;600;700&family=Unbounded:wght@600&display=swap">`;

export function brandMark() {
  return raw(`<svg class="mark" viewBox="0 0 ${MARK.width} ${MARK.height}" fill="currentColor" aria-hidden="true">${MARK.paths}</svg>`);
}

export function brandLockup(href = '/') {
  return html`<a class="brand" href="${href}" aria-label="${BRAND.name}">${brandMark()}<span class="brand-name">${BRAND.name}<small>Code Collective Laboratory</small></span></a>`;
}

/** Кнопка темы: луна в светлой теме, солнце в тёмной. Подпись постоянная, включена ли тёмная тема, говорит aria-pressed. */
export function themeToggle() {
  return raw(`<button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="Тёмная тема">
<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>
<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>
</button>`);
}

/** Верх страниц покупателя: логотип и переключатель темы. */
export function topBar() {
  return html`<div class="top-bar">${brandLockup()}${themeToggle()}</div>`;
}

/**
 * @param {{ title: string, head?: unknown, body: unknown, bodyClass?: string, themeColor?: string }} page
 */
export function documentPage({ title, head = '', body, bodyClass = '', themeColor = '#050505' }) {
  return html`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${themeColor}">
<title>${title}</title>
<link rel="icon" href="${asset('brand/favicon.svg')}" type="image/svg+xml">
${head}
</head>
<body class="${bodyClass}">${body}</body>
</html>`;
}

/**
 * Шапка страниц покупателя. theme.js подключён без defer: он ставит тему до отрисовки, иначе страница мигнёт.
 * По умолчанию тема светлая, тёмную покупатель включает кнопкой, выбор запоминается на устройстве.
 */
export const appHead = html`${brandFonts}<script src="${asset('js/theme.js')}"></script><link rel="stylesheet" href="${asset('css/app.css')}">`;
/** Цвет панели браузера на страницах покупателя до запуска theme.js (светлая тема по умолчанию). */
export const APP_BAR_COLOR = '#f6f4ef';

export function contactLinks() {
  return html`
    <a href="${BRAND.site.url}" rel="noopener">${BRAND.site.label}</a>
    <a href="${whatsappLink()}" rel="noopener">${BRAND.whatsapp.label}</a>
    <a href="${BRAND.telegram.url}" rel="noopener">${BRAND.telegram.label}</a>
    <a href="${BRAND.instagram.url}" rel="noopener">${BRAND.instagram.label}</a>`;
}

function messagePage(title, text) {
  return documentPage({
    title,
    head: appHead,
    themeColor: APP_BAR_COLOR,
    bodyClass: 'centered',
    body: html`<main class="notice-card">
      ${brandLockup()}
      <h1>${title}</h1>
      <p>${text}</p>
      <nav class="contact-row">${contactLinks()}</nav>
    </main>`,
  });
}

export function goneInfo(status) {
  if (status === 'blocked') return messagePage('Открытка недоступна', 'Эта открытка снята с публикации.');
  return messagePage('Срок открытки закончился', 'Срок хранения этой открытки закончился, она и её фото уже удалены.');
}

export function notFoundPage() {
  return messagePage('Открытка не найдена', 'Проверьте QR-код или ссылку.');
}

export function errorPage() {
  return messagePage('Что-то пошло не так', 'Обновите страницу через минуту. Если не поможет, напишите нам.');
}

const templateLink = (template) => html`
  <a class="tpl-link" href="/demo/${template.id}" style="--swatch:${template.bg};--swatch-accent:${template.accent}">
    <i aria-hidden="true"></i>
    <span><b>${template.name}</b><small>${template.blurb}</small></span>
  </a>`;

export function landingPage() {
  return documentPage({
    title: `${BRAND.name}: QR-поздравления`,
    head: appHead,
    themeColor: APP_BAR_COLOR,
    body: html`<main class="landing">
      ${brandLockup()}
      <p class="eyebrow">${BRAND.tagline}</p>
      <h1>Поздравление, которое живёт внутри букета</h1>
      <p class="lead">QR-код на открытке открывает страницу с именем, словами, фото и музыкой.</p>
      <h2>Шаблоны, до ${MAX_PHOTOS} фото</h2>
      <div class="tpl-list">${CATALOG.map(templateLink)}</div>
      <nav class="contact-row">${contactLinks()}</nav>
    </main>`,
  });
}
