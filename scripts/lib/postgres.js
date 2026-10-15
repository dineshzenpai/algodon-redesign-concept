import { execFileSync } from 'node:child_process';
import { env } from '../../backend/src/config/env.js';

export const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
export function runSql(sql) {
  if (!env.supabase.dbUrl) throw new Error('DATABASE_URL is required for database administration.');
  const url = new URL(env.supabase.dbUrl);
  const executable = process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/psql.exe' : 'psql');
  return execFileSync(executable, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    input: sql, encoding: 'utf8', windowsHide: true, timeout: 60000,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG'))),
      PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15' }
  }).trim();
}
