-- Futebol: apostas com o jogo rolando (odds ao vivo, espera de confirmação e aposta recusada).
alter table public.futebol_jogos add column if not exists odds_vivo jsonb;
alter table public.futebol_jogos add column if not exists odds_vivo_em bigint;
alter table public.futebol_jogos add column if not exists travado boolean not null default false;
alter table public.futebol_apostas add column if not exists vivo boolean not null default false;
alter table public.futebol_apostas add column if not exists motivo text;
alter table public.futebol_apostas drop constraint if exists futebol_apostas_status_check;
alter table public.futebol_apostas add constraint futebol_apostas_status_check
  check (status in ('aberta','ganhou','perdeu','devolvida','cashout','pendente','recusada'));
