import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../backend/src/app.js';
import { env } from '../backend/src/config/env.js';
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

test('Vercel output embeds VITE_API_URL in the production bundle and CSP without backend code or secrets', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'algodon-vercel-'));
  const previousApiUrl = process.env.VITE_API_URL;
  try {
    process.env.VITE_API_URL = 'https://api.example.test';
    await buildFrontend(destination);
    const assets = path.join(destination, 'static');
    for (const name of ['index.html','img/hero.jpg','img/favicon.svg']) {
      assert.ok((await fs.stat(path.join(assets, name))).isFile(), name);
    }
    for (const name of ['.env','backend','package.json','storefront','admin/admin.html','build.mjs','src','js/main.js']) {
      await assert.rejects(fs.access(path.join(assets, name)), { code:'ENOENT' });
    }
    await assert.rejects(fs.access(path.join(assets, 'backend-unavailable.json')), { code:'ENOENT' });
    await assert.rejects(fs.access(path.join(destination, 'functions')), { code:'ENOENT' });
    const html=await fs.readFile(path.join(assets,'index.html'),'utf8');
    assert.match(html, /id="root"/);
    assert.match(html, /src="\/assets\/index-[^\"]+\.js"/);
    const bundles=await fs.readdir(path.join(assets,'assets'));
    assert.ok(bundles.some(name=>/^Admin-.*\.js$/.test(name)));
    assert.ok(bundles.some(name=>/^Storefront-.*\.js$/.test(name)));
    const javascript=await Promise.all(bundles.filter(name=>name.endsWith('.js')).map(name=>fs.readFile(path.join(assets,'assets',name),'utf8')));
    assert.ok(javascript.some(bundle=>bundle.includes('https://api.example.test')));
    const config = JSON.parse(await fs.readFile(path.join(destination,'config.json'),'utf8'));
    assert.equal(config.version, 3);
    assert.ok(!config.routes.some(route => route.src?.startsWith('/api')));
    assert.match(config.routes[0].headers['Content-Security-Policy'], /frame-ancestors 'none'/);
    assert.match(config.routes[0].headers['Content-Security-Policy'], /connect-src 'self' https:\/\/api\.example\.test/);
  } finally {
    if (previousApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = previousApiUrl;
    const actual = path.resolve(destination);
    assert.equal(path.dirname(actual), path.resolve(os.tmpdir()));
    assert.ok(path.basename(actual).startsWith('algodon-vercel-'));
    await fs.rm(actual, { recursive: true, force: true });
  }
});

test('Vercel CSP allows the API origin and static routes leave API calls to the configured client', () => {
  const { routes } = deploymentConfig('https://api.example.test');
  assert.match(routes[0].headers['Content-Security-Policy'], /connect-src 'self' https:\/\/api\.example\.test/);
  assert.ok(!routes.some(route => route.src?.startsWith('/api')));
  assert.ok(routes.some(route => route.src === '/admin/?' && route.dest === '/index.html'));
  assert.throws(() => deploymentConfig('http://api.example.test'), /must use HTTPS/);
});

test('Render API enables credentialed CORS only for configured frontend origins', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const origin = new URL(env.clientUrl).origin;
    const response = await fetch(base + '/api/admin/auth/login', { method:'OPTIONS', headers:{
      Origin:origin,
      'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'content-type,x-admin-request'
    } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const rejected = await fetch(base + '/api/config', { headers:{ Origin:'https://untrusted.example' } });
    assert.equal(rejected.status, 403);
    assert.notEqual(rejected.headers.get('access-control-allow-origin'), 'https://untrusted.example');
    const rejectedPreflight = await fetch(base + '/api/admin/auth/login', { method:'OPTIONS', headers:{
      Origin:'https://untrusted.example',
      'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'content-type,x-admin-request'
    } });
    assert.equal(rejectedPreflight.status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
