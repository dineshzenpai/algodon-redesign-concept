create table public.customer_revoked_tokens (
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.customer_revoked_tokens enable row level security;
revoke all on public.customer_revoked_tokens from public, anon, authenticated;
grant select, insert, delete on public.customer_revoked_tokens to service_role;
create index customer_revoked_tokens_expiry_idx on public.customer_revoked_tokens(expires_at);
