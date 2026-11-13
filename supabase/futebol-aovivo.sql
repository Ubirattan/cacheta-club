-- Futebol ao vivo (plano Pro da API): minuto do jogo e aposta encerrada por cash out.
alter table public.futebol_jogos add column if not exists minuto integer;
alter table public.futebol_apostas drop constraint if exists futebol_apostas_status_check;
alter table public.futebol_apostas add constraint futebol_apostas_status_check
  check (status in ('aberta','ganhou','perdeu','devolvida','cashout'));
