-- =====================================================================
-- CACHETA CLUB — avatares especiais só para quem comprou
-- Rode no Supabase: SQL Editor > New query > colar > Run
-- =====================================================================
create or replace function public.protege_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare item text;
begin
  -- o servidor (chave de serviço) pode tudo; o app do jogador só troca para avatar que tem
  if new.avatar is distinct from old.avatar and coalesce(auth.role(), '') <> 'service_role' then
    item := case new.avatar
      when '🔥' then 'av-fogo'      when '🐉' then 'av-dragao'   when '🦄' then 'av-unicornio'
      when '🦈' then 'av-tubarao'   when '🤴' then 'av-rei'      when '👸' then 'av-rainha'
      when '💎' then 'av-diamante'  when '🌟' then 'av-estrela'
      else null end;
    if item is not null and not (coalesce(new.owned, '[]'::jsonb) ? item) then
      raise exception 'Avatar especial: compre na Loja para usar';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protege_avatar on public.profiles;
create trigger protege_avatar before update on public.profiles
  for each row execute function public.protege_avatar();
