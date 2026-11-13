-- Futebol: escanteios e cartões (total do jogo, vindo das estatísticas da API).
alter table public.futebol_jogos add column if not exists escanteios integer;
alter table public.futebol_jogos add column if not exists cartoes integer;
