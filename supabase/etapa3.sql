-- =====================================================================
-- CACHETA CLUB — etapa 3: histórico, ranking, torneios, loja/VIP, admin
-- Rode DEPOIS do schema.sql (SQL Editor > New query > colar > Run).
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------- perfil: ranking, VIP, visual, bônus ----------
alter table public.profiles add column if not exists rank_points integer not null default 0;
alter table public.profiles add column if not exists vip_until   timestamptz;
alter table public.profiles add column if not exists owned       jsonb not null default '[]'::jsonb;   -- itens comprados
alter table public.profiles add column if not exists equipped    jsonb not null default '{}'::jsonb;   -- {"back":"...","felt":"..."}
alter table public.profiles add column if not exists last_bonus  timestamptz;
create index if not exists profiles_rank on public.profiles(rank_points desc, wins desc);

-- ajuste atômico agora também soma pontos de ranking
drop function if exists public.adjust_profile(uuid,int,int,int);
create or replace function public.adjust_profile(p_uid uuid, p_coins int, p_games int, p_wins int, p_points int default 0)
returns integer language sql security definer set search_path = public as $$
  update public.profiles
     set coins = coins + p_coins, games = games + p_games, wins = wins + p_wins, rank_points = rank_points + p_points
   where id = p_uid and coins + p_coins >= 0
  returning coins;
$$;
revoke execute on function public.adjust_profile(uuid,int,int,int,int) from public, anon, authenticated;

-- ---------- salas: torneio e VIP ----------
alter table public.rooms add column if not exists tournament_id uuid;
alter table public.rooms add column if not exists vip_only boolean not null default false;

-- ---------- histórico de partidas ----------
create table if not exists public.match_history (
  id            bigserial primary key,
  room_name     text not null,
  mode          text not null,
  tournament_id uuid,
  players       jsonb not null,          -- [{uid,name,avatar}]
  winner        uuid,
  winner_name   text,
  pot           integer not null default 0,
  rounds        integer not null default 1,
  created_at    timestamptz not null default now()
);
create table if not exists public.match_players (
  match_id    bigint not null references public.match_history(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  won         boolean not null default false,
  coins_delta integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists match_players_user on public.match_players(user_id, created_at desc);

-- ---------- torneios ----------
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mode        text not null default 'cacheta',
  table_size  integer not null default 4 check (table_size between 2 and 9),
  points      integer not null default 3,
  entry       integer not null default 0,
  prize       integer not null default 0,      -- fichas extras da casa, além das entradas
  max_players integer not null default 36,
  turn_seconds integer not null default 30,
  status      text not null default 'open',    -- open | running | finished | canceled
  round       integer not null default 0,
  starts_at   timestamptz,
  champion    uuid,
  champion_name text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create table if not exists public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nickname      text not null,
  avatar        text not null,
  status        text not null default 'in',     -- in | out | champion
  round_reached integer not null default 0,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create table if not exists public.tournament_tables (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round         integer not null,
  room_id       uuid not null,
  players       jsonb not null,                 -- [{uid,name,avatar}]
  winner        uuid,
  winner_name   text,
  done          boolean not null default false,
  primary key (tournament_id, room_id)
);

-- ---------- configurações (o painel admin edita) ----------
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings(key, value) values
  ('daily_bonus', '300'),
  ('ads_enabled', 'false'),
  ('modes_enabled', '["cacheta","dez","pifpaf"]'),
  ('max_entry', '2000'),
  ('motd', '"Bem-vindo ao Cacheta Club!"')
on conflict (key) do nothing;

-- ---------- compras (preparado para pagamento futuro de fichas virtuais) ----------
create table if not exists public.purchases (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item       text not null,
  price_coins integer not null default 0,
  price_brl  numeric(10,2),
  status     text not null default 'done',      -- done | pending | refunded
  created_at timestamptz not null default now()
);

-- ---------- segurança ----------
alter table public.match_history      enable row level security;
alter table public.match_players      enable row level security;
alter table public.tournaments        enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_tables  enable row level security;
alter table public.app_settings       enable row level security;
alter table public.purchases          enable row level security;

drop policy if exists "historico visivel" on public.match_history;
create policy "historico visivel" on public.match_history for select to authenticated using (true);
drop policy if exists "historico jogadores" on public.match_players;
create policy "historico jogadores" on public.match_players for select to authenticated using (true);
drop policy if exists "torneios visiveis" on public.tournaments;
create policy "torneios visiveis" on public.tournaments for select to authenticated using (true);
drop policy if exists "inscritos visiveis" on public.tournament_players;
create policy "inscritos visiveis" on public.tournament_players for select to authenticated using (true);
drop policy if exists "mesas do torneio visiveis" on public.tournament_tables;
create policy "mesas do torneio visiveis" on public.tournament_tables for select to authenticated using (true);
drop policy if exists "config visivel" on public.app_settings;
create policy "config visivel" on public.app_settings for select to authenticated using (true);
drop policy if exists "minhas compras" on public.purchases;
create policy "minhas compras" on public.purchases for select to authenticated using (user_id = auth.uid());

do $$ begin
  begin alter publication supabase_realtime add table public.tournaments;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.tournament_players; exception when others then null; end;
  begin alter publication supabase_realtime add table public.tournament_tables;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles;           exception when others then null; end;
end $$;

-- ---------- virar administrador ----------
-- Troque o e-mail abaixo pelo SEU e rode esta linha (só uma vez):
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'seu@email.com');
