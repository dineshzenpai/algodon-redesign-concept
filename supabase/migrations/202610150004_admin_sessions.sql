-- Server-side session expiry and logout revocation. Store hashes, never bearer tokens.
create table public.admin_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references public.admin_users(user_id) on delete cascade,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.admin_sessions to service_role;

create function public.admin_session_active(p_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.admin_sessions set last_seen_at = now()
  where token_hash = p_token_hash and expires_at > now()
    and last_seen_at > now() - interval '20 minutes';
  return found;
end;
$$;
revoke all on function public.admin_session_active(text) from public, anon, authenticated;
grant execute on function public.admin_session_active(text) to service_role;
