export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export function safeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, 'https://storefront.invalid/');
    return ['http:', 'https:'].includes(url.protocol) ? value : '';
  } catch { return ''; }
}

export function normalizeCart(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).filter(item => item && typeof item === 'object'
    && typeof item.id === 'string' && item.id.length <= 100
    && typeof item.name === 'string' && item.name.length <= 200
    && typeof item.size === 'string' && item.size.length <= 40
    && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 100
    && Number.isFinite(item.price) && item.price >= 0
  ).map(item => ({ ...item, img: safeImageUrl(item.img) }));
}
