import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const frontend = path.dirname(fileURLToPath(import.meta.url));
export async function buildAssets(destination) {
  await build({ configFile:path.join(frontend,'vite.config.js'), build:{outDir:path.resolve(destination),emptyOutDir:true} });
}

export function deploymentConfig(backendUrl = '') {
  let origin;
  if (backendUrl.trim()) {
    const url = new URL(backendUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('RENDER_BACKEND_URL must be an HTTPS origin, e.g. https://your-service.onrender.com (no /api path).');
    }
    origin = url.origin;
  }
  const csp = [
    "default-src 'self'", "script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com",
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:", "img-src 'self' https: data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
    "frame-src https://*.firebaseapp.com https://accounts.google.com", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests'
  ].join('; ');
  return { version:3, routes:[
    { src:'/(.*)', headers:{ 'Content-Security-Policy':csp, 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'strict-origin-when-cross-origin' }, continue:true },
    { src:'/api(?:/(.*))?', dest:origin ? `${origin}/api/$1` : '/backend-unavailable.json', ...(origin ? {} : { status:503 }), headers:{ 'Cache-Control':'no-store' } },
    { src:'/admin/?', dest:'/index.html' },
    { src:'/(account|orders|wishlist)/?', dest:'/index.html' },
    { handle:'filesystem' }
  ] };
}

export async function buildFrontend(destination = path.resolve('.vercel/output'), backendUrl = process.env.RENDER_BACKEND_URL || '') {
  const config = deploymentConfig(backendUrl);
  const assets = path.join(destination, 'static');
  await buildAssets(assets);
  // An unconnected preview can deploy before the Render service exists.
  await fs.writeFile(path.join(assets, 'backend-unavailable.json'), JSON.stringify({ error:'The backend is not connected yet. Please try again later.' }));
  await fs.writeFile(path.join(destination, 'config.json'), JSON.stringify(config, null, 2));
  return config;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildFrontend();
  console.log(process.env.RENDER_BACKEND_URL ? 'Built static frontend with Render API proxy.' : 'Built static frontend preview. Set RENDER_BACKEND_URL and redeploy to enable backend features.');
}
