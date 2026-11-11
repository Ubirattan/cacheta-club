-- =====================================================================
-- CACHETA CLUB — nova economia de fichas (R$ 1 = 10 fichas)
-- Rode no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================
-- quem se cadastrar a partir de agora começa com 100 fichas
alter table public.profiles alter column coins set default 100;
-- bônus diário de 20 fichas e entrada máxima das salas de 200 fichas
insert into public.app_settings(key, value) values ('daily_bonus', '20'), ('max_entry', '200')
on conflict (key) do update set value = excluded.value;
