import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public');
// Copy only public assets. HTML stays behind Express so its CSP headers apply.
const directories = [
  ['frontend/storefront/css', 'css'],
  ['frontend/storefront/img', 'img'],
  ['frontend/storefront/lib', 'lib'],
  ['frontend/storefront/lib', 'src/lib'],
  ['frontend/admin/assets', 'admin/assets']
];
export async function buildAssets(destination = output) {
  await fs.mkdir(destination, { recursive: true });
  for (const [source, target] of directories) {
    await fs.cp(path.join(root, source), path.join(destination, target), { recursive: true });
  }
  for (const name of ['main.js', 'safety.js']) {
    await fs.mkdir(path.join(destination, 'js'), { recursive: true });
    await fs.copyFile(path.join(root, 'frontend/storefront/js', name), path.join(destination, 'js', name));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildAssets();
  console.log('Prepared public storefront and admin assets for Vercel.');
}
