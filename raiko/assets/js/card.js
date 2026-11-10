(() => {
  const card = document.querySelector('.card');
  if (!card) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = card.querySelector('.bg-music');
  const muteButton = card.querySelector('.mute');
  const FADE_STEP_MS = 120;
  const FADE_STEP = 0.05;
  const MAX_DPR = 2;
  const WORD_STAGGER_TOTAL_S = 2.6;
  const WORD_STAGGER_MAX_S = 0.08;
  const BRAND_TRANSITION_MS = 900;
  const BRAND_FONTS_URL = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Manrope:wght@400;500;600;700&family=Unbounded:wght@600&display=swap';
  let opened = false;
  let muted = false;

  function fadeInMusic() {
    audio.volume = 0;
    const timer = setInterval(() => {
      const next = Math.min(1, audio.volume + FADE_STEP);
      audio.volume = next;
      if (next >= 1) clearInterval(timer);
    }, FADE_STEP_MS);
  }

  function setMuted(value) {
    muted = value;
    audio.muted = value;
    muteButton.textContent = value ? '×' : '♪';
    muteButton.setAttribute('aria-pressed', String(value));
    muteButton.setAttribute('aria-label', value ? 'Включить музыку' : 'Выключить музыку');
  }

  function startMusic() {
    if (!audio) return;
    muteButton.hidden = false;
    audio.play().then(fadeInMusic).catch(() => setMuted(true));
  }

  function createParticle(kind, width, height, scatter) {
    const particle = {
      x: Math.random() * width,
      y: scatter ? Math.random() * height : kind === 'gold' ? height + 10 : -20,
      size: Math.random(),
      drift: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    };
    return particle;
  }

  const PAINTERS = {
    petals(ctx, p, t, height) {
      p.y += 0.5 + p.size * 0.9;
      p.x += Math.sin(t / 900 + p.drift) * 0.7;
      p.spin += 0.012;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 + p.size * 7, 3 + p.size * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return p.y < height + 30;
    },
    gold(ctx, p, t) {
      p.y -= 0.25 + p.size * 0.6;
      p.x += Math.sin(t / 1200 + p.drift) * 0.3;
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 700 + p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.8 + p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      return p.y > -10;
    },
    stars(ctx, p, t) {
      ctx.globalAlpha = 0.2 + 0.8 * Math.abs(Math.sin(t / 1100 + p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.6 + p.size * 1.4, 0, Math.PI * 2);
      ctx.fill();
      return true;
    },
  };

  const PARTICLE_COUNT = { petals: 22, gold: 46, stars: 70 };

  function startEffects() {
    const kind = card.dataset.fx;
    const paint = PAINTERS[kind];
    const canvas = card.querySelector('.fx');
    if (!paint || !canvas || reduceMotion) return;
    const ctx = canvas.getContext('2d');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--fx-color').trim();
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let particles = Array.from({ length: PARTICLE_COUNT[kind] }, () => createParticle(kind, width, height, true));

    function frame(time) {
      if (!document.hidden) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        particles = particles.map((p) => (paint(ctx, p, time, height) ? p : createParticle(kind, width, height, false)));
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function observeScenes() {
    const scenes = card.querySelectorAll('.scene');
    const observer = new IntersectionObserver(
      (entries) => entries.filter((entry) => entry.isIntersecting).forEach((entry) => entry.target.classList.add('in')),
      { threshold: 0.2 },
    );
    scenes.forEach((scene) => observer.observe(scene));
  }

  /* Фирменные шрифты нужны только на последнем экране, поэтому не тормозят открытие страницы. */
  function loadBrandFonts() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BRAND_FONTS_URL;
    document.head.append(link);
  }

  function open() {
    if (opened) return;
    opened = true;
    card.classList.add('opening');
    if (card.dataset.track === '1') navigator.sendBeacon(`/c/${card.dataset.code}/opened`);
    loadBrandFonts();
    startMusic();
    startEffects();
    observeScenes();
    setTimeout(() => {
      card.classList.add('opened');
      document.body.classList.remove('locked');
    }, reduceMotion ? 0 : Number(card.dataset.openMs));
  }

  function splitMessageIntoWords() {
    const message = card.querySelector('.message');
    if (!message || reduceMotion) return;
    const parts = message.textContent.split(/(\s+)/);
    const wordCount = parts.filter((part) => part.trim()).length;
    message.style.setProperty('--word-step', `${Math.min(WORD_STAGGER_MAX_S, WORD_STAGGER_TOTAL_S / wordCount)}s`);
    let index = 0;
    message.replaceChildren(...parts.map((part) => {
      if (!part.trim()) return document.createTextNode(part);
      const word = document.createElement('span');
      word.className = 'w';
      word.style.setProperty('--i', index);
      index += 1;
      word.textContent = part;
      return word;
    }));
  }

  const brandPage = document.getElementById('brand-page');
  const nextButton = document.getElementById('to-brand');

  function showBrandPage() {
    const box = nextButton.getBoundingClientRect();
    brandPage.style.setProperty('--origin-x', `${box.left + box.width / 2}px`);
    brandPage.style.setProperty('--origin-y', `${box.top + box.height / 2}px`);
    brandPage.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => brandPage.classList.add('show')));
    history.pushState({ brandPage: true }, '');
  }

  function hideBrandPage() {
    brandPage.classList.remove('show');
    setTimeout(() => {
      if (!brandPage.classList.contains('show')) brandPage.hidden = true;
    }, reduceMotion ? 0 : BRAND_TRANSITION_MS);
  }

  nextButton.addEventListener('click', showBrandPage);
  document.getElementById('brand-back').addEventListener('click', () => history.back());
  window.addEventListener('popstate', hideBrandPage);

  /* Длина имени заранее неизвестна: уменьшаем шрифт так, чтобы самое длинное слово помещалось целиком. */
  async function fitRecipientName() {
    const name = card.querySelector('.recipient');
    const style = getComputedStyle(name);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    await document.fonts.load(font, name.textContent);
    const box = getComputedStyle(name.parentElement);
    const fitRatio = parseFloat(style.getPropertyValue('--name-fit')) || 1;
    const available = (name.parentElement.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)) * fitRatio;
    const text = style.textTransform === 'uppercase' ? name.textContent.toUpperCase() : name.textContent;
    const context = document.createElement('canvas').getContext('2d');
    context.font = font;
    const spacing = parseFloat(style.letterSpacing) || 0;
    const widest = Math.max(...text.trim().split(/\s+/).map((word) => context.measureText(word).width + spacing * [...word].length));
    if (widest > available) name.style.setProperty('font-size', `${Math.floor((parseFloat(style.fontSize) * available) / widest)}px`, 'important');
  }

  fitRecipientName().catch((error) => console.warn('[card] не удалось подогнать имя', error));
  splitMessageIntoWords();
  card.querySelector('.gate-btn')?.addEventListener('click', open);

  if (audio) {
    muteButton.addEventListener('click', () => {
      setMuted(!muted);
      if (!muted && audio.paused) audio.play().catch(() => setMuted(true));
    });
    document.addEventListener('visibilitychange', () => {
      if (!opened) return;
      if (document.hidden) audio.pause();
      else if (!muted) audio.play().catch(() => setMuted(true));
    });
  }
})();
