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
