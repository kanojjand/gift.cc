/** Контакты на последней странице. Позже здесь появятся данные магазина из партии. */
export const BRAND = Object.freeze({
  name: 'CC Lab',
  tagline: 'дарим эмоции',
  site: { label: 'cclab.kz', url: 'https://cclab.kz' },
  whatsapp: { label: 'WhatsApp', phone: '77754815992' },
  telegram: { label: 'Telegram', url: 'https://t.me/code_collective_lab' },
  instagram: { label: 'Instagram', url: 'https://instagram.com/cclab.kz' },
});

export function whatsappLink(text = '') {
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${BRAND.whatsapp.phone}${query}`;
}
