-- JOGO RESPONSÁVEL: limites e autoexclusão de cada cliente.
-- Rode uma vez no SQL Editor do Supabase. Só o servidor lê e grava (sem acesso pelo navegador).
create table if not exists public.jogo_responsavel (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  dados      jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now()
);
alter table public.jogo_responsavel enable row level security;
