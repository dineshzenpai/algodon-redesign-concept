import { normalizeApiBase, resolveApiUrl } from './api-url.js';

const viteEnv = import.meta.env || {};
let apiBaseUrl = '';
let apiConfigurationError = null;
try { apiBaseUrl = normalizeApiBase(viteEnv.VITE_API_URL); }
catch (error) {
  apiConfigurationError = error;
  console.error('[api] Invalid VITE_API_URL:', error.message);
}
if (viteEnv.PROD && !apiBaseUrl && !apiConfigurationError) {
  apiConfigurationError = new Error('VITE_API_URL is missing from the production build.');
  console.error('[api] VITE_API_URL is missing. Add it to Vercel Production environment variables and redeploy.');
}

export async function request(path, options = {}) {
  if (apiConfigurationError) throw new Error('The store service is not configured correctly. Please contact support.');
  const url = resolveApiUrl(path, apiBaseUrl);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials:apiBaseUrl ? 'include' : 'same-origin',
      headers:{ ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers }
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.error(`[api] Request to ${url} failed:`, error);
    const connectionError = new Error('Could not reach the store service. Check your connection and try again.');
    connectionError.cause = error;
    throw connectionError;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 500) console.error(`[api] ${options.method || 'GET'} ${url} returned HTTP ${response.status}:`, result.error || 'No error details returned.');
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
