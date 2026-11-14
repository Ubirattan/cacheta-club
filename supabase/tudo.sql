-- =====================================================================
-- CACHETA CLUB — BANCO COMPLETO (schema + etapa 3 + pagamento) num arquivo só.
-- Supabase > SQL Editor > New query > cole TUDO > Run.
-- =====================================================================
-- =====================================================================
-- CACHETA CLUB — banco de dados (Supabase / Postgres)
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- PERFIS ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null default 'Jogador',
  avatar      text not null default '😎',
  coins       integer not null default 0 check (coins >= 0),   -- fichas virtuais, sem valor em dinheiro
  games       integer not null default 0,
  wins        integer not null default 0,
  blocked     boolean not null default false,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- cria o perfil automaticamente quando alguém se cadastra (e-mail ou Google)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'nickname',
                                new.raw_user_meta_data->>'name',
                                split_part(new.email,'@',1), 'Jogador'), 16))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ajuste atômico de fichas e estatísticas (só o servidor chama)
create or replace function public.adjust_profile(p_uid uuid, p_coins int, p_games int, p_wins int)
returns integer language sql security definer set search_path = public as $$
  update public.profiles
     set coins = coins + p_coins, games = games + p_games, wins = wins + p_wins
   where id = p_uid and coins + p_coins >= 0
  returning coins;
$$;
revoke execute on function public.adjust_profile(uuid,int,int,int) from public, anon, authenticated;

-- ---------- SALAS ----------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  mode          text not null,                       -- cacheta | dez | pifpaf
  max_players   integer not null check (max_players between 2 and 9),
  points        integer not null default 5,
  entry         integer not null default 0 check (entry >= 0),
  turn_seconds  integer not null default 30,
  is_private    boolean not null default false,
  status        text not null default 'waiting',     -- waiting | playing
  host          uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- senha das salas privadas: ninguém lê pelo app, só o servidor
create table if not exists public.room_secrets (
  room_id   uuid primary key references public.rooms(id) on delete cascade,
  pass_hash text not null
);

create table if not exists public.room_players (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  seat      integer not null,
  ready     boolean not null default false,
  nickname  text not null,
  avatar    text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);
create index if not exists room_players_user on public.room_players(user_id);

-- ---------- PARTIDA ----------
-- estado COMPLETO (baralho, mãos de todos): só o servidor acessa
create table if not exists public.game_secrets (
  room_id  uuid primary key references public.rooms(id) on delete cascade,
  version  integer not null default 1,
  state    jsonb not null
);
-- estado PÚBLICO da mesa (o que todo mundo pode ver)
create table if not exists public.games (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  version    integer not null,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);
-- a mão de cada jogador: cada um só enxerga a própria
create table if not exists public.hands (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cards   jsonb not null,
  primary key (room_id, user_id)
);

-- ---------- CHAT ----------
create table if not exists public.messages (
  id         bigserial primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nickname   text not null,
  text       text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists messages_room on public.messages(room_id, id);

-- ---------- SEGURANÇA (RLS) ----------
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_secrets enable row level security;
alter table public.room_players enable row level security;
alter table public.game_secrets enable row level security;
alter table public.games        enable row level security;
alter table public.hands        enable row level security;
alter table public.messages     enable row level security;

create or replace function public.is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid());
$$;

drop policy if exists "perfis visíveis" on public.profiles;
create policy "perfis visíveis" on public.profiles for select to authenticated using (true);
drop policy if exists "edita o próprio perfil" on public.profiles;
create policy "edita o próprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- o jogador só pode mudar apelido e avatar (fichas e estatísticas só pelo servidor)
revoke update on public.profiles from authenticated, anon;
grant update (nickname, avatar) on public.profiles to authenticated;

drop policy if exists "salas visíveis" on public.rooms;
create policy "salas visíveis" on public.rooms for select to authenticated using (true);
drop policy if exists "jogadores visíveis" on public.room_players;
create policy "jogadores visíveis" on public.room_players for select to authenticated using (true);
drop policy if exists "mesa visível aos membros" on public.games;
create policy "mesa visível aos membros" on public.games for select to authenticated using (public.is_member(room_id));
drop policy if exists "só a própria mão" on public.hands;
create policy "só a própria mão" on public.hands for select to authenticated using (user_id = auth.uid());
drop policy if exists "chat: ler" on public.messages;
create policy "chat: ler" on public.messages for select to authenticated using (public.is_member(room_id));
drop policy if exists "chat: escrever" on public.messages;
create policy "chat: escrever" on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(room_id));
-- room_secrets e game_secrets: sem nenhuma policy = ninguém acessa pelo app

-- ---------- TEMPO REAL ----------
alter table public.room_players replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.rooms;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.room_players; exception when others then null; end;
  begin alter publication supabase_realtime add table public.games;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.hands;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages;     exception when others then null; end;
end $$;

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
  ('daily_bonus', '0'),
  ('ads_enabled', 'false'),
  ('modes_enabled', '["cacheta","dez","pifpaf"]'),
  ('max_entry', '200'),
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

-- =====================================================================
-- CACHETA CLUB — pagamento de pacotes de fichas virtuais (Mercado Pago)
-- Rode DEPOIS do etapa3.sql. Pode rodar mais de uma vez.
-- =====================================================================
alter table public.purchases add column if not exists coins         integer not null default 0;
alter table public.purchases add column if not exists mp_preference text;
alter table public.purchases add column if not exists mp_payment_id text;
alter table public.purchases add column if not exists paid_at       timestamptz;
create unique index if not exists purchases_mp_payment on public.purchases(mp_payment_id) where mp_payment_id is not null;
create index if not exists purchases_user on public.purchases(user_id, created_at desc);

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
-- =====================================================================
-- CACHETA CLUB — avatares especiais só para quem comprou
-- Rode no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================
create or replace function public.protege_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare item text;
begin
  -- o servidor (chave de serviço) pode tudo; o app do jogador só troca para avatar que tem
  if new.avatar is distinct from old.avatar and coalesce(auth.role(), '') <> 'service_role' then
    item := case new.avatar
      when '🔥' then 'av-fogo'      when '🐉' then 'av-dragao'   when '🦄' then 'av-unicornio'
      when '🦈' then 'av-tubarao'   when '🤴' then 'av-rei'      when '👸' then 'av-rainha'
      when '💎' then 'av-diamante'  when '🌟' then 'av-estrela'
      else null end;
    if item is not null and not (coalesce(new.owned, '[]'::jsonb) ? item) then
      raise exception 'Avatar especial: compre na Loja para usar';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protege_avatar on public.profiles;
create trigger protege_avatar before update on public.profiles
  for each row execute function public.protege_avatar();

-- Chave Pix do jogador (fica fora de "profiles", que todo mundo logado consegue ler)
create table if not exists public.user_private (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  pix_tipo   text check (pix_tipo in ('cpf','email','celular')),
  pix_chave  text,
  updated_at timestamptz not null default now()
);
alter table public.user_private enable row level security;
drop policy if exists "vê a própria chave" on public.user_private;
create policy "vê a própria chave" on public.user_private for select to authenticated using (user_id = auth.uid());
-- gravação só pelo servidor (cadastro e perfil), que confere se a chave é válida
revoke insert, update, delete on public.user_private from authenticated, anon;

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

-- Indique um amigo: quem indicou ganha 10 fichas quando o amigo faz o primeiro depósito de R$ 10 ou mais
create table if not exists public.indicacoes (
  indicado   uuid primary key references public.profiles(id) on delete cascade,
  indicador  uuid not null references public.profiles(id) on delete cascade,
  pago       boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);
create index if not exists indicacoes_indicador on public.indicacoes (indicador);
alter table public.indicacoes enable row level security;
drop policy if exists "vê as próprias indicações" on public.indicacoes;
create policy "vê as próprias indicações" on public.indicacoes for select to authenticated using (indicador = auth.uid());
-- gravação só pelo servidor
revoke insert, update, delete on public.indicacoes from authenticated, anon;

-- Foguetinho (jogo ao vivo): rodadas e apostas. Só o servidor lê e grava (o celular pergunta pela API).
create table if not exists public.foguete_rodadas (
  id         bigserial primary key,
  num        bigint not null unique,
  crash      numeric(8,2) not null,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  status     text not null default 'aberta' check (status in ('aberta','fechada')),
  created_at timestamptz not null default now()
);
create index if not exists foguete_rodadas_status on public.foguete_rodadas (status);
create table if not exists public.foguete_apostas (
  id         bigserial primary key,
  rodada     bigint not null references public.foguete_rodadas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  slot       smallint not null check (slot in (1,2)),
  valor      integer not null check (valor > 0),
  auto       numeric(8,2),
  status     text not null default 'aberta' check (status in ('aberta','sacou','perdeu','cancelada')),
  mult       numeric(8,2),
  ganho      integer not null default 0,
  nick       text,
  avatar     text,
  created_at timestamptz not null default now(),
  unique (rodada, user_id, slot)
);
create index if not exists foguete_apostas_rodada on public.foguete_apostas (rodada, status);
alter table public.foguete_rodadas enable row level security;
alter table public.foguete_apostas enable row level security;
revoke all on public.foguete_rodadas, public.foguete_apostas from authenticated, anon;

-- Fichas com centavos (o Foguetinho paga 1 × 1,57 = 1,57 fichas)
alter table public.profiles alter column coins type numeric(14,2);
drop function if exists public.adjust_profile(uuid,int,int,int);
drop function if exists public.adjust_profile(uuid,int,int,int,int);
create or replace function public.adjust_profile(p_uid uuid, p_coins numeric, p_games int, p_wins int, p_points int default 0)
returns numeric language sql security definer set search_path = public as $$
  update public.profiles
     set coins = coins + p_coins, games = games + p_games, wins = wins + p_wins, rank_points = rank_points + p_points
   where id = p_uid and coins + p_coins >= 0
  returning coins;
$$;
revoke execute on function public.adjust_profile(uuid,numeric,int,int,int) from public, anon, authenticated;
alter table if exists public.foguete_apostas alter column ganho type numeric(12,2);

-- ===== mines-double.sql =====
-- Mines e Double (cassino). Só o servidor lê e grava (o celular pergunta pela API).
create table if not exists public.mines_partidas (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  valor      integer not null check (valor > 0),
  bombas     smallint not null check (bombas between 1 and 24),
  minas      jsonb not null,
  abertas    jsonb not null default '[]'::jsonb,
  bomba      smallint,
  passo      integer not null default 0,
  status     text not null default 'jogando' check (status in ('jogando','sacou','perdeu')),
  ganho      numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
-- uma partida aberta por jogador
create unique index if not exists mines_uma_aberta on public.mines_partidas (user_id) where status = 'jogando';
create index if not exists mines_user on public.mines_partidas (user_id, id desc);

create table if not exists public.double_rodadas (
  id         bigserial primary key,
  num        bigint not null unique,
  resultado  smallint not null check (resultado between 0 and 14),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  status     text not null default 'aberta' check (status in ('aberta','fechada')),
  created_at timestamptz not null default now()
);
create index if not exists double_rodadas_status on public.double_rodadas (status);
create table if not exists public.double_apostas (
  id         bigserial primary key,
  rodada     bigint not null references public.double_rodadas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  cor        text not null check (cor in ('vermelho','branco','preto')),
  valor      integer not null check (valor > 0),
  status     text not null default 'aberta' check (status in ('aberta','ganhou','perdeu')),
  ganho      numeric(12,2) not null default 0,
  nick       text,
  avatar     text,
  created_at timestamptz not null default now(),
  unique (rodada, user_id, cor)
);
create index if not exists double_apostas_rodada on public.double_apostas (rodada, status);

alter table public.mines_partidas enable row level security;
alter table public.double_rodadas enable row level security;
alter table public.double_apostas enable row level security;
revoke all on public.mines_partidas, public.double_rodadas, public.double_apostas from authenticated, anon;
