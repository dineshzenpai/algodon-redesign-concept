import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

const chrome=process.env.CHROME_EXECUTABLE || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
export default defineConfig({
  testDir:'./test',
  timeout:30000,
  workers:1,
  reporter:'list',
  use:{
    baseURL:process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:5173',
    launchOptions:chrome&&fs.existsSync(chrome)?{executablePath:chrome}:{},
    colorScheme:'light',reducedMotion:'reduce',trace:'retain-on-failure'
  },
  projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:900}}}],
  webServer:process.env.FRONTEND_TEST_URL?undefined:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI}
});
