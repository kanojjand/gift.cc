/**
 * Помощники для украшений в историях тем: ветки по углам, детерминированный разброс (одинаковый при каждой
 * отрисовке, без Math.random на сервере).
 */

export const range = (count) => Array.from({ length: count }, (_, i) => i);

const fixed = (value) => Number(value.toFixed(1));

/** «Случайное» число от 0 до 1, одинаковое при каждой отрисовке (без Math.random на сервере). */
export function spread(i, salt) {
  const value = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Веточка: прямой стебель под углом angle (градусы) и иголки или листья вдоль него, к концу короче.
 * Возвращает команды path для штриха.
 */
export function needleSprig(x, y, angle, length, count, needle) {
  const rad = (angle * Math.PI) / 180;
  const [dx, dy] = [Math.cos(rad), Math.sin(rad)];
  const needles = range(count).map((i) => {
    const t = (i + 1) / (count + 1);
    const [px, py] = [x + dx * length * t, y + dy * length * t];
    const size = needle * (1 - t * 0.55);
    return [-1, 1].map((side) => {
      const turn = rad + side * 0.75;
      return `M${fixed(px)} ${fixed(py)} l${fixed(Math.cos(turn) * size)} ${fixed(Math.sin(turn) * size)}`;
    }).join(' ');
  });
  return `M${fixed(x)} ${fixed(y)} L${fixed(x + dx * length)} ${fixed(y + dy * length)} ${needles.join(' ')}`;
}

/** Угловое украшение: tl, tr, bl, br — левый/правый верхний или нижний угол блока. */
export const corner = (className, where, viewBox, body) =>
  `<svg class="pc-corner pc-${where} ${className}" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`;
