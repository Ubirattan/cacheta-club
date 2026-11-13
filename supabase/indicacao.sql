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
