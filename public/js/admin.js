const COPIED_LABEL_MS = 1500;

async function copyLink(button) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = 'Готово';
  } catch {
    button.textContent = 'Не вышло';
  }
  setTimeout(() => {
    button.textContent = label;
  }, COPIED_LABEL_MS);
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (target.dataset.qty) document.getElementById('quantity').value = target.dataset.qty;
  if (target.dataset.copy) copyLink(target);
  if (target.id === 'print-now') window.print();
});

document.addEventListener('submit', (event) => {
  const question = event.submitter?.dataset.confirm;
  if (question && !window.confirm(question)) event.preventDefault();
});
