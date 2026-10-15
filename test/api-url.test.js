import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiBase, resolveApiUrl } from '../frontend/src/shared/api-url.js';

test('API URL resolution preserves endpoint paths and joins an origin once', () => {
  assert.equal(normalizeApiBase(' https://api.example.com/ '), 'https://api.example.com');
  assert.equal(resolveApiUrl('/api/config', 'https://api.example.com'), 'https://api.example.com/api/config');
  assert.equal(resolveApiUrl('/api/products', 'https://api.example.com/'), 'https://api.example.com/api/products');
  assert.equal(resolveApiUrl('/api/products', 'https://api.example.com/api'), 'https://api.example.com/api/products');
  assert.equal(resolveApiUrl('/api/health/ready', 'http://localhost:3000'), 'http://localhost:3000/api/health/ready');
});

test('API URLs remain relative for local Vite proxy and reject unsafe or malformed configuration', () => {
  assert.equal(resolveApiUrl('/api/config'), '/api/config');
  assert.equal(resolveApiUrl('api/config'), '/api/config');
  assert.throws(() => normalizeApiBase('ftp://api.example.com'), /HTTP\(S\)/);
  assert.throws(() => normalizeApiBase('https://user:pass@api.example.com'), /credentials/);
  assert.throws(() => normalizeApiBase('https://api.example.com/v1'), /origin/);
  assert.throws(() => resolveApiUrl('//evil.example/api/config', 'https://api.example.com'), /site-relative/);
  assert.throws(() => resolveApiUrl('/products', 'https://api.example.com'), /start with \/api/);
});
