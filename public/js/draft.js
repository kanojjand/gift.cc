(() => {
  const dialog = document.getElementById('confirm-dialog');
  const yes = document.getElementById('confirm-yes');
  const errorBox = document.getElementById('confirm-error');
  const code = document.querySelector('.card').dataset.code;

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = false;
    yes.disabled = false;
  }

  async function activate() {
    yes.disabled = true;
    errorBox.hidden = true;
    try {
      const response = await fetch(`/c/${code}/activate`, { method: 'POST' });
      if (response.ok) {
        window.location.replace(`/c/${code}?activated=1`);
        return;
      }
      const body = await response.json().catch(() => ({}));
      showError(body.error || 'Не получилось активировать, попробуйте ещё раз');
    } catch {
      showError('Нет связи. Проверьте интернет и попробуйте ещё раз');
    }
  }

  document.getElementById('activate').addEventListener('click', () => dialog.showModal());
  document.getElementById('confirm-no').addEventListener('click', () => dialog.close());
  yes.addEventListener('click', activate);
})();
