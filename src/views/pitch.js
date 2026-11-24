import { BRAND } from '../brand.js';
import { CATALOG, MAX_PHOTOS } from '../tiers.js';
import { asset } from './assets.js';
import { brandFonts, brandMark, documentPage } from './pages.js';
import { html } from './html.js';

/**
 * Презентация идеи на /pitch: слайды, живая открытка в телефоне и текст выступающего (клавиша N).
 * demo — адрес страницы этого сайта, которая открывается в телефоне на слайде; note — что говорить.
 */
const SLIDES = [
  {
    kicker: 'CC Lab · дарим эмоции',
    title: 'Поздравление, которое живёт внутри букета',
    text: 'QR-код на открытке открывает живую страницу с именем, словами, фото и музыкой.',
    demo: '/demo/bloom',
    note: 'Сәлеметсіздер ме! Я Канат из CC Lab. Мы сделали открытки, которые оживают: QR-код в букете открывает поздравление с фото и музыкой.',
  },
  {
    kicker: 'Проблема',
    title: 'Цветы завянут, а открытку выбросят',
    points: [
      'К букету кладут маленькую открытку с парой строк ручкой',
      'Самое ценное — слова, фото и общая песня — остаётся в телефоне',
      'Цветочным магазинам нечем выделиться: букеты у всех похожи',
    ],
    note: 'Цветы дарят каждый день. Но к букету кладут маленькую открытку, где помещается пара строк, и её выбрасывают вместе с цветами. А самое личное — фото, общая песня, тёплые слова — остаётся в телефоне. Магазинам тоже трудно выделиться: букеты у всех похожи.',
  },
  {
    kicker: 'Решение',
    title: 'Открытка с QR-кодом, которая оживает',
    points: [`${CATALOG.length} анимированных шаблонов`, `До ${MAX_PHOTOS} фото и песня`, 'Без приложений и регистрации', 'Работает на любом телефоне'],
    note: 'Мы кладём в букет открытку с QR-кодом. Покупатель сканирует его, выбирает шаблон, пишет слова, добавляет фото и песню. Никаких приложений и регистрации — всё в браузере телефона.',
  },
  {
    kicker: 'Как это работает',
    title: 'Три шага',
    points: [
      'Магазин кладёт в букет открытку с QR',
      'Покупатель сканирует и пишет поздравление',
      'Получатель наводит камеру — и открывает чудо',
    ],
    note: 'Всё в три шага. Магазин кладёт открытку в букет. Покупатель сканирует код и пишет поздравление прямо в магазине или по дороге. Получатель наводит камеру и открывает живую открытку.',
  },
  {
    kicker: 'Демо · Замок сердца',
    title: 'Попробуйте сами',
    text: 'Замок открывается ключом, внутри — имя, слова и фото.',
    demo: '/demo/love',
    note: 'Покажу вживую. Это шаблон «Замок сердца»: получатель поворачивает ключ, и открывается поздравление с именем, словами и фото.',
  },
  {
    kicker: 'Демо · Снежный шар',
    title: 'Под каждый праздник — свой шаблон',
    text: 'Новый год, день рождения, любовь, весна — у каждого свой сценарий.',
    demo: '/demo/newyear',
    note: 'А это новогодний снежный шар: его можно встряхнуть. На день рождения задуваешь свечи, весной раскрывается бутон. У каждого праздника свой сценарий.',
  },
  {
    kicker: 'Бизнес',
    title: 'Зарабатываем вместе с цветочными магазинами',
    points: [
      'Магазин покупает партию QR-открыток',
      'Продаёт их как услугу к букету',
      'В панели видно, сколько открыток активировали и открыли',
    ],
    note: 'Модель простая: цветочный магазин покупает у нас партию QR-открыток и продаёт их покупателям как услугу к букету. Для магазина это новая выручка и повод вернуться. А в нашей панели видно, сколько открыток активировали и открыли.',
  },
  {
    kicker: 'Попробуйте сейчас',
    title: 'gift.cclab.kz',
    text: 'Наведите камеру на QR-код',
    qr: true,
    note: 'Наведите камеру на QR-код и попробуйте прямо сейчас. Цветы завянут, а поздравление останется. Спасибо!',
  },
];

const star = html`<svg class="p-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z"/></svg>`;

function slideBody(slide, index) {
  const grid = slide.points?.length === 4 ? ' p-grid' : '';
  const points = slide.points ? html`<ul class="p-points${grid}">${slide.points.map((point) => html`<li>${star}<span>${point}</span></li>`)}</ul>` : '';
  const copy = html`<div class="p-copy">
    <p class="p-kicker">${star}${slide.kicker}</p>
    <h1 class="p-title${index === 0 ? ' p-hero' : ''}">${slide.title}</h1>
    ${slide.text ? html`<p class="p-text">${slide.text}</p>` : ''}
    ${points}
  </div>`;
  let side = '';
  if (slide.demo) side = html`<div class="p-phone" data-phone><iframe data-src="${slide.demo}" title="${slide.title}"></iframe></div>`;
  else if (slide.qr) side = html`<div class="p-qr"><img src="/pitch/qr.svg" alt="QR-код gift.cclab.kz"></div>`;
  return html`<section class="p-slide${side ? ' p-split' : ''}" data-slide data-note="${slide.note}"${index === 0 ? '' : ' hidden'}>${copy}${side}</section>`;
}

export function pitchPage() {
  return documentPage({
    title: `${BRAND.name}: QR-поздравления — презентация`,
    head: html`${brandFonts}<link rel="stylesheet" href="${asset('css/pitch.css')}"><script src="${asset('js/pitch.js')}" defer></script>`,
    themeColor: '#f6f4ef',
    bodyClass: 'pitch',
    body: html`<header class="p-top">
        <a class="p-brand" href="${BRAND.site.url}" rel="noopener">${brandMark()}<b>${BRAND.name}</b><span>QR-поздравления</span></a>
        <span class="p-count" data-count>01 / ${String(SLIDES.length).padStart(2, '0')}</span>
      </header>
      <main class="p-stage">${SLIDES.map(slideBody)}</main>
      <aside class="p-notes" data-notes hidden><small>Говорить</small><p data-note-text></p></aside>
      <footer class="p-bar">
        <button type="button" class="p-btn" data-prev aria-label="Назад">‹</button>
        <button type="button" class="p-btn p-next" data-next aria-label="Дальше">›</button>
        <div class="p-dots">${SLIDES.map((_, i) => html`<button type="button" data-goto="${i}" aria-label="Слайд ${i + 1}"></button>`)}</div>
        <button type="button" class="p-pill" data-toggle-notes>Текст (N)</button>
        <button type="button" class="p-pill" data-fullscreen>Экран (F)</button>
        <span class="p-timer" data-timer>0:00</span>
      </footer>`,
  });
}
