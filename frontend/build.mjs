import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadEnv } from 'vite';
import { normalizeApiBase } from './src/shared/api-url.js';

const frontend = path.dirname(fileURLToPath(import.meta.url));
export async function buildAssets(destination) {
  await build({ configFile:path.join(frontend,'vite.config.js'), build:{outDir:path.resolve(destination),emptyOutDir:true} });
}

export function deploymentConfig(apiUrl = '') {
  const apiOrigin = normalizeApiBase(apiUrl);
  if (apiOrigin && new URL(apiOrigin).protocol !== 'https:') {
    throw new Error('VITE_API_URL must use HTTPS in the production build.');
  }
  const csp = [
    "default-src 'self'", "script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com",
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:", "img-src 'self' https: data: blob:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''} https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com`,
    "frame-src https://*.firebaseapp.com https://accounts.google.com", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests'
  ].join('; ');
  return { version:3, routes:[
    { src:'/(.*)', headers:{ 'Content-Security-Policy':csp, 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'strict-origin-when-cross-origin' }, continue:true },
    { src:'/admin/?', dest:'/index.html' },
    { src:'/(account|orders|wishlist)/?', dest:'/index.html' },
    { handle:'filesystem' }
  ] };
}

export async function buildFrontend(destination = path.resolve('.vercel/output')) {
  const viteEnv = loadEnv('production', frontend, 'VITE_');
  const apiUrl = process.env.VITE_API_URL ?? viteEnv.VITE_API_URL ?? '';
  const config = deploymentConfig(apiUrl);
  const assets = path.join(destination, 'static');
  await buildAssets(assets);
  await fs.writeFile(path.join(destination, 'config.json'), JSON.stringify(config, null, 2));
  return config;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = await buildFrontend();
  const apiDirective = config.routes[0].headers['Content-Security-Policy'].match(/connect-src 'self'([^;]*)/);
  console.log(`Built static frontend for Vercel${apiDirective?.[1] ? ' with the configured API origin in its Content-Security-Policy' : ' without VITE_API_URL; production API requests will report a configuration error'}.`);
}
