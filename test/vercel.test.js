import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../backend/src/app.js';
import { buildFrontend, deploymentConfig } from '../frontend/build.mjs';

test('Vercel builds only static frontend from either project root', async () => {
  for (const location of ['../vercel.json','../frontend/vercel.json']) {
    const config = JSON.parse(await fs.readFile(new URL(location, import.meta.url), 'utf8'));
    assert.equal(config.framework, null);
    assert.match(config.installCommand, /^npm ci(?: --prefix frontend)? --include=dev$/);
    assert.equal(config.functions, undefined);
    assert.equal(config.rewrites, undefined);
    assert.match(config.buildCommand, /^(?:node frontend\/build.mjs|npm run build)$/);
  }
  await assert.rejects(fs.access(new URL('../api/index.js', import.meta.url)));
});

test('Render backend serves only API responses and never exposes React source', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response=await fetch(base+'/');
    assert.equal(response.status,200);
    assert.equal((await response.json()).status,'API is running');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    for (const route of ['/admin','/orders','/account','/src/main.jsx','/frontend/src/main.jsx']) assert.equal((await fetch(base+route)).status,404);
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await fetch(base + '/api/not-found')).status, 404);
    assert.equal((await fetch(base + '/.env')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Vercel output contains frontend pages and safe preview configuration without backend code or secrets', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'algodon-vercel-'));
  try {
    await buildFrontend(destination, '');
    const assets = path.join(destination, 'static');
    for (const name of ['index.html','img/hero.jpg','img/favicon.svg']) {
      assert.ok((await fs.stat(path.join(assets, name))).isFile(), name);
    }
    for (const name of ['.env','backend','package.json','storefront','admin/admin.html','build.mjs','src','js/main.js']) {
      await assert.rejects(fs.access(path.join(assets, name)), { code:'ENOENT' });
    }
    await assert.rejects(fs.access(path.join(destination, 'functions')), { code:'ENOENT' });
    const html=await fs.readFile(path.join(assets,'index.html'),'utf8');
    assert.match(html, /id="root"/);
    assert.match(html, /src="\/assets\/index-[^\"]+\.js"/);
    const bundles=await fs.readdir(path.join(assets,'assets'));
    assert.ok(bundles.some(name=>/^Admin-.*\.js$/.test(name)));
    assert.ok(bundles.some(name=>/^Storefront-.*\.js$/.test(name)));
    const config = JSON.parse(await fs.readFile(path.join(destination,'config.json'),'utf8'));
    assert.equal(config.version, 3);
    assert.equal(config.routes.find(route => route.src.startsWith('/api')).status, 503);
    assert.match(config.routes[0].headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  } finally {
    const actual = path.resolve(destination);
    assert.equal(path.dirname(actual), path.resolve(os.tmpdir()));
    assert.ok(path.basename(actual).startsWith('algodon-vercel-'));
    await fs.rm(actual, { recursive: true, force: true });
  }
});

test('Render proxy preserves API paths, including public config, before React route fallbacks', () => {
  const { routes } = deploymentConfig('https://example.onrender.com');
  const api = routes.find(route => route.src.startsWith('/api'));
  assert.equal(api.dest, 'https://example.onrender.com/api/$1');
  assert.equal(api.status, undefined);
  assert.equal(api.headers['Cache-Control'], 'no-store');
  for (const route of ['/api/admin/auth/login','/api/account/orders','/api/checkout/orders','/api/config']) {
    assert.ok(new RegExp(`^${api.src}$`).test(route));
  }
  assert.ok(routes.some(route => route.src === '/admin/?' && route.dest === '/index.html'));
  for (const url of ['http://example.onrender.com','https://example.onrender.com/api','https://user:password@example.com','https://example.com?key=secret']) {
    assert.throws(() => deploymentConfig(url));
  }
});
