import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';

async function start() {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log(`[api] Algodon API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[api] CORS origin: ${env.clientUrl}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[api] ${signal} received - shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => {
    console.error('[api] Unhandled rejection:', err);
    server.close(() => process.exit(1));
  });
}

start().catch((err) => {
  console.error('[api] Failed to start:', err.message);
  process.exit(1);
});
