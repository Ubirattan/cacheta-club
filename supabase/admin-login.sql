-- CACHETA CLUB — login e senha do painel administrativo
-- Rode no Supabase: SQL Editor > New query > colar > Run
-- ---------- login e senha do painel administrativo ----------
create table if not exists public.admin_auth (
  id           integer primary key default 1 check (id = 1),
  username     text not null,
  pass_hash    text not null,
  fails        integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.admin_auth enable row level security;   -- sem policy: só o servidor acessa
