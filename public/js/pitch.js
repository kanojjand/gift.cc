// Презентация /pitch: листание слайдов, живая открытка в телефоне, текст выступающего и таймер.
// → / пробел / PageDown — дальше, ← / PageUp — назад, N — текст, F — во весь экран.
(() => {
  const slides = [...document.querySelectorAll('[data-slide]')];
  const dots = [...document.querySelectorAll('[data-goto]')];
  const count = document.querySelector('[data-count]');
  const notes = document.querySelector('[data-notes]');
  const noteText = document.querySelector('[data-note-text]');
  const notesBtn = document.querySelector('[data-toggle-notes]');
  const timer = document.querySelector('[data-timer]');
  const prev = document.querySelector('[data-prev]');
  const next = document.querySelector('[data-next]');
  const PHONE_H = 844;
  const pad = (n) => String(n).padStart(2, '0');
  let index = 0;
  let started = 0;

  // Телефон с открыткой загружаем, когда до слайда остаётся один шаг: так демо готово к показу
  function loadPhone(i) {
    const frame = slides[i]?.querySelector('iframe[data-src]');
    if (frame && !frame.src) frame.src = frame.dataset.src;
  }

  function fitPhones() {
    const scale = Math.min(1, (window.innerHeight - 200) / PHONE_H);
    document.querySelectorAll('[data-phone]').forEach((phone) => phone.style.setProperty('--scale', String(scale)));
  }

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, n) => { slide.hidden = n !== index; });
    dots.forEach((dot, n) => dot.classList.toggle('on', n <= index));
    count.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
    noteText.textContent = slides[index].dataset.note || '';
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    loadPhone(index);
    loadPhone(index + 1);
  }

  function go(delta) {
    if (!started) started = Date.now();
    show(index + delta);
  }

  function toggleNotes() {
    notes.hidden = !notes.hidden;
    document.body.classList.toggle('notes-on', !notes.hidden);
    notesBtn.classList.toggle('on', !notes.hidden);
  }

  function onKey(event) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '');
    if (typing) return;
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); go(1); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); go(-1); }
    else if (['n', 'N', 'т', 'Т'].includes(event.key)) toggleNotes();
    else if (['f', 'F', 'а', 'А'].includes(event.key)) document.documentElement.requestFullscreen?.();
  }

  // Кликер шлёт PageDown/PageUp и тогда, когда фокус внутри открытки: ловим их и там (сайт тот же)
  document.querySelectorAll('[data-phone] iframe').forEach((frame) => {
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow.addEventListener('keydown', (event) => {
          if (event.key === 'PageDown') { event.preventDefault(); go(1); }
          if (event.key === 'PageUp') { event.preventDefault(); go(-1); }
        });
      } catch { /* другой домен — листаем кнопками */ }
    });
  });

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  dots.forEach((dot) => dot.addEventListener('click', () => show(Number(dot.dataset.goto))));
  notesBtn.addEventListener('click', toggleNotes);
  document.querySelector('[data-fullscreen]').addEventListener('click', () => document.documentElement.requestFullscreen?.());
  timer.addEventListener('click', () => { started = 0; timer.textContent = '0:00'; });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', fitPhones);
  setInterval(() => {
    if (!started) return;
    const s = Math.floor((Date.now() - started) / 1000);
    timer.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }, 1000);

  fitPhones();
  show(0);
})();
