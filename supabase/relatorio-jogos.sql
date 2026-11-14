-- RELATÓRIO DE JOGOS (painel admin): quantas partidas/apostas cada jogo teve, jogadores, fichas apostadas e pagas.
-- Rode uma vez no SQL Editor do Supabase.

-- jogos que não tinham histórico próprio (roleta, Onça, partidas contra o computador)
create table if not exists public.jogadas (
  id         bigserial primary key,
  jogo       text not null,
  user_id    uuid references public.profiles(id) on delete set null,
  aposta     numeric(12,2) not null default 0,
  ganho      numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists jogadas_created_idx on public.jogadas (created_at);
alter table public.jogadas enable row level security;

-- soma por jogo desde uma data (o servidor chama; online vem pelo modo da mesa)
create or replace function public.relatorio_jogos(desde timestamptz)
returns table (jogo text, partidas bigint, jogadores bigint, apostado numeric, pago numeric)
language sql stable security definer set search_path = public as $$
  select jogo, count(*), count(distinct user_id), coalesce(sum(aposta), 0)::numeric, coalesce(sum(ganho), 0)::numeric from (
    select j.jogo, j.user_id, j.aposta, j.ganho from jogadas j where j.created_at >= desde
    union all select 'foguete', user_id, valor, ganho from foguete_apostas where created_at >= desde and status <> 'cancelada'
    union all select 'double', user_id, valor, ganho from double_apostas where created_at >= desde
    union all select 'mines', user_id, valor, ganho from mines_partidas where created_at >= desde
    union all select 'futebol', user_id, valor, ganho from futebol_apostas where created_at >= desde and status not in ('recusada')
    union all select 'gude-pc', user_id, 1, 0 from gude_partidas where created_at >= desde
  ) x group by jogo
  union all
  -- mesas online: uma partida por jogo da mesa; apostado = o que os perdedores pagaram, pago = o que os ganhadores levaram
  select 'online:' || h.mode, count(distinct h.id)::bigint, count(distinct p.user_id)::bigint,
         coalesce(sum(greatest(-p.coins_delta, 0)), 0)::numeric, coalesce(sum(greatest(p.coins_delta, 0)), 0)::numeric
  from match_history h left join match_players p on p.match_id = h.id
  where h.created_at >= desde group by h.mode;
$$;
revoke all on function public.relatorio_jogos(timestamptz) from public, anon, authenticated;
