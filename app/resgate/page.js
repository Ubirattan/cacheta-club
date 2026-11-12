'use client';
// Resgate de fichas: troca fichas por troféus de coleção (enfeite, sem valor em dinheiro)
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell.js';
import { api, sb } from '../../lib/supabase-browser.js';
import { ITEMS } from '../../lib/shop-items.js';
import { fmt } from '../../lib/modes.js';
import { toast } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';
import AdSlot from '../../components/AdSlot.js';

const TROFEUS = ITEMS.filter(i => i.slot === 'trofeu');
function Body({ profile, reloadProfile, user }) {
  const [busy, setBusy] = useState(null), [rows, setRows] = useState([]);
  // troféus acumulam: conta quantos de cada já foram liberados e quantos aguardam
  const loadPend = () => user && sb().from('purchases').select('item,status').eq('user_id', user.id).in('status', ['pending', 'done']).like('item', 'tr-%').then(({ data }) => setRows(data || []));
  const conta = (id, st) => rows.filter(x => x.item === id && x.status === st).length;
  useEffect(() => { loadPend(); const t = setInterval(() => { loadPend(); reloadProfile && reloadProfile(); }, 30000); return () => clearInterval(t); }, [user]); // eslint-disable-line
  if (!profile) return <div className="empty">Carregando…</div>;
  async function resgatar(t) {
    if (!confirm(`Trocar ${t.price} fichas pelo ${t.name} ${t.em}?`)) return;
    setBusy(t.id);
    try { await api('/api/shop', { op: 'buy', item: t.id }); try { sfx('win'); } catch {} toast(`Pedido enviado! Seu ${t.name} será liberado em alguns minutos`); reloadProfile && reloadProfile(); loadPend(); }
    catch (e) { toast(e.message); }
    setBusy(null);
  }
  return <>
    <AdSlot profile={profile} popup />
    <div className="panel" style={{ marginBottom: 12, textAlign: 'center' }}>
      <p style={{ margin: 0, font: '600 18px Oswald', color: 'var(--gold)' }}>🏆 Você receberá seu troféu em instantes</p>
    </div>
    <div className="shopgrid">{TROFEUS.map(t => {
      const tem = Math.max(conta(t.id, 'done'), (profile.owned || []).includes(t.id) ? 1 : 0), wait = conta(t.id, 'pending'), falta = profile.coins < t.price;
      return <div key={t.id} className="item">
        <div className="swatch trsw" style={{ display: 'grid', placeItems: 'center', fontSize: 44, background: 'radial-gradient(circle,#3a2f1d,#120e08)', borderColor: '#f2c94c', position: 'relative' }}>{t.em}<span className="trval">💰 {fmt(t.price)}</span></div>
        <b>{t.name}</b>
        {tem > 0 && <span style={{ color: '#4ade80', font: '600 15px Oswald' }}>✔ Você tem {tem}</span>}
        {wait > 0 && <span style={{ color: '#fbbf24', font: '600 15px Oswald' }}>⏳ {wait} aguardando liberação</span>}
        <button className="pillbtn" disabled={!!busy || falta} style={{ background: falta ? '' : 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => resgatar(t)}>
              {busy === t.id ? 'Resgatando…' : `💰 ${fmt(t.price)} · Resgatar`}</button>
        {falta && <small style={{ color: 'var(--mut)' }}>Faltam {fmt(t.price - profile.coins)} fichas</small>}
      </div>;
    })}</div>
  </>;
}
export default function Resgate() { return <Shell title="🎁 Resgatar fichas">{auth => <Body {...auth} />}</Shell>; }
