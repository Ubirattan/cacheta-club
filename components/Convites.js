'use client';
// Convites em tempo real: quem está numa sala chama amigos online (um a um ou todos de uma vez).
// Usa o "broadcast" do Supabase Realtime: nada fica gravado no banco.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../lib/supabase-browser.js';

let chan = null, meId = null;
const sentAt = new Map(); // limite: o mesmo convite no máximo a cada 30 s

// payload: { to: uid | 'all', roomId, roomName, entry, isPrivate, fromNick, fromAvatar }
export function sendInvite(payload) {
  if (!chan) return 'O convite ainda está conectando, tente de novo em instantes';
  const key = payload.to + ':' + payload.roomId, now = Date.now();
  if (now - (sentAt.get(key) || 0) < 30000) return 'Você já convidou há pouco. Espere alguns segundos';
  sentAt.set(key, now);
  chan.send({ type: 'broadcast', event: 'convite', payload: { ...payload, from: meId, at: now } });
  return null;
}

export default function Convites() {
  const router = useRouter();
  const [inv, setInv] = useState(null);
  useEffect(() => {
    let ch = null, alive = true;
    const start = uid => {
      if (ch || !uid) return;
      meId = uid;
      ch = sb().channel('convites', { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'convite' }, ({ payload: p }) => {
        if (!p || p.from === uid || (p.to !== 'all' && p.to !== uid)) return;
        if (location.pathname.startsWith('/sala/')) return; // já está numa mesa: não atrapalha
        setInv(p);
      }).subscribe(st => { if (st === 'SUBSCRIBED') chan = ch; });
    };
    sb().auth.getSession().then(({ data }) => { if (alive && data.session) start(data.session.user.id); });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => { if (s) start(s.user.id); });
    return () => { alive = false; sub.subscription.unsubscribe(); if (ch) sb().removeChannel(ch); chan = null; };
  }, []);
  useEffect(() => { if (!inv) return; const t = setTimeout(() => setInv(null), 25000); return () => clearTimeout(t); }, [inv]);
  if (!inv) return null;
  return (
    <div className="convite">
      <span className="cav">{inv.fromAvatar || '🃏'}</span>
      <div className="ctx"><b>{inv.fromNick}</b> te chamou pra jogar<small>{inv.roomName} · entrada 💰 {Number(inv.entry || 0).toLocaleString('pt-BR')}{inv.isPrivate ? ' · peça a senha' : ''}</small></div>
      <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }} onClick={() => { setInv(null); router.push('/sala/' + inv.roomId); }}>Entrar</button>
      <button className="pillbtn dark" onClick={() => setInv(null)}>Agora não</button>
    </div>
  );
}
