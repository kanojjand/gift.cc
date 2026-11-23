import { shell } from './admin.js';
import { html } from './html.js';

/** Слово, которое нужно ввести, чтобы удалить все партии разом. */
export const DELETE_ALL_WORD = 'удалить';

const impactRow = (label, count, note) => html`<li><span>${label}</span><b>${count}</b><small>${note}</small></li>`;

/** Что пропадёт вместе с кодами. Принимает суммы по одной или нескольким партиям. */
function impactList({ total, unused, drafts, live }) {
  return html`${impactRow('Активных открыток', live, 'получатели больше не смогут их открыть')}
    ${impactRow('Черновиков', drafts, 'покупатели потеряют то, что заполнили')}
    ${impactRow('Свободных кодов', unused, 'напечатанные QR покажут «не найдено»')}
    ${impactRow('Истёкших и снятых', total - unused - drafts - live, 'их статистика тоже удалится')}`;
}

/** Удаление партии с заполненными открытками: показывает, что пропадёт, и просит ввести номер партии. */
export function deleteBatchPage({ batch, error }) {
  return shell(
    `Удалить партию №${batch.id}`,
    html`<p class="back"><a href="/admin/batches/${batch.id}">← Партия №${batch.id}</a></p>
    <section class="panel danger-zone">
      <h1>Удалить партию №${batch.id}?</h1>
      <p class="hint">${batch.label ? `${batch.label} · ` : ''}кодов: ${batch.total}. Удаление нельзя отменить.</p>
      <ul class="impact">${impactList(batch)}</ul>
      <form class="confirm-row" method="post" action="/admin/batches/${batch.id}/delete">
        <label>Чтобы подтвердить, введите номер партии: ${batch.id}<input name="confirm" inputmode="numeric" autocomplete="off" required></label>
        <button class="danger">Удалить навсегда</button>
        <a class="ghost" href="/admin/batches/${batch.id}">Отмена</a>
      </form>
    </section>`,
    { active: 'batches', errorText: error },
  );
}

/** Удаление всех партий разом, например тестовых перед запуском. Просит ввести слово «удалить». */
export function deleteAllPage({ batches, error }) {
  const sum = (field) => batches.reduce((total, batch) => total + batch[field], 0);
  const totals = { total: sum('total'), unused: sum('unused'), drafts: sum('drafts'), live: sum('live') };
  return shell(
    'Удалить все партии',
    html`<p class="back"><a href="/admin">← Все партии</a></p>
    <section class="panel danger-zone">
      <h1>Удалить все партии?</h1>
      <p class="hint">Удалятся все коды, открытки, фото и статистика. Отменить нельзя.</p>
      <ul class="impact">
        ${impactRow('Партий', batches.length, 'список партий станет пустым')}
        ${impactList(totals)}
      </ul>
      <form class="confirm-row" method="post" action="/admin/delete-all">
        <label>Чтобы подтвердить, введите слово: ${DELETE_ALL_WORD}<input name="confirm" autocomplete="off" required></label>
        <button class="danger">Удалить всё навсегда</button>
        <a class="ghost" href="/admin">Отмена</a>
      </form>
    </section>`,
    { active: 'batches', errorText: error },
  );
}
