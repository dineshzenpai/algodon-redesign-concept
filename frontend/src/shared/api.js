export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials:'same-origin',
    headers:{ ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'The service is temporarily unavailable. Please try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}
export const money = value => 'Rs. ' + Number(value || 0).toLocaleString('en-IN');
export function readStorage(key, fallback, storage = localStorage) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeStorage(key, value, storage = localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* Private mode and full storage must not break shopping. */ }
}
export function removeStorage(key, storage = localStorage) {
  try { storage.removeItem(key); } catch { /* Storage is optional. */ }
}
