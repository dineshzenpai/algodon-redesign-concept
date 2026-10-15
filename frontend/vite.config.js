import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const backend = process.env.DEV_BACKEND_URL || 'http://127.0.0.1:3000';
export default defineConfig(({command}) => ({
  root,
  plugins:[react()],
  define:command==='build'?{'process.env.NODE_ENV':JSON.stringify('production')}:{},
  optimizeDeps:{entries:['index.html'],include:['react','react-dom/client','@supabase/supabase-js','jspdf']},
  server:{ port:5173, strictPort:true, proxy:{ '/api':{ target:backend, changeOrigin:false } } },
  preview:{ port:4173, strictPort:true, proxy:{ '/api':{ target:backend, changeOrigin:false } } },
  build:{ outDir:path.join(root,'dist'), emptyOutDir:true, sourcemap:false }
}));
