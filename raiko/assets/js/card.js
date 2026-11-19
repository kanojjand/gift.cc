(() => {
  const card = document.querySelector('.card');
  if (!card) return;

  /* Шрифты подключаются без задержки первого экрана; имя проявляется, когда они готовы (не дольше FONT_WAIT_MS). */
  const FONT_WAIT_MS = 1000;
  const fontLink = document.getElementById('card-fonts');
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const fontCssLoaded = new Promise((resolve) => {
    if (!fontLink || fontLink.sheet) return resolve();
    fontLink.addEventListener('load', resolve, { once: true });
    fontLink.addEventListener('error', resolve, { once: true });
  });
  if (fontLink) fontLink.media = 'all';
  const fontsReady = fontCssLoaded.then(nextFrame).then(() => document.fonts?.ready);
  const fontTimeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  Promise.race([fontsReady, fontTimeout]).then(() => card.classList.remove('fonts-wait'));

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

  /* Частицы, которые поднимаются снизу вверх, а не падают. */
  const RISING = new Set(['gold', 'hearts']);

  function createParticle(kind, width, height, scatter, colors) {
    return {
      x: Math.random() * width,
      y: scatter ? Math.random() * height : RISING.has(kind) ? height + 20 : -20,
      size: Math.random(),
      drift: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  /* Сердечко с центром в 0,0 размером примерно 2×2 единицы. */
  function heartPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0.9);
    ctx.bezierCurveTo(-1.6, -0.2, -0.9, -1.5, 0, -0.6);
    ctx.bezierCurveTo(0.9, -1.5, 1.6, -0.2, 0, 0.9);
    ctx.fill();
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
    snow(ctx, p, t, height) {
      p.y += 0.35 + p.size * 1.1;
      p.x += Math.sin(t / 1700 + p.drift) * (0.3 + p.size * 0.5);
      ctx.globalAlpha = 0.35 + p.size * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1 + p.size * 2.8, 0, Math.PI * 2);
      ctx.fill();
      return p.y < height + 10;
    },
    confetti(ctx, p, t, height) {
      if (p.burst) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16;
        p.vx *= 0.985;
      } else {
        p.y += 0.9 + p.size * 1.3;
        p.x += Math.sin(t / 800 + p.drift) * 0.8;
      }
      p.spin += 0.09 + p.size * 0.05;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.scale(1, Math.cos(p.spin * 1.7));
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-4 - p.size * 3, -2.5 - p.size * 2, 8 + p.size * 6, 5 + p.size * 4);
      ctx.restore();
      return p.y < height + 30;
    },
    hearts(ctx, p, t) {
      if (p.burst) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.02;
        p.vx *= 0.97;
      } else {
        p.y -= 0.45 + p.size * 0.8;
        p.x += Math.sin(t / 1100 + p.drift) * 0.6;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(t / 900 + p.phase) * 0.35);
      ctx.scale(5 + p.size * 8, 5 + p.size * 8);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.35 + p.size * 0.5;
      heartPath(ctx);
      ctx.restore();
      return p.y > -40;
    },
    sparkle(ctx, p, t) {
      const glow = Math.abs(Math.sin(t / 1300 + p.phase));
      const radius = (1.5 + p.size * 5) * (0.4 + glow * 0.6);
      ctx.globalAlpha = 0.25 + glow * 0.75;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - radius);
      ctx.quadraticCurveTo(p.x, p.y, p.x + radius, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + radius);
      ctx.quadraticCurveTo(p.x, p.y, p.x - radius, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - radius);
      ctx.fill();
      return true;
    },
  };

  const PARTICLE_COUNT = { petals: 22, gold: 46, stars: 70, snow: 90, confetti: 22, hearts: 14, sparkle: 46 };
  const BURST_COUNT = { confetti: 150, hearts: 40 };
  /* Через сколько миллисекунд после нажатия взрывается конфетти или сердца: синхронно с анимацией первого экрана. */
  const BURST_DELAY_MS = { confetti: 620, hearts: 1250 };

  const cssVar = (name) => getComputedStyle(card).getPropertyValue(name).trim();

  function startEffects() {
    const kind = card.dataset.fx;
    const paint = PAINTERS[kind];
    const canvas = card.querySelector('.fx');
    if (!paint || !canvas || reduceMotion) return null;
    const ctx = canvas.getContext('2d');
    const color = cssVar('--fx-color');
    const colors = ['--accent', '--accent2', '--accent3'].map(cssVar).filter(Boolean);
    const particleColors = colors.length ? colors : [color];
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

    const spawn = (scatter) => createParticle(kind, width, height, scatter, particleColors);
    let particles = Array.from({ length: PARTICLE_COUNT[kind] }, () => spawn(true));

    function frame(time) {
      if (!document.hidden) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        /* Частицы взрыва живут один раз, обычные возвращаются в начало пути. */
        particles = particles.flatMap((p) => {
          if (paint(ctx, p, time, height)) return [p];
          return p.burst ? [] : [spawn(false)];
        });
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* Взрыв частиц из точки x, y: конфетти из подарка, сердца из замка, конфетти над тортом. */
    function burst(x, y) {
      const count = BURST_COUNT[kind] ?? 0;
      const added = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = kind === 'hearts' ? 1 + Math.random() * 3 : 3 + Math.random() * 9;
        return { ...spawn(false), x, y, burst: true, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (kind === 'hearts' ? 1.5 : 5) };
      });
      particles = [...particles, ...added];
    }
    return { burst };
  }

  let effects = null;

  function burstFrom(element) {
    if (!effects || !element) return;
    const box = element.getBoundingClientRect();
    effects.burst(box.left + box.width / 2, box.top + box.height / 2);
  }

  /* Торт в конце «Сюрприза»: касание задувает свечи, сыплется конфетти, фраза меняется. */
  function setupCake() {
    const cake = card.querySelector('.cake');
    if (!cake) return;
    cake.addEventListener('click', () => {
      if (card.classList.contains('blown')) return;
      card.classList.add('blown');
      burstFrom(cake.querySelector('.candles'));
      const line = card.querySelector('.final-thanks');
      if (line && cake.dataset.done) line.textContent = cake.dataset.done;
    });
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

  /* Фото начинают грузиться сразу после открытия, пока читают текст: к галерее они уже готовы. */
  function preloadPhotos() {
    card.querySelectorAll('.photos img[loading="lazy"]').forEach((image) => {
      image.loading = 'eager';
    });
  }

  /* Точки под галереей: сколько фото и какое сейчас на экране. */
  function setupPhotoDots() {
    const gallery = card.querySelector('.photos');
    const figures = gallery ? [...gallery.querySelectorAll('figure')] : [];
    if (figures.length < 2 || !('IntersectionObserver' in window)) return;
    const dots = document.createElement('div');
    dots.className = 'photo-dots reveal';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(...figures.map(() => document.createElement('i')));
    dots.firstChild.classList.add('on');
    gallery.after(dots);
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        const current = figures.indexOf(entry.target);
        [...dots.children].forEach((dot, index) => dot.classList.toggle('on', index === current));
      });
    }, { root: gallery, threshold: 0.6 });
    figures.forEach((figure) => observer.observe(figure));
  }

  /* Песня по ссылке. Плеер грузится по касанию первого экрана, а YouTube и Spotify включаются сами, когда открытка
     раскрылась и плеер хотя бы наполовину на виду (так требует YouTube). Управляем плеерами сообщениями, как их
     официальные скрипты, но без загрузки этих скриптов. Если песня не заиграла (iPhone даёт звук только после
     нажатия на сам плеер), показываем подсказку «Нажми ▶». Apple Music и Яндекс управлять собой не дают:
     там подсказка видна сразу. */
  const SONG_START_WAIT_MS = 5000;
  const SONG_HANDSHAKE_MS = 250;
  const SONG_HANDSHAKE_TRIES = 60;
  const SONG_VISIBLE_SHARE = 0.5;
  const YOUTUBE_PLAYING = 1;
  const songFrame = card.querySelector('.song-player iframe[data-src]');
  const songHint = card.querySelector('.song-hint');

  const youtubeMessage = (message) => JSON.stringify({ ...message, id: 1, channel: 'widget' });
  const PLAYER_PROTOCOLS = {
    youtube: {
      handshake: youtubeMessage({ event: 'listening' }),
      isReady: () => true,
      playCommand: youtubeMessage({ event: 'command', func: 'playVideo', args: [] }),
      isPlaying: (data) => (data.event === 'onStateChange' ? data.info : data.info?.playerState) === YOUTUBE_PLAYING,
    },
    spotify: {
      handshake: null,
      isReady: (data) => data.type === 'ready',
      playCommand: { command: 'toggle' },
      isPlaying: (data) => data.type === 'playback_started' || (data.type === 'playback_update' && data.payload?.isPaused === false && !data.payload.isBuffering),
    },
  };

  function readPlayerMessage(data) {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return null;
    }
  }

  function whenMostlyVisible(element, callback) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.intersectionRatio >= SONG_VISIBLE_SHARE)) return;
      observer.disconnect();
      callback();
    }, { threshold: SONG_VISIBLE_SHARE });
    observer.observe(element);
  }

  function playerControl(frame, protocol) {
    const target = new URL(frame.dataset.src).origin;
    const send = (message) => frame.contentWindow?.postMessage(message, target);
    const state = { ready: false, playing: false, wanted: false, tries: 0 };
    if (protocol.handshake) {
      const handshake = setInterval(() => {
        state.tries += 1;
        if (state.ready || state.tries > SONG_HANDSHAKE_TRIES) clearInterval(handshake);
        else send(protocol.handshake);
      }, SONG_HANDSHAKE_MS);
    }
    window.addEventListener('message', (event) => {
      if (event.origin !== target || event.source !== frame.contentWindow) return;
      const data = readPlayerMessage(event.data);
      if (!data) return;
      if (!state.ready && protocol.isReady(data)) {
        state.ready = true;
        if (state.wanted) send(protocol.playCommand);
      }
      if (!state.playing && protocol.isPlaying(data)) {
        state.playing = true;
        songHint.hidden = true;
      }
    });
    return {
      play() {
        state.wanted = true;
        if (state.ready) send(protocol.playCommand);
        setTimeout(() => {
          if (!state.playing) songHint.hidden = false;
        }, SONG_START_WAIT_MS);
      },
    };
  }

  function loadSong() {
    if (!songFrame) return null;
    const protocol = PLAYER_PROTOCOLS[songFrame.dataset.autoplay];
    const origin = songFrame.dataset.autoplay === 'youtube' ? `&origin=${encodeURIComponent(location.origin)}` : '';
    songFrame.src = `${songFrame.dataset.src}${origin}`;
    if (!protocol) return null;
    const control = playerControl(songFrame, protocol);
    return { play: () => whenMostlyVisible(songFrame, control.play) };
  }

  function open() {
    if (opened) return;
    opened = true;
    card.classList.add('opening');
    preloadPhotos();
    if (card.dataset.track === '1') navigator.sendBeacon(`/c/${card.dataset.code}/opened`);
    loadBrandFonts();
    startMusic();
    const song = loadSong();
    effects = startEffects();
    const burstDelay = BURST_DELAY_MS[card.dataset.fx];
    if (effects && burstDelay !== undefined) setTimeout(() => burstFrom(card.querySelector('.gate-btn')), burstDelay);
    observeScenes();
    setTimeout(() => {
      card.classList.add('opened');
      document.body.classList.remove('locked');
      song?.play();
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

  /* Подгонять имя можно только когда стили шрифтов уже пришли, иначе замер будет по запасному шрифту. */
  fontCssLoaded.then(fitRecipientName).catch((error) => console.warn('[card] не удалось подогнать имя', error));
  splitMessageIntoWords();
  setupPhotoDots();
  setupCake();
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
