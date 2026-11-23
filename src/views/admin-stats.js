import { dailyCounts, niceAxisMax, STATS_DAYS } from '../stats.js';
import { getTemplate } from '../tiers.js';
import { funnel, percent, shell, STATUS_LABELS } from './admin.js';
import { html } from './html.js';

/**
 * Цвет статуса на графиках. Свободные коды серые — это запас, а не событие; остальные цвета проверены
 * валидатором палитры на тёмном фоне админки и различимы при дальтонизме.
 */
const STATUS_COLORS = Object.freeze({ new: '#6d6d6a', draft: '#d95926', active: '#199e70', expired: '#c98500', blocked: '#d55181' });
/** Процент внутри полосы печатается, только если часть не уже этой доли: иначе текст не влезет. */
const INSIDE_LABEL_SHARE = 12;
const WEEK = 7;

function statusChart(statuses) {
  const parts = Object.entries(STATUS_LABELS).map(([status, label]) => ({ status, label, count: statuses[status] ?? 0 }));
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) return html`<p class="hint">Кодов пока нет.</p>`;
  const shown = parts.filter((part) => part.count > 0);
  return html`<div class="seg" role="img" aria-label="${shown.map((part) => `${part.label}: ${part.count}`).join(', ')}">
      ${shown.map((part) => {
        const share = percent(part.count, total);
        return html`<span class="seg-part" style="flex-grow:${part.count};--c:${STATUS_COLORS[part.status]}" title="${part.label}: ${part.count} (${share}%)">${share >= INSIDE_LABEL_SHARE ? `${share}%` : ''}</span>`;
      })}
    </div>
    <ul class="legend">${parts.map((part) => html`<li><i style="--c:${STATUS_COLORS[part.status]}"></i><span>${part.label}</span><b>${part.count}</b></li>`)}</ul>`;
}

const dayTable = (days) => html`<details class="chart-table"><summary>Таблица по дням</summary>
  <table><thead><tr><th>День</th><th class="num">Активаций</th></tr></thead>
  <tbody>${[...days].reverse().map((day) => html`<tr><td>${day.label}</td><td class="num">${day.count}</td></tr>`)}</tbody></table>
</details>`;

/** Подпись под столбиком: сегодня и каждый седьмой день назад от него. */
function dayTick(days, index) {
  const fromEnd = days.length - 1 - index;
  if (fromEnd % WEEK !== 0) return '';
  return html`<small class="col-x">${fromEnd === 0 ? 'сегодня' : days[index].label}</small>`;
}

function activationChart(days) {
  const total = days.reduce((sum, day) => sum + day.count, 0);
  if (total === 0) return html`<p class="hint">Активаций за ${STATS_DAYS} дней пока нет.</p>`;
  const top = niceAxisMax(Math.max(...days.map((day) => day.count)));
  const peak = days.reduce((best, day) => (day.count > best.count ? day : best));
  return html`<p class="chart-sub">За ${STATS_DAYS} дней: ${total}</p>
    <div class="cols-wrap">
      <span class="cols-top" aria-hidden="true">${top}</span>
      <ol class="cols" style="--n:${days.length}" aria-label="Активации по дням">
        ${days.map((day, index) => html`<li tabindex="0" data-tip="${day.label}: ${day.count}" aria-label="${day.label}: ${day.count}">
          <span class="col-bar" style="height:${(day.count / top) * 100}%">${day.key === peak.key ? html`<b class="col-v">${day.count}</b>` : ''}</span>
          ${dayTick(days, index)}
        </li>`)}
      </ol>
    </div>
    ${dayTable(days)}`;
}

function templateChart(templates) {
  if (templates.length === 0) return html`<p class="hint">Шаблоны ещё не выбирали.</p>`;
  const max = templates[0].count;
  return html`<ul class="hbars">${templates.map((item) => html`<li>
      <span class="hbar-name">${getTemplate(item.id)?.name ?? item.id}</span>
      <span class="hbar-track"><span class="hbar" style="--r:${item.count / max}"></span><b>${item.count}</b></span>
    </li>`)}</ul>`;
}

function batchChart(batches) {
  if (batches.length === 0) return html`<p class="hint">Партий пока нет.</p>`;
  return html`<ul class="meters">${batches.map((batch) => {
    const share = percent(batch.activated, batch.total);
    return html`<li>
      <a href="/admin/batches/${batch.id}">Партия №${batch.id}${batch.label ? html` <small>${batch.label}</small>` : ''}</a>
      <span class="meter" role="img" aria-label="Активировано ${batch.activated} из ${batch.total}"><span style="width:${share}%"></span></span>
      <span class="meter-text">${batch.activated} из ${batch.total} · ${share}%</span>
    </li>`;
  })}</ul>`;
}

/**
 * Инфографика по всем кодам: статусы, активации по дням, любимые шаблоны и продажи по партиям.
 * @param {{ batches: object[], stats: { statuses: Record<string, number>, activations: number[], templates: { id: string, count: number }[] }, now: number }} input
 */
export function statsPage({ batches, stats, now }) {
  return shell(
    'Статистика',
    html`<h1>Статистика</h1>
    ${funnel(batches)}
    <section class="panel chart">
      <h2>Все коды по статусам</h2>
      <p class="chart-sub">Сколько кодов сейчас в каждом состоянии</p>
      ${statusChart(stats.statuses)}
    </section>
    <section class="panel chart">
      <h2>Активации по дням</h2>
      ${activationChart(dailyCounts(stats.activations, now))}
    </section>
    <div class="chart-grid">
      <section class="panel chart">
        <h2>Какие шаблоны выбирают</h2>
        <p class="chart-sub">Заполненные открытки, включая истёкшие</p>
        ${templateChart(stats.templates)}
      </section>
      <section class="panel chart">
        <h2>Партии</h2>
        <p class="chart-sub">Сколько кодов из партии уже активировали</p>
        ${batchChart(batches)}
      </section>
    </div>`,
    { active: 'stats' },
  );
}
