-- Fichas com centavos (o Foguetinho paga 1 × 1,57 = 1,57 fichas)
alter table public.profiles alter column coins type numeric(14,2);
drop function if exists public.adjust_profile(uuid,int,int,int);
drop function if exists public.adjust_profile(uuid,int,int,int,int);
create or replace function public.adjust_profile(p_uid uuid, p_coins numeric, p_games int, p_wins int, p_points int default 0)
returns numeric language sql security definer set search_path = public as $$
  update public.profiles
     set coins = coins + p_coins, games = games + p_games, wins = wins + p_wins, rank_points = rank_points + p_points
   where id = p_uid and coins + p_coins >= 0
  returning coins;
$$;
revoke execute on function public.adjust_profile(uuid,numeric,int,int,int) from public, anon, authenticated;
alter table if exists public.foguete_apostas alter column ganho type numeric(12,2);
