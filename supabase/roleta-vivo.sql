-- ROLETA AO VIVO: rodadas (todo mundo na mesma) e apostas de cada jogador. Só o servidor lê e grava.
create table if not exists public.roleta_vivo_rodadas (
  id         bigserial primary key,
  num        bigint not null unique,
  resultado  smallint not null check (resultado between 0 and 36),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  status     text not null default 'aberta' check (status in ('aberta','fechada')),
  created_at timestamptz not null default now()
);
create index if not exists roleta_vivo_rodadas_status on public.roleta_vivo_rodadas (status);
create table if not exists public.roleta_vivo_apostas (
  id         bigserial primary key,
  rodada     bigint not null references public.roleta_vivo_rodadas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  apostas    jsonb not null,
  valor      integer not null check (valor > 0),
  status     text not null default 'aberta' check (status in ('aberta','ganhou','perdeu')),
  ganho      numeric(12,2) not null default 0,
  nick       text,
  avatar     text,
  created_at timestamptz not null default now(),
  unique (rodada, user_id)
);
create index if not exists roleta_vivo_apostas_rodada on public.roleta_vivo_apostas (rodada, status);
alter table public.roleta_vivo_rodadas enable row level security;
alter table public.roleta_vivo_apostas enable row level security;
revoke all on public.roleta_vivo_rodadas, public.roleta_vivo_apostas from authenticated, anon;
