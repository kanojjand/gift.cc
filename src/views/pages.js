import { BRAND, whatsappLink } from '../brand.js';
import { TEMPLATES, TIERS } from '../tiers.js';
import { asset } from './assets.js';
import { html, raw } from './html.js';

const MARK_PATHS = `<path d="M229.8 1L320.2 79V135.6H278V97.8L229.1 55.8L119.6 143.2V207.5L216.3 290.2L278 240.6V206.1H320.2V260L215.5 344.5L75.6 226.2V125.8Z"/><path d="M92 0.3L147.9 47.8L115.5 74.7L92.4 55.1L43 96.1V250.9L89.5 290.6L110.1 274.4L140.9 300.7L88.4 344.6L0.3 269.3V77.7Z"/><path d="M219 123.8L229.9 163.8L269 175.2L230.2 186.7L219 226.5L208.1 186.9L167.8 175.2L208.1 164.1Z"/>`;

export const brandFonts = html`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Manrope:wght@400;500;600;700&family=Unbounded:wght@600&display=swap">`;

export function brandMark() {
  return raw(`<svg class="mark" viewBox="0 0 321 345" fill="currentColor" aria-hidden="true">${MARK_PATHS}</svg>`);
}

export function brandLockup(href = '/') {
  return html`<a class="brand" href="${href}" aria-label="${BRAND.name}">${brandMark()}<span class="brand-name">${BRAND.name}<small>Code Collective Laboratory</small></span></a>`;
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

const appCss = html`${brandFonts}<link rel="stylesheet" href="${asset('css/app.css')}">`;

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
    head: appCss,
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
  return messagePage('Срок открытки закончился', 'Поздравления хранятся неделю после активации. Эта открытка и её фото уже удалены.');
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
  const group = (tier) => TEMPLATES.filter((template) => template.tier === tier).map(templateLink);
  return documentPage({
    title: `${BRAND.name}: QR-поздравления`,
    head: appCss,
    body: html`<main class="landing">
      ${brandLockup()}
      <p class="eyebrow">${BRAND.tagline}</p>
      <h1>Поздравление, которое живёт внутри букета</h1>
      <p class="lead">QR-код на открытке открывает страницу с именем, словами, фото и музыкой.</p>
      <h2>Базовые шаблоны, до ${TIERS.basic.maxPhotos} фото</h2>
      <div class="tpl-list">${group('basic')}</div>
      <h2>Премиум, до ${TIERS.premium.maxPhotos} фото</h2>
      <div class="tpl-list">${group('premium')}</div>
      <nav class="contact-row">${contactLinks()}</nav>
    </main>`,
  });
}
