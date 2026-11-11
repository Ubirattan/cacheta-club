-- =====================================================================
-- CACHETA CLUB — nova economia de fichas (R$ 1 = 10 fichas)
-- Rode no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================
-- quem se cadastrar a partir de agora começa com 0 fichas (fichas só comprando com Pix)
alter table public.profiles alter column coins set default 0;
-- sem bônus grátis; entrada máxima das salas de 200 fichas
insert into public.app_settings(key, value) values ('daily_bonus', '0'), ('max_entry', '200')
on conflict (key) do update set value = excluded.value;
