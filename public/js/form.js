(() => {
  const MAX_SIDE = 1280;
  const JPEG_QUALITY = 0.76;
  const TEXT_FIELDS = ['sender', 'recipient', 'message', 'musicLink', 'musicStartMin', 'musicStartSec'];
  const MUSIC_CHECK_DELAY_MS = 350;
  const PLAYER_PERMISSIONS = 'autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write';

  const form = document.getElementById('greeting-form');
  const list = document.getElementById('photo-list');
  const addTile = document.getElementById('photo-add');
  const input = document.getElementById('photo-input');
  const photoError = document.getElementById('photo-error');
  const formError = document.getElementById('form-error');
  const submit = document.getElementById('submit');
  const maxPhotos = Number(list.dataset.max);
  const SUBMIT_LABEL = submit.textContent;
  const newPhotos = new Map();

  const tiles = () => [...list.querySelectorAll('.thumb:not(.add)')];
  const updateAddTile = () => {
    addTile.hidden = tiles().length >= maxPhotos;
  };

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      image.src = url;
    });
  }

  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file);
      } catch {
        return loadImage(file);
      }
    }
    return loadImage(file);
  }

  async function compress(file) {
    const source = await decode(file);
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', JPEG_QUALITY);
    });
  }

  function addThumb(blob) {
    const tile = document.createElement('div');
    tile.className = 'thumb';
    const image = document.createElement('img');
    image.src = URL.createObjectURL(blob);
    image.alt = '';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'thumb-x';
    remove.setAttribute('aria-label', 'Убрать фото');
    remove.textContent = '×';
    tile.append(image, remove);
    list.insertBefore(tile, addTile);
    newPhotos.set(tile, blob);
  }

  input.addEventListener('change', async () => {
    photoError.textContent = '';
    const room = maxPhotos - tiles().length;
    const files = [...input.files];
    input.value = '';
    if (files.length > room) photoError.textContent = `Можно добавить не больше ${maxPhotos} фото`;
    submit.disabled = true;
    try {
      for (const file of files.slice(0, room)) addThumb(await compress(file));
    } catch {
      photoError.textContent = 'Не удалось открыть фото, выберите другое';
    }
    submit.disabled = false;
    updateAddTile();
  });

  list.addEventListener('click', (event) => {
    if (!event.target.classList.contains('thumb-x')) return;
    const tile = event.target.closest('.thumb');
    newPhotos.delete(tile);
    tile.remove();
    updateAddTile();
  });

  /* Готовые тексты: язык, повод, вариант. Свой текст не теряется: его можно вернуть одной кнопкой. */
  const picker = document.getElementById('text-picker');
  const message = form.elements.message;
  const undoButton = document.getElementById('message-undo');
  const readyTexts = new Set([...picker.querySelectorAll('.variant-text')].map((node) => node.textContent));
  let ownText = null;

  const visibleVariants = () => [...picker.querySelectorAll('.tp-variants:not([hidden]) .variant')];
  const textOf = (variant) => variant.querySelector('.variant-text').textContent;

  function markSelected() {
    visibleVariants().forEach((variant) => variant.setAttribute('aria-pressed', String(textOf(variant) === message.value)));
  }

  function showGroup() {
    const { lang, occ } = picker.dataset;
    picker.querySelectorAll('.tp-variants').forEach((group) => {
      group.hidden = group.dataset.lang !== lang || group.dataset.occ !== occ;
    });
    picker.querySelectorAll('.tp-lang button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    picker.querySelectorAll('.tp-occasions .chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.occ === occ)));
    markSelected();
  }

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.lang) picker.dataset.lang = button.dataset.lang;
    else if (button.dataset.occ) {
      picker.dataset.occ = button.dataset.occ;
      button.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    } else if (button.classList.contains('variant')) {
      if (message.value.trim() && !readyTexts.has(message.value)) {
        ownText = message.value;
        undoButton.hidden = false;
      }
      message.value = textOf(button);
      message.dispatchEvent(new Event('input', { bubbles: true }));
      message.classList.remove('flash');
      void message.offsetWidth;
      message.classList.add('flash');
    }
    showGroup();
  });

  undoButton.addEventListener('click', () => {
    message.value = ownText ?? '';
    ownText = null;
    undoButton.hidden = true;
    message.dispatchEvent(new Event('input', { bubbles: true }));
    markSelected();
  });

  message.addEventListener('input', (event) => {
    if (event.isTrusted) {
      ownText = null;
      undoButton.hidden = true;
    }
    markSelected();
  });

  const preview = new Audio();
  let playingButton = null;

  function stopPreview() {
    preview.pause();
    if (playingButton) playingButton.textContent = '▶';
    playingButton = null;
  }

  form.querySelectorAll('.song-play').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const isSame = playingButton === button;
      stopPreview();
      if (isSame) return;
      button.closest('.song').querySelector('input').checked = true;
      preview.src = button.dataset.src;
      preview.play().then(() => {
        button.textContent = '❚❚';
        playingButton = button;
      }).catch(() => {
        formError.textContent = 'Не удалось включить мелодию';
      });
    });
  });

  function showFieldErrors(errors = {}) {
    form.querySelectorAll('[data-error]').forEach((node) => {
      node.textContent = errors[node.dataset.error] || '';
    });
  }

  function buildPayload() {
    const payload = new FormData();
    payload.append('templateId', form.dataset.template);
    TEXT_FIELDS.forEach((name) => payload.append(name, form.elements[name]?.value ?? ''));
    const song = form.querySelector('input[name="songId"]:checked');
    if (song) payload.append('songId', song.value);
    const palette = form.querySelector('input[name="palette"]:checked');
    if (palette) payload.append('palette', palette.value);
    tiles().forEach((tile) => {
      if (tile.dataset.keep) payload.append('keep', tile.dataset.keep);
      else payload.append('photos', newPhotos.get(tile), 'photo.jpg');
    });
    return payload;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    stopPreview();
    formError.textContent = '';
    showFieldErrors();
    submit.disabled = true;
    submit.textContent = 'Сохраняем…';
    const code = form.dataset.code;
    try {
      const response = await fetch(`/c/${code}`, { method: 'POST', body: buildPayload() });
      if (response.ok) {
        clearSavedText();
        window.location.replace(`/c/${code}`);
        return;
      }
      if (response.status === 409) {
        window.location.reload();
        return;
      }
      const body = await response.json().catch(() => ({}));
      showFieldErrors(body.errors);
      formError.textContent = body.error || 'Не получилось сохранить, попробуйте ещё раз';
    } catch {
      formError.textContent = 'Нет связи. Проверьте интернет и попробуйте ещё раз';
    }
    submit.disabled = false;
    submit.textContent = SUBMIT_LABEL;
  });

  /* Палитра: обложка формы перекрашивается сразу, ссылка «посмотреть» ведёт на демо в выбранном цвете. */
  const hero = document.getElementById('form-hero');
  const palettePreview = document.getElementById('palette-preview');
  const PALETTE_VARS = ['--p-bg', '--p-bg2', '--p-ink', '--p-a', '--p-a2'];
  form.querySelectorAll('input[name="palette"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const swatch = radio.closest('.palette');
      PALETTE_VARS.forEach((name) => hero?.style.setProperty(name, swatch.style.getPropertyValue(name)));
      if (palettePreview) palettePreview.href = `/demo/${form.dataset.template}?p=${encodeURIComponent(radio.value)}`;
    });
  });

  /* Выбор фото на телефоне может выгрузить страницу из памяти: текст не должен пропасть. Хранилище необязательно. */
  const draftKey = `greeting:${form.dataset.code}`;
  const messageCount = document.getElementById('message-count');

  function readSavedText() {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey)) || {};
    } catch {
      return {};
    }
  }

  function saveText() {
    try {
      const values = Object.fromEntries(TEXT_FIELDS.map((name) => [name, form.elements[name].value]));
      sessionStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      /* Без хранилища форма работает как обычно. */
    }
  }

  function clearSavedText() {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* Нечего очищать. */
    }
  }

  function updateCounter() {
    const message = form.elements.message;
    messageCount.textContent = `${[...message.value].length} / ${message.maxLength}`;
  }

  const saved = readSavedText();
  TEXT_FIELDS.filter((name) => !form.elements[name].value && saved[name]).forEach((name) => {
    form.elements[name].value = saved[name];
  });
  form.addEventListener('input', () => {
    saveText();
    updateCounter();
  });

  /* Песня по ссылке: сразу пишем, узнали ли ссылку, и показываем сам плеер, чтобы покупатель проверил, что песня включается. */
  function showPlayer(box, music) {
    if (!music) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    if (box.querySelector('iframe')?.src === music.src) return;
    const frame = document.createElement('iframe');
    frame.src = music.src;
    frame.title = `Песня, ${music.name}`;
    frame.allow = PLAYER_PERMISSIONS;
    frame.referrerPolicy = 'strict-origin';
    box.dataset.service = music.service;
    box.style.setProperty('--player-h', music.height ? `${music.height}px` : '');
    box.replaceChildren(frame);
    box.hidden = false;
  }

  function musicStatusText(text, music, errorText) {
    if (!text) return '';
    if (!music) return errorText;
    if (music.fullTrack) return `✓ ${music.name}: песня включится сама, как только откроют открытку, и сыграет целиком. Ниже можно выбрать момент.`;
    const how = music.autoplay ? 'включится сама' : 'включится, когда получатель нажмёт ▶';
    return `✓ ${music.name}: ${how}, но без подписки сыграет только отрывок около 30 секунд, и момент выбрать нельзя. Чтобы песня включалась сама и играла целиком с нужного места, возьмите ссылку из YouTube.`;
  }

  const startInputs = () => ['musicStartMin', 'musicStartSec'].map((name) => form.elements[name]);

  /* Время из ссылки (YouTube «Поделиться → Начало 1:05») переносим в поля. Другая песня — поля сбрасываются.
     При первой проверке набранное раньше не трогаем: страницу могли перезагрузить посреди заполнения. */
  function syncStartFields(state, parsed, lib) {
    const key = parsed && lib.musicEmbed(parsed).canStart ? `${parsed.id}:${parsed.start}` : null;
    if (key === state.lastKey) return;
    const firstCheck = state.lastKey === undefined;
    state.lastKey = key;
    const [minutes, seconds] = startInputs();
    if (!key || (firstCheck && (minutes.value || seconds.value))) return;
    const parts = lib.startParts(parsed.start);
    minutes.value = parts.minutes;
    seconds.value = parts.seconds;
  }

  function setupMusicLink(field) {
    const status = document.getElementById('music-status');
    const box = document.getElementById('music-preview');
    const startBox = document.getElementById('music-start');
    const startError = startBox.querySelector('[data-error="musicStart"]');
    const state = { lastKey: undefined };
    let timer = null;
    import(field.dataset.module).then((lib) => {
      const check = () => {
        const text = field.value.trim();
        const parsed = lib.parseMusicLink(text);
        syncStartFields(state, parsed, lib);
        const start = lib.readStartTime(...startInputs().map((input) => input.value));
        const music = lib.musicEmbed(start === null ? parsed : lib.withStart(parsed, start));
        status.className = `music-status${music ? (music.fullTrack ? ' ok' : ' warn') : text ? ' bad' : ''}`;
        status.textContent = musicStatusText(text, music, lib.MUSIC_LINK_ERROR);
        startBox.hidden = !music?.canStart;
        startError.textContent = music?.canStart && start === null ? lib.MUSIC_START_ERROR : '';
        showPlayer(box, music);
      };
      const checkLater = () => {
        clearTimeout(timer);
        timer = setTimeout(check, MUSIC_CHECK_DELAY_MS);
      };
      [field, ...startInputs()].forEach((input) => input.addEventListener('input', checkLater));
      check();
    }).catch((error) => console.warn('[form] проверка ссылки на песню недоступна, её проверит сервер', error));
  }

  const musicField = document.getElementById('music-link');
  if (musicField) setupMusicLink(musicField);

  updateCounter();
  updateAddTile();
  showGroup();
})();
