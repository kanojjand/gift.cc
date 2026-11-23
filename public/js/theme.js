// Тема страниц покупателя. Светлая по умолчанию, тёмную включают кнопкой; выбор запоминается на этом устройстве.
// Подключён в <head> без defer, чтобы тема встала до отрисовки и страница не мигала.
(() => {
  const STORAGE_KEY = 'cc-theme';
  const BAR_COLORS = { light: '#f6f4ef', dark: '#050505' };
  const root = document.documentElement;

  function savedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null; // хранилище закрыто (приватный режим): остаёмся на светлой теме
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // хранилище закрыто: тема переключится, но не запомнится до следующего открытия
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[theme]);
    // Подпись кнопки постоянная («Тёмная тема»), состояние передаёт aria-pressed.
    const pressed = String(theme === 'dark');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => button.setAttribute('aria-pressed', pressed));
  }

  apply(savedTheme() === 'dark' ? 'dark' : 'light');

  document.addEventListener('DOMContentLoaded', () => apply(root.dataset.theme));
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    apply(next);
  });
})();
