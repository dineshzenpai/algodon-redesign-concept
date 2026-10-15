import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../app.js';
import { buildAssets } from '../scripts/build-vercel.js';

test('Vercel entry serves storefront, admin, deep links and API without starting a listener on import', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/', '/admin', '/orders']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    }
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/not-found')).status, 404);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Vercel build prepares CDN assets without exposing server files, HTML or dynamic configuration', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'algodon-vercel-'));
  try {
    await buildAssets(destination);
    for (const name of ['css/styles.css', 'img/hero.jpg', 'js/main.js', 'js/safety.js', 'lib/firebase.js', 'src/lib/auth-context.js', 'admin/assets/admin.js', 'admin/assets/admin.css']) {
      assert.ok((await fs.stat(path.join(destination, name))).isFile(), name);
    }
    for (const name of ['.env', 'index.html', 'admin.html', 'admin/index.html', 'js/config.js', 'backend', 'package.json']) {
      await assert.rejects(fs.access(path.join(destination, name)), { code: 'ENOENT' });
    }
  } finally {
    const actual = path.resolve(destination);
    assert.equal(path.dirname(actual), path.resolve(os.tmpdir()));
    assert.ok(path.basename(actual).startsWith('algodon-vercel-'));
    await fs.rm(actual, { recursive: true, force: true });
  }
});
