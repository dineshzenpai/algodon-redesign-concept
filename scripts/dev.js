import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={...process.env,CLIENT_URL:process.env.DEV_CLIENT_URL || 'http://localhost:5173',DEV_BACKEND_URL:process.env.DEV_BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 3000}`};
const children=[
  spawn(process.execPath,['--watch','backend/server.js'],{cwd:root,env,stdio:'inherit',windowsHide:true}),
  spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1'],{cwd:path.join(root,'frontend'),env,stdio:'inherit',windowsHide:true})
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>stop(code || 0));}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
