import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

describe('Task 1: SQL Migration for public.order_intents RLS', () => {
  const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '202610150001_secure_order_intents.sql');

  it('migration file exists with proper timestamped naming', () => {
    assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  });

  it('migration enables RLS on public.order_intents and avoids FORCE RLS', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /alter\s+table\s+public\.order_intents\s+enable\s+row\s+level\s+security;/i);
    assert.ok(
      !/alter\s+table\s+public\.order_intents\s+force\s+row\s+level\s+security;/i.test(sql),
      'FORCE ROW LEVEL SECURITY must not be applied to prevent breaking security-definer functions'
    );
  });

  it('migration revokes permissions from public, anon, and authenticated', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.order_intents\s+from\s+public,\s*anon,\s*authenticated;/i);
  });

  it('migration explicitly grants necessary privileges to service_role', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.order_intents\s+to\s+service_role;/i);
  });

  it('migration does not create broad USING (true) policies for anon or authenticated', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const broadPolicy = /create\s+policy[^\n]+to\s+(?:anon|authenticated|public)[^\n]+using\s*\(\s*true\s*\)/i;
    assert.ok(!broadPolicy.test(sql), 'Must not create broad USING (true) policies for untrusted roles');
  });
});

describe('Task 2: Confined Static Asset Serving', () => {
  let server;
  let baseUrl;

  before(async () => {
    const appModule = await import('../backend/src/app.js');
    const app = appModule.default;
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('blocks access to sensitive project root files', async () => {
    const sensitivePaths = [
      '/package.json', '/package-lock.json', '/server.js', '/.env', '/.env.example',
      '/README.md', '/supabase/migrations/202610020001_admin_panel.sql',
      '/supabase/migrations/202610150001_secure_order_intents.sql', '/src/app.js',
      '/backend/server.js', '/backend/package.json', '/backend/src/app.js',
      '/backend/src/config/env.js', '/backend/src/config/db.js',
      '/backend/src/admin/routes.js', '/backend/src/admin/auth.js'
    ];

    for (const p of sensitivePaths) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.strictEqual(res.status, 404, `Expected 404 for sensitive path ${p}, received ${res.status}`);
    }
  });

  it('blocks access to URL-encoded paths, directory traversal, and uppercase variants', async () => {
    const encodedOrTraversalPaths = [
      '/%2eenv', '/%2eenv.example', '/package%2ejson', '/package%2Ejson',
      '/backend%2fsrc%2fconfig%2fenv.js', '/%2e%2e/package.json',
      '/css/..%2fpackage.json', '/css/../../package.json', '/js/..%2fpackage.json',
      '/img/..%2fpackage.json', '/PACKAGE.JSON', '/.ENV', '/SERVER.JS'
    ];

    for (const p of encodedOrTraversalPaths) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.strictEqual(res.status, 404, `Expected 404 for encoded/traversal path ${p}, received ${res.status}`);
      const body = await res.text();
      assert.ok(!body.includes('ALGODON Organic'), `Path ${p} must not fall back to storefront HTML`);
    }
  });

  it('serves API status at root instead of a legacy storefront', async () => {
    const resRoot = await fetch(`${baseUrl}/`);
    assert.strictEqual(resRoot.status, 200);
    assert.equal((await resRoot.json()).status, 'API is running');
    assert.strictEqual((await fetch(`${baseUrl}/index.html`)).status, 404);
  });

  it('keeps secure headers on requests for the separately hosted admin panel', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    assert.strictEqual(res.status, 404);
    const csp = res.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
  });

  it('does not expose retired frontend assets through the backend', async () => {
    const staticPaths = [
      '/css/styles.css', '/css/admin.css', '/admin/assets/admin.css',
      '/js/main.js', '/js/admin.js', '/admin/assets/admin.js', '/img/hero.jpg',
      '/src/lib/auth-context.js', '/lib/auth-context.js'
    ];

    for (const p of staticPaths) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.strictEqual(res.status, 404, `Expected 404 for retired frontend asset ${p}, received ${res.status}`);
    }
  });

  it('does not turn frontend navigation into backend HTML responses', async () => {
    const res = await fetch(`${baseUrl}/orders`, { headers: { Accept: 'text/html' } });
    assert.strictEqual(res.status, 404);
  });
});

describe('Task 3: Supabase admin session authentication', () => {
  let requireAdmin;
  let setDb;
  const validAdminUserId = '11111111-2222-3333-4444-555555555555';

  before(async () => {
    const authModule = await import('../backend/src/admin/auth.js');
    const dbModule = await import('../backend/src/config/db.js');
    requireAdmin = authModule.requireAdmin;
    setDb = dbModule.setDb;
  });

  after(() => setDb(null));

  function createMockResponse() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
  }

  it('rejects bearer tokens and requires the Supabase admin session cookie', async () => {
    const req = {
      get: (header) => header.toLowerCase() === 'authorization' ? 'Bearer retired-provider-token' : null,
      cookies: {}
    };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAdmin(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.equal(res.jsonData.error, 'Sign in to continue.');
  });

  it('preserves the Supabase cookie session flow', async () => {
    setDb({
      rpc: async () => ({ data: true, error: null }),
      auth: {
        getUser: async (token) => token === 'valid-supabase-token'
          ? { data: { user: { id: validAdminUserId, email: 'supabase-admin@example.com' } }, error: null }
          : { data: { user: null }, error: new Error('Invalid token') }
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: 'super_admin' }, error: null })
          })
        })
      })
    });

    const req = {
      get: () => null,
      cookies: { algodon_admin_session: 'valid-supabase-token' }
    };
    const res = createMockResponse();
    let nextCalled = false;

    await requireAdmin(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.equal(req.admin.id, validAdminUserId);
    assert.equal(req.admin.role, 'super_admin');
  });
});
