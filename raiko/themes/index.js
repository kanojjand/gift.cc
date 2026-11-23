import aurora from './aurora.js';
import birthday from './birthday.js';
import bloom from './bloom.js';
import love from './love.js';
import newyear from './newyear.js';

/**
 * Новые шаблоны: один файл на шаблон. В файле первый экран (gate), фон (backdrop), разделитель (divider)
 * и история после открытия (story) — свои экраны и свой способ взаимодействия у каждого шаблона.
 * gate и backdrop получают { recipient, sender, initial, senderInitial, year }; story — ещё
 * { template, message, photoUrls, from, song } (song — готовый плеер песни, его ставят там, где песня по сценарию).
 * Общие части историй (фото-кнопка, письмо с подписью, финальные кнопки) — в story.js.
 * Необязательно: sound — звук открытия (сейчас 'lock-click' у замка). Старые шаблоны описаны в gates.js и decor.js.
 */
export const THEMES = Object.freeze({ newyear, birthday, love, bloom, aurora });

export function getTheme(templateId) {
  return Object.hasOwn(THEMES, templateId) ? THEMES[templateId] : null;
}
