-- =====================================================================
-- BOLINHA DE GUDE contra o computador (valendo ficha)
-- Cole no SQL Editor do Supabase e clique em "Run" (pode rodar mais de uma vez).
-- Cada partida fica guardada aqui e toda tecada é conferida pelo servidor.
-- =====================================================================
create table if not exists public.gude_partidas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mode        text not null default 'triangulo',
  level       text not null default 'medio',
  state       jsonb not null,
  version     integer not null default 1,
  status      text not null default 'playing',   -- playing | done | abandoned
  created_at  timestamptz not null default now()
);
create index if not exists gude_partidas_user on public.gude_partidas(user_id, status);
-- sem nenhuma policy: só o servidor (chave service_role) lê e grava
alter table public.gude_partidas enable row level security;
