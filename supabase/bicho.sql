-- JOGO DO BICHO: sorteios em horários fixos (11h, 14h, 16h, 18h, 21h) e as apostas. Só o servidor lê e grava.
create table if not exists public.bicho_sorteios (
  id         bigserial primary key,
  chave      text not null unique,            -- ex.: '2026-11-14 14h'
  hora_at    timestamptz not null,
  premios    jsonb,                           -- 5 milhares, só depois da hora do sorteio
  status     text not null default 'aberta' check (status in ('aberta','fechada')),
  created_at timestamptz not null default now()
);
create index if not exists bicho_sorteios_status on public.bicho_sorteios (status, hora_at);
create table if not exists public.bicho_apostas (
  id         bigserial primary key,
  sorteio    bigint not null references public.bicho_sorteios(id) on delete cascade,
  hora_at    timestamptz,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tipo       text not null check (tipo in ('grupo','dezena','centena','milhar')),
  palpite    text not null,
  pos        text not null check (pos in ('cabeca','todos')),
  valor      integer not null check (valor > 0),
  status     text not null default 'aberta' check (status in ('aberta','ganhou','perdeu')),
  ganho      numeric(12,2) not null default 0,
  nick       text,
  avatar     text,
  created_at timestamptz not null default now()
);
create index if not exists bicho_apostas_sorteio on public.bicho_apostas (sorteio, status);
create index if not exists bicho_apostas_user on public.bicho_apostas (user_id, created_at desc);
alter table public.bicho_sorteios enable row level security;
alter table public.bicho_apostas enable row level security;
revoke all on public.bicho_sorteios, public.bicho_apostas from authenticated, anon;
