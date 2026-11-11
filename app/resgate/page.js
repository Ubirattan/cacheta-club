'use client';
// Resgate de fichas: troca fichas por troféus de coleção (enfeite, sem valor em dinheiro)
import { useState } from 'react';
import Shell from '../../components/Shell.js';
import { api } from '../../lib/supabase-browser.js';
import { ITEMS } from '../../lib/shop-items.js';
import { fmt } from '../../lib/modes.js';
import { toast } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';

const TROFEUS = ITEMS.filter(i => i.slot === 'trofeu');
function Body({ profile, reloadProfile }) {
  const [busy, setBusy] = useState(null);
  if (!profile) return <div className="empty">Carregando…</div>;
  const owned = profile.owned || [];
  async function resgatar(t) {
    if (!confirm(`Trocar ${t.price} fichas pelo ${t.name} ${t.em}?\n\nO troféu é de coleção: não volta a ser ficha.`)) return;
    setBusy(t.id);
    try { await api('/api/shop', { op: 'buy', item: t.id }); try { sfx('win'); } catch {} toast(`${t.em} ${t.name} é seu!`); reloadProfile && reloadProfile(); }
    catch (e) { toast(e.message); }
    setBusy(null);
  }
  const tenho = TROFEUS.filter(t => owned.includes(t.id));
  return <>
    <div className="panel" style={{ marginBottom: 12 }}>
      <p className="hint" style={{ margin: 0 }}>Troque suas fichas por <b>troféus de coleção</b>. Eles aparecem no seu perfil para todo mundo ver. Troféus são só enfeite: não voltam a ser fichas e não valem dinheiro.</p>
      <p style={{ margin: '8px 0 0' }}>Sua coleção: {tenho.length ? <span style={{ fontSize: 26 }}>{tenho.map(t => t.em).join(' ')}</span> : <i style={{ color: 'var(--mut)' }}>nenhum troféu ainda</i>}</p>
    </div>
    <div className="shopgrid">{TROFEUS.map(t => {
      const has = owned.includes(t.id), falta = profile.coins < t.price;
      return <div key={t.id} className="item">
        <div className="swatch" style={{ display: 'grid', placeItems: 'center', fontSize: 44, background: 'radial-gradient(circle,#3a2f1d,#120e08)', borderColor: '#f2c94c' }}>{t.em}</div>
        <b>{t.name}</b>
        {has ? <span style={{ color: '#4ade80', font: '600 15px Oswald' }}>✔ Na sua coleção</span>
          : <button className="pillbtn" disabled={!!busy || falta} style={{ background: falta ? '' : 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => resgatar(t)}>
              {busy === t.id ? 'Resgatando…' : `💰 ${fmt(t.price)} · Resgatar`}</button>}
        {!has && falta && <small style={{ color: 'var(--mut)' }}>Faltam {fmt(t.price - profile.coins)} fichas</small>}
      </div>;
    })}</div>
  </>;
}
export default function Resgate() { return <Shell title="🎁 Resgatar fichas">{auth => <Body {...auth} />}</Shell>; }
