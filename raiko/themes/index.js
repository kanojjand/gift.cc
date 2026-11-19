import aurora from './aurora.js';
import birthday from './birthday.js';
import bloom from './bloom.js';
import love from './love.js';
import newyear from './newyear.js';

/**
 * Новые шаблоны: один файл на шаблон. В файле первый экран (gate), фон (backdrop),
 * украшения сцен (decor: hello, message, photos, closing), разделитель (divider) и финальная фраза (closingLine).
 * Все функции получают { recipient, sender, initial, senderInitial, year }.
 * Старые шаблоны описаны в gates.js и decor.js.
 */
export const THEMES = Object.freeze({ newyear, birthday, love, bloom, aurora });

export function getTheme(templateId) {
  return Object.hasOwn(THEMES, templateId) ? THEMES[templateId] : null;
}
