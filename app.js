import express from 'express';
import backend from './backend/src/app.js';

// Shared handler exported by api/index.js. Local startup stays in backend/server.js.
const app = express();
app.disable('x-powered-by');
app.use(backend);
export default app;
