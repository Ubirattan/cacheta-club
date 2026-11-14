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
