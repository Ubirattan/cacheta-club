-- Chave Pix do jogador (fica fora de "profiles", que todo mundo logado consegue ler)
create table if not exists public.user_private (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  pix_tipo   text check (pix_tipo in ('cpf','email','celular')),
  pix_chave  text,
  updated_at timestamptz not null default now()
);
alter table public.user_private enable row level security;
drop policy if exists "vê a própria chave" on public.user_private;
create policy "vê a própria chave" on public.user_private for select to authenticated using (user_id = auth.uid());
-- gravação só pelo servidor (cadastro e perfil), que confere se a chave é válida
revoke insert, update, delete on public.user_private from authenticated, anon;
