import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../api/index.js';
import { buildAssets } from '../scripts/build-vercel.js';

test('Vercel configuration targets an existing explicit Node function', async () => {
  const config = JSON.parse(await fs.readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.deepEqual(Object.keys(config.functions), ['api/index.js']);
  await fs.access(new URL('../api/index.js', import.meta.url));
  assert.equal(config.functions['api/index.js'].includeFiles, 'frontend/**');
  assert.equal(typeof config.functions['api/index.js'].excludeFiles, 'string');
  assert.equal(config.functions['api/index.js'].excludeFiles, '{.env,.env.*,**/.env,**/.env.*,docs/**}');
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/api/index' }]);
});

test('Vercel entry serves storefront, admin, deep links and API without starting a listener on import', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/', '/admin', '/orders', '/orders/', '/account/', '/wishlist/']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    }
    const html = await (await fetch(base + '/orders/')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/(?:css|js|img)\/[^"?#]+)"/g)].map(match => match[1]);
    assert.ok(assets.length > 10);
    assert.doesNotMatch(html, /(?:src|href|data-img)="(?:css|js|img)\//);
    for (const asset of new Set(assets)) assert.equal((await fetch(base + asset)).status, 200, asset);
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/not-found')).status, 404);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Vercel build prepares CDN assets without exposing server files, HTML or dynamic configuration', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'algodon-vercel-'));
  try {
    await buildAssets(destination);
    for (const name of ['css/styles.css', 'img/hero.jpg', 'img/favicon.svg', 'js/main.js', 'js/motion.js', 'js/safety.js', 'lib/firebase.js', 'src/lib/auth-context.js', 'admin/assets/admin.js', 'admin/assets/admin.css']) {
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
