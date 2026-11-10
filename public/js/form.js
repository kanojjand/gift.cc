(() => {
  const MAX_SIDE = 1280;
  const JPEG_QUALITY = 0.76;
  const TEXT_FIELDS = ['sender', 'recipient', 'message'];

  const form = document.getElementById('greeting-form');
  const list = document.getElementById('photo-list');
  const addTile = document.getElementById('photo-add');
  const input = document.getElementById('photo-input');
  const photoError = document.getElementById('photo-error');
  const formError = document.getElementById('form-error');
  const submit = document.getElementById('submit');
  const maxPhotos = Number(list.dataset.max);
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

  form.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      form.elements.message.value = chip.dataset.text;
      form.elements.message.dispatchEvent(new Event('input', { bubbles: true }));
      form.elements.message.focus();
    });
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
    ['sender', 'recipient', 'message'].forEach((name) => payload.append(name, form.elements[name].value));
    const song = form.querySelector('input[name="songId"]:checked');
    if (song) payload.append('songId', song.value);
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
    submit.textContent = 'Далее';
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

  updateCounter();
  updateAddTile();
})();
