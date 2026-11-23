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
      if (p.burst) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.vx *= 0.98;
      } else {
        p.y += 0.35 + p.size * 1.1;
        p.x += Math.sin(t / 1700 + p.drift) * (0.3 + p.size * 0.5);
      }
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
      if (p.burst) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 1;
      }
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
      return !p.burst || p.life > 0;
    },
  };

  const PARTICLE_COUNT = { petals: 22, gold: 46, stars: 70, snow: 90, confetti: 22, hearts: 14, sparkle: 46 };
  const BURST_COUNT = { confetti: 150, hearts: 40, snow: 70, sparkle: 50 };
  const BURST_LIFE = 90;
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
        const speed = { hearts: 1 + Math.random() * 3, confetti: 3 + Math.random() * 9 }[kind] ?? 1.5 + Math.random() * 4;
        const lift = { hearts: 1.5, confetti: 5 }[kind] ?? 2;
        return { ...spawn(false), x, y, burst: true, life: BURST_LIFE, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - lift };
      });
      particles = [...particles, ...added];
    }
    return { burst };
  }

  let effects = null;

  const LOCK_CLICK_DELAY_MS = 900;
  const OPENING_SOUNDS = {
    /* Негромкий металлический щелчок: два коротких высоких щелчка, синтезированных WebAudio. */
    'lock-click'() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioContext = new AudioContext();
      setTimeout(() => {
        const start = audioContext.currentTime;
        [[0, 2600], [0.08, 1700]].forEach(([at, frequency]) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(frequency, start + at);
          gain.gain.setValueAtTime(0.0001, start + at);
          gain.gain.exponentialRampToValueAtTime(0.12, start + at + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.05);
          oscillator.connect(gain).connect(audioContext.destination);
          oscillator.start(start + at);
          oscillator.stop(start + at + 0.06);
        });
        setTimeout(() => audioContext.close(), 500);
      }, LOCK_CLICK_DELAY_MS);
    },
  };

  function burstFrom(element) {
    if (!effects || !element) return;
    const box = element.getBoundingClientRect();
    effects.burst(box.left + box.width / 2, box.top + box.height / 2);
  }

  /* Торт «Сюрприза»: касание задувает свечи, сыплется конфетти, появляется «Сбудется!». */
  function setupCake() {
    const cake = card.querySelector('.cake');
    if (!cake) return;
    cake.addEventListener('click', () => {
      if (card.classList.contains('blown')) return;
      card.classList.add('blown');
      burstFrom(cake.querySelector('.candles'));
      showDoneNotes(cake);
    });
  }

  /* Конверт «Замка сердца»: касание открывает клапан, письмо выезжает, дальше видно письмо и всё после него. */
  const ENVELOPE_OPEN_MS = 1100;
  function setupEnvelope() {
    const envelope = card.querySelector('[data-envelope]');
    if (!envelope) return;
    envelope.addEventListener('click', () => {
      envelope.classList.add('is-open');
      envelope.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        envelope.closest('.scenes')?.classList.add('is-open');
        document.getElementById(envelope.getAttribute('aria-controls'))?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      }, reduceMotion ? 0 : ENVELOPE_OPEN_MS);
    });
  }

  /* Три маленьких подарка «Сюрприза»: касание открывает коробочку и показывает её пожелание. */
  function setupMiniGifts() {
    const gifts = [...card.querySelectorAll('[data-gift]')];
    gifts.forEach((gift) => gift.addEventListener('click', () => {
      gift.classList.add('is-open');
      gifts.forEach((other) => {
        other.setAttribute('aria-expanded', String(other === gift));
        document.getElementById(other.getAttribute('aria-controls')).hidden = other !== gift;
      });
      burstFrom(gift);
    }));
  }

  let sceneObserver = null;
  function observeScenes() {
    sceneObserver?.disconnect();
    const scenes = card.querySelectorAll('.scene');
    const observer = new IntersectionObserver(
      (entries) => entries.filter((entry) => entry.isIntersecting).forEach((entry) => entry.target.classList.add('in')),
      { threshold: 0.2 },
    );
    scenes.forEach((scene) => observer.observe(scene));
    sceneObserver = observer;
  }

  /* Нажатие на любое фото истории открывает его на весь экран; нажатие ещё раз или Esc закрывает. */
  function setupLightbox() {
    const photos = card.querySelectorAll('[data-photo]');
    if (photos.length === 0 || typeof HTMLDialogElement !== 'function') return;
    const box = document.createElement('dialog');
    box.className = 'photo-lightbox';
    box.setAttribute('aria-label', 'Фото из поздравления');
    const image = document.createElement('img');
    image.alt = '';
    box.append(image);
    card.append(box);
    box.addEventListener('click', () => box.close());
    photos.forEach((photo) => photo.addEventListener('click', () => {
      image.src = photo.querySelector('img').src;
      box.showModal();
    }));
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
    card.querySelectorAll('.photos img[loading="lazy"], [data-photo] img[loading="lazy"]').forEach((image) => {
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

  /* Что делается только при первом открытии: открытие считается один раз, песня и эффекты запускаются один раз. */
  let firstOpen = true;
  let song = null;

  function open() {
    if (opened) return;
    opened = true;
    card.classList.add('opening');
    if (firstOpen) {
      firstOpen = false;
      preloadPhotos();
      if (card.dataset.track === '1') navigator.sendBeacon(`/c/${card.dataset.code}/opened`);
      loadBrandFonts();
      startMusic();
      song = loadSong();
      effects = startEffects();
    }
    const burstDelay = BURST_DELAY_MS[card.dataset.fx];
    if (effects && burstDelay !== undefined) setTimeout(() => burstFrom(card.querySelector('.gate-btn')), burstDelay);
    playOpeningSound();
    observeScenes();
    setTimeout(() => {
      card.classList.add('opened');
      document.body.classList.remove('locked');
      song?.play();
      song = null;
    }, reduceMotion ? 0 : Number(card.dataset.openMs));
  }

  /* «Повторить праздник», «Открыть ещё раз»: открытка возвращается к первому экрану и открывается заново. */
  function replay() {
    window.scrollTo({ top: 0 });
    card.classList.remove('opening', 'opened', 'blown');
    card.querySelectorAll('.scene.in, .is-open').forEach((element) => element.classList.remove('in', 'is-open'));
    card.querySelectorAll('[data-done-note]').forEach((note) => { note.hidden = true; });
    document.body.classList.add('locked');
    opened = false;
  }

  /* Кнопки историй: data-action на кнопке говорит, что сделать. Действия шаблонов добавляются ниже. */
  const MAX_NEW_STARS = 40;
  const ACTIONS = {
    replay,
    /* «Сияние»: на небе загорается ещё одна звезда в случайном месте, вокруг неё вспышка. */
    'new-star'(button) {
      const sky = button.closest('.scene')?.querySelector('.au-new-stars');
      if (!sky || sky.childElementCount >= MAX_NEW_STARS) return;
      const star = document.createElement('i');
      star.className = 'au-new-star';
      star.style.left = `${8 + Math.random() * 84}%`;
      star.style.top = `${6 + Math.random() * 40}%`;
      sky.append(star);
      burstFrom(star);
    },
    /* «Перечитать этот выпуск»: плавно вернуться к первой странице журнала. */
    reread() {
      card.querySelector(".scenes .scene")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    },
    /* Снежный шар: из звезды на ёлке разлетается снег, появляется «Желание загадано». */
    wish(button) {
      burstFrom(card.querySelector('.ft-star') ?? button);
      showDoneNotes(button);
    },
  };

  function showDoneNotes(button) {
    button.closest('.scene')?.querySelectorAll('[data-done-note]').forEach((note) => { note.hidden = false; });
  }

  card.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button) ACTIONS[button.dataset.action]?.(button);
  });

  /* Снежный шар можно не только нажать, но и встряхнуть: провести по нему пальцем. */
  const SWIPE_PX = 36;
  function setupSwipeOpen() {
    const target = card.querySelector('.gate-btn.globe');
    if (!target) return;
    let startX = null;
    target.addEventListener('pointerdown', (event) => { startX = event.clientX; });
    target.addEventListener('pointermove', (event) => {
      if (startX === null || Math.abs(event.clientX - startX) < SWIPE_PX) return;
      startX = null;
      open();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => target.addEventListener(name, () => { startX = null; }));
  }

  /* Звук открытия шаблона (щелчок замка), если он есть. Звук синтезируется на месте, файлов не нужно. */
  function playOpeningSound() {
    OPENING_SOUNDS[card.dataset.sound]?.();
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
    if (!name) return;
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
  setupLightbox();
  setupSwipeOpen();
  setupCake();
  setupMiniGifts();
  setupEnvelope();
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
