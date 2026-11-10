class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Вставляет доверенную разметку без экранирования. Только для кода и библиотек, не для ввода людей. */
export function raw(value) {
  return new SafeHtml(value);
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  const out = strings.reduce((acc, part, i) => acc + part + (i < values.length ? renderValue(values[i]) : ''), '');
  return new SafeHtml(out);
}
