import express from 'express';
import backend from './backend/src/app.js';

// Vercel detects root Express entry points. Local startup remains in backend/server.js.
const app = express();
app.disable('x-powered-by');
app.use(backend);
export default app;
