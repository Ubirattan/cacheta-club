'use client';
// Sessão do usuário + perfil (apelido, avatar, fichas), atualizado em tempo real.
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../lib/supabase-browser.js';

// Endereço do login/cadastro voltando pra página atual depois. modo: 'entrar' | 'criar'
export function contaUrl(modo = 'entrar') {
  let next = '/';
  try { next = location.pathname + location.search; } catch {}
  return '/login?modo=' + modo + (next && next !== '/' ? '&next=' + encodeURIComponent(next) : '');
}

// required: true → sem conta vai pro login (salas, histórico, admin…).
// required: false → visitante pode olhar a página; jogar/apostar/comprar pede a conta.
export function useAuth({ required = true } = {}) {
  const router = useRouter();
  const routerRef = useRef(router); routerRef.current = router;
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid) => {
    const { data } = await sb().from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    let ch = null, alive = true;
    sb().auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = data.session; setSession(s); setLoading(false); if (!s) setProfile(null);
      if (!s) { if (required) routerRef.current.replace('/login?next=' + encodeURIComponent(location.pathname)); return; }
      loadProfile(s.user.id);
      ch = sb().channel('me-' + s.user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${s.user.id}` }, () => loadProfile(s.user.id))
        .subscribe();
    });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => { setSession(s); if (!s && required) routerRef.current.replace('/login'); });
    return () => { alive = false; sub.subscription.unsubscribe(); if (ch) sb().removeChannel(ch); };
  }, [required, loadProfile]);

  return { session, user: session?.user || null, profile, loading, visitante: !loading && !session, reloadProfile: () => session && loadProfile(session.user.id) };
}

// quem está online (Supabase Presence)
export function useOnline(user, profile, where) {
  const [online, setOnline] = useState([]);
  useEffect(() => {
    if (!user || !profile) return;
    const ch = sb().channel('online', { config: { presence: { key: user.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      setOnline(Object.values(st).map(v => v[0]).filter(Boolean));
    }).subscribe(async status => {
      if (status === 'SUBSCRIBED') await ch.track({ uid: user.id, nick: profile.nickname, avatar: profile.avatar, where });
    });
    return () => { sb().removeChannel(ch); };
  }, [user, profile, where]);
  return online;
}
