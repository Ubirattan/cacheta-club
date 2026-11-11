-- =====================================================================
-- CACHETA CLUB — pagamento de pacotes de fichas virtuais (Mercado Pago)
-- Rode DEPOIS do etapa3.sql. Pode rodar mais de uma vez.
-- =====================================================================
alter table public.purchases add column if not exists coins         integer not null default 0;
alter table public.purchases add column if not exists mp_preference text;
alter table public.purchases add column if not exists mp_payment_id text;
alter table public.purchases add column if not exists paid_at       timestamptz;
create unique index if not exists purchases_mp_payment on public.purchases(mp_payment_id) where mp_payment_id is not null;
create index if not exists purchases_user on public.purchases(user_id, created_at desc);
