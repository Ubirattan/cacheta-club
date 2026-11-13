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
