-- Apostas de futebol: jogos e odds (vindos da API-Football), bilhetes dos jogadores e o controle
-- das chamadas à API. Só o servidor lê e grava (o celular pergunta pela rota /api/futebol).
create table if not exists public.futebol_jogos (
  id           bigint primary key,            -- id do jogo na API-Football
  liga         integer not null,
  liga_nome    text,
  liga_logo    text,
  casa         text not null,
  fora         text not null,
  casa_logo    text,
  fora_logo    text,
  inicio       timestamptz not null,
  status       text not null default 'NS',
  gols_casa    integer,                       -- placar do tempo normal
  gols_fora    integer,
  ao_vivo_casa integer,
  ao_vivo_fora integer,
  minuto       integer,
  escanteios   integer,
  cartoes      integer,
  ht_casa      integer,
  ht_fora      integer,
  primeiro     text,
  odds         jsonb,
  odds_em      bigint,
  atualizado   timestamptz not null default now()
);
create index if not exists futebol_jogos_status on public.futebol_jogos (status, inicio);

create table if not exists public.futebol_apostas (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  valor        integer not null check (valor between 5 and 1000),
  odd          numeric(12,2) not null,
  premio       numeric(12,2) not null,
  selecoes     jsonb not null,
  status       text not null default 'aberta' check (status in ('aberta','ganhou','perdeu','devolvida','cashout')),
  ganho        numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  liquidada_em timestamptz
);
create index if not exists futebol_apostas_user on public.futebol_apostas (user_id, id desc);
create index if not exists futebol_apostas_status on public.futebol_apostas (status);

create table if not exists public.futebol_sync (
  chave text primary key,
  v     integer not null default 0,
  em    bigint not null default 0,
  valor jsonb
);

alter table public.futebol_jogos enable row level security;
alter table public.futebol_apostas enable row level security;
alter table public.futebol_sync enable row level security;
revoke all on public.futebol_jogos, public.futebol_apostas, public.futebol_sync from authenticated, anon;
