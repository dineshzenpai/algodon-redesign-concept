export function normalizeApiBase(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  let url;
  try { url = new URL(raw); }
  catch { throw new TypeError('VITE_API_URL must be an absolute HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('VITE_API_URL must be an HTTP(S) origin without credentials, query, or fragment.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api') throw new TypeError('VITE_API_URL must be an origin, optionally ending in /api.');
  return url.origin;
}

export function resolveApiUrl(endpoint, baseUrl = '') {
  let path = String(endpoint || '');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.startsWith('//')) throw new TypeError('Backend endpoints must be site-relative paths.');
  if (!path.startsWith('/api/') && path !== '/api') {
    throw new TypeError('Backend endpoints must start with /api.');
  }
  const base = normalizeApiBase(baseUrl);
  return base ? new URL(path, base).toString() : path;
}
