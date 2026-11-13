-- Futebol: mais palpites (escanteios, cartões, 1º tempo, quem marca primeiro, handicap e placar exato).
alter table public.futebol_jogos add column if not exists escanteios integer;
alter table public.futebol_jogos add column if not exists cartoes integer;
alter table public.futebol_jogos add column if not exists ht_casa integer;
alter table public.futebol_jogos add column if not exists ht_fora integer;
alter table public.futebol_jogos add column if not exists primeiro text;
