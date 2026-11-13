'use client';
// Resgate de fichas: o cliente digita quantas fichas quer trocar por um Troféu de Ouro com esse valor
// (enfeite de coleção, sem valor em dinheiro). O admin libera no painel; se recusar, as fichas voltam.
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell.js';
import { api, sb } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';
import { toast } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';
import AdSlot from '../../components/AdSlot.js';

const RAPIDOS = [10, 25, 50, 100];
const num = v => Number(String(v || '').replace(',', '.'));

function Body({ profile, reloadProfile, user }) {
  const [busy, setBusy] = useState(false), [valor, setValor] = useState(''), [rows, setRows] = useState([]);
  const load = () => user && sb().from('purchases').select('id,price_coins,status,created_at').eq('user_id', user.id).eq('item', 'tr-livre')
    .in('status', ['pending', 'done']).order('created_at', { ascending: false }).limit(50).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); const t = setInterval(() => { load(); reloadProfile && reloadProfile(); }, 30000); return () => clearInterval(t); }, [user]); // eslint-disable-line
  if (!profile) return <div className="empty">Carregando…</div>;
  const v = num(valor), saldo = Number(profile.coins) || 0, invalido = !(v >= 1) || !Number.isInteger(v), falta = v > saldo;
  async function resgatar() {
    if (invalido || falta || busy) return;
    if (!confirm(`Trocar ${fmt(v)} fichas por um Troféu de Ouro de ${fmt(v)}?`)) return;
    setBusy(true);
    try { await api('/api/shop', { op: 'resgatar', valor: v }); try { sfx('win'); } catch {} toast('Pedido enviado! Seu troféu será liberado em alguns minutos'); setValor(''); reloadProfile && reloadProfile(); load(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  const pend = rows.filter(r => r.status === 'pending'), feitos = rows.filter(r => r.status === 'done');
  return <>
    <AdSlot profile={profile} popup />
    <div className="panel" style={{ marginBottom: 12, textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
      <span className="trgold big"><i>🏆</i><b>{invalido ? '—' : fmt(v)}</b></span>
      <p style={{ margin: 0, font: '600 18px Oswald', color: 'var(--gold)' }}>Troque suas fichas por um Troféu de Ouro</p>
      <small style={{ color: 'var(--mut)' }}>Você tem 💰 {fmt(saldo)} fichas</small>
      <input inputMode="numeric" placeholder="Quantas fichas?" value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ''))}
        style={{ width: 'min(260px,80vw)', textAlign: 'center', font: '700 22px Oswald', padding: '8px 12px', borderRadius: 12, border: '2px solid var(--gold2)', background: '#0c0a07', color: '#fff' }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {RAPIDOS.map(n => <button key={n} className="pillbtn dark" style={{ padding: '4px 12px' }} disabled={n > saldo} onClick={() => setValor(String(n))}>{n}</button>)}
        <button className="pillbtn dark" style={{ padding: '4px 12px' }} disabled={saldo < 1} onClick={() => setValor(String(Math.floor(saldo)))}>Tudo</button>
      </div>
      <button className="pillbtn" disabled={busy || invalido || falta} style={{ background: invalido || falta ? '' : 'linear-gradient(180deg,#fb923c,#c2410c)', padding: '8px 22px', fontSize: 18 }} onClick={resgatar}>
        {busy ? 'Resgatando…' : `🏆 Resgatar${invalido ? '' : ' ' + fmt(v)}`}</button>
      {falta && <small style={{ color: '#fca5a5' }}>Você só tem {fmt(saldo)} fichas</small>}
    </div>
    {pend.length > 0 && <div className="panel" style={{ marginBottom: 12 }}>
      <b style={{ color: '#fbbf24', font: '600 16px Oswald' }}>⏳ Aguardando liberação</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{pend.map(r => <span key={r.id} className="trgold" style={{ opacity: .6 }}><i>🏆</i><b>{fmt(r.price_coins)}</b></span>)}</div>
    </div>}
    {feitos.length > 0 && <div className="panel">
      <b style={{ color: '#4ade80', font: '600 16px Oswald' }}>✔ Sua coleção</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{feitos.map(r => <span key={r.id} className="trgold"><i>🏆</i><b>{fmt(r.price_coins)}</b></span>)}</div>
    </div>}
  </>;
}
export default function Resgate() { return <Shell title="🎁 Resgatar fichas">{auth => <Body {...auth} />}</Shell>; }
