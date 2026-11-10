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
  const { submitter, target: form } = event;
  const question = submitter?.dataset.confirm;
  if (question && !window.confirm(question)) {
    event.preventDefault();
    return;
  }
  if (form.classList.contains('slot') && submitter && !question) {
    setTimeout(() => {
      submitter.disabled = true;
      submitter.textContent = 'Загружаем…';
    }, 0);
  }
});

document.addEventListener('change', (event) => {
  const input = event.target;
  if (input.type !== 'file' || !input.files[0]) return;
  const title = input.form.elements.title;
  if (!title.value) title.value = input.files[0].name.replace(/\.[^.]+$/, '').slice(0, title.maxLength);
});
