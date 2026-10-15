import { buildFrontend } from '../frontend/build.mjs';

await buildFrontend();
console.log('Built static frontend for Vercel. Backend runs separately on Render.');
