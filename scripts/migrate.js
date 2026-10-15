import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runSql, sqlLiteral } from './lib/postgres.js';

const files = fs.readdirSync('supabase/migrations').filter(name => /^\d+_[a-z0-9_]+\.sql$/i.test(name)).sort();
const baseline = process.argv.find(arg => arg.startsWith('--baseline-through='))?.split('=')[1];
if (baseline && !files.includes(baseline)) throw new Error('Unknown baseline migration.');
let sql = String.raw`begin;
select pg_advisory_xact_lock(735284912) as migration_lock \gset
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now());
`;
if (!baseline) sql += `do $$ begin
  if to_regclass('public.products') is not null and not exists(select 1 from app_private.schema_migrations) then
    raise exception 'Existing database has no migration ledger. Verify applied migrations and explicitly baseline through the last applied file.';
  end if;
end $$;
`;
for (const name of files) {
  const body = fs.readFileSync('supabase/migrations/' + name, 'utf8');
  // Newline-independent checksums work across Windows and Linux checkouts.
  const checksum = createHash('sha256').update(body.replace(/\r\n?/g, '\n')).digest('hex');
  const migrationName = sqlLiteral(name), migrationChecksum = sqlLiteral(checksum);
  sql += String.raw`do $$ begin if exists(select 1 from app_private.schema_migrations where name=${migrationName} and checksum<>${migrationChecksum}) then raise exception 'Applied migration checksum changed: ${name}'; end if; end $$;
select exists(select 1 from app_private.schema_migrations where name=${migrationName}) as already_applied \gset
\if :already_applied
\else
`;
  if (!(baseline && name <= baseline)) sql += body + '\n';
  sql += String.raw`insert into app_private.schema_migrations(name,checksum) values(${migrationName},${migrationChecksum});
\endif
`;
}
sql += "notify pgrst, 'reload schema';\ncommit;";
runSql(sql);
console.log('Database migrations verified and applied.');
if (baseline) console.log('Previously applied migrations recorded through ' + baseline + '.');
