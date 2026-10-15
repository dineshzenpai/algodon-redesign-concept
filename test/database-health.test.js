import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../backend/src/app.js';
import { setDb } from '../backend/src/config/db.js';

test('readiness and catalog endpoints report database failures without exposing details', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    setDb({ from() { throw new Error('private database details'); } });
    for (const route of ['/api/health/ready', '/api/products', '/api/categories']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /private database details/);
    }
    assert.equal((await fetch(base + '/api/health')).status, 200);
    setDb({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) });
    const response = await fetch(base + '/api/health/ready');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready', database: 'connected' });
    setDb({ from: () => ({ select: () => ({ limit: async () => ({ error: { message: 'private database details' } }) }) }) });
    assert.equal((await fetch(base + '/api/health/ready')).status, 503);
  } finally {
    setDb(null);
    await new Promise((resolve) => server.close(resolve));
  }
});
