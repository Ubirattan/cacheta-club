'use client';
// Resgate de fichas: troca fichas por troféus de coleção (enfeite, sem valor em dinheiro)
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell.js';
import { api, sb } from '../../lib/supabase-browser.js';
import { ITEMS } from '../../lib/shop-items.js';
import { fmt } from '../../lib/modes.js';
import { toast } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';

const TROFEUS = ITEMS.filter(i => i.slot === 'trofeu');
function Body({ profile, reloadProfile, user }) {
  const [busy, setBusy] = useState(null), [pend, setPend] = useState([]);
  const loadPend = () => user && sb().from('purchases').select('item').eq('user_id', user.id).eq('status', 'pending').like('item', 'tr-%').then(({ data }) => setPend((data || []).map(x => x.item)));
  useEffect(() => { loadPend(); const t = setInterval(() => { loadPend(); reloadProfile && reloadProfile(); }, 30000); return () => clearInterval(t); }, [user]); // eslint-disable-line
  if (!profile) return <div className="empty">Carregando…</div>;
  const owned = profile.owned || [];
  async function resgatar(t) {
    if (!confirm(`Trocar ${t.price} fichas pelo ${t.name} ${t.em}?`)) return;
    setBusy(t.id);
    try { await api('/api/shop', { op: 'buy', item: t.id }); try { sfx('win'); } catch {} toast(`Pedido enviado! Seu ${t.name} será liberado em alguns minutos`); reloadProfile && reloadProfile(); loadPend(); }
    catch (e) { toast(e.message); }
    setBusy(null);
  }
  const tenho = TROFEUS.filter(t => owned.includes(t.id));
  return <>
    <div className="panel" style={{ marginBottom: 12 }}>
      <p className="hint" style={{ margin: 0 }}>Troque suas fichas por <b>troféus</b>. Seu prêmio será liberado em alguns minutos.</p>
      <p style={{ margin: '8px 0 0' }}>Sua coleção: {tenho.length ? <span style={{ fontSize: 26 }}>{tenho.map(t => t.em).join(' ')}</span> : <i style={{ color: 'var(--mut)' }}>nenhum troféu ainda</i>}</p>
    </div>
    <div className="shopgrid">{TROFEUS.map(t => {
      const has = owned.includes(t.id), wait = pend.includes(t.id), falta = profile.coins < t.price;
      return <div key={t.id} className="item">
        <div className="swatch" style={{ display: 'grid', placeItems: 'center', fontSize: 44, background: 'radial-gradient(circle,#3a2f1d,#120e08)', borderColor: '#f2c94c' }}>{t.em}</div>
        <b>{t.name}</b>
        {has ? <span style={{ color: '#4ade80', font: '600 15px Oswald' }}>✔ Na sua coleção</span>
          : wait ? <span style={{ color: '#fbbf24', font: '600 15px Oswald' }}>⏳ Aguardando liberação</span>
          : <button className="pillbtn" disabled={!!busy || falta} style={{ background: falta ? '' : 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => resgatar(t)}>
              {busy === t.id ? 'Resgatando…' : `💰 ${fmt(t.price)} · Resgatar`}</button>}
        {!has && !wait && falta && <small style={{ color: 'var(--mut)' }}>Faltam {fmt(t.price - profile.coins)} fichas</small>}
      </div>;
    })}</div>
  </>;
}
export default function Resgate() { return <Shell title="🎁 Resgatar fichas">{auth => <Body {...auth} />}</Shell>; }
