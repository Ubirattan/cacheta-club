'use client';
import { useState, useEffect } from 'react';
import { sb } from '../../lib/supabase-browser.js';
import Shell from '../../components/Shell.js';
import { api } from '../../lib/supabase-browser.js';
import { ITEMS, PACKS, VIP_PERKS } from '../../lib/shop-items.js';
import { fmt } from '../../lib/modes.js';
import { toast } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';

function Swatch({ it }) {
  if (it.slot === 'felt') return <div className="swatch felt" style={{ background: `radial-gradient(ellipse at 50% 45%,${it.colors[0]},${it.colors[1]} 45%,${it.colors[2]})` }} />;
  return <div className="swatch" style={{ background: `repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 3px,transparent 3px 7px),linear-gradient(135deg,${it.colors[0]},${it.colors[1]})`, borderColor: it.gold ? '#f2c94c' : '#fff' }} />;
}

function Body({ profile, reloadProfile, user }) {
  const [busy, setBusy] = useState(false);
  const [buys, setBuys] = useState([]);
  const loadBuys = () => user && sb().from('purchases').select('*').eq('user_id', user.id).not('coins', 'eq', 0).order('created_at', { ascending: false }).limit(10).then(({ data }) => setBuys(data || []));
  useEffect(() => { loadBuys(); }, [user]); // eslint-disable-line
  // voltou do Mercado Pago: confere o pagamento na hora
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(location.search), pid = q.get('payment_id') || q.get('collection_id'), st = q.get('pago');
    if (!st) return;
    history.replaceState(null, '', '/loja');
    if (st === 'erro') return toast('O pagamento não foi concluído.');
    if (!pid) return toast('Pagamento em processamento. As fichas entram assim que o Mercado Pago confirmar.');
    api('/api/pay', { op: 'check', paymentId: pid }).then(r => {
      if (r.credited) { sfx('coin'); toast(`Pagamento aprovado! + 🪙 ${fmt(r.credited)}`); }
      else if (r.already) toast('Pagamento confirmado, fichas já estão no seu saldo.');
      else toast('Pagamento pendente (Pix): as fichas entram sozinhas assim que for confirmado.');
      reloadProfile(); loadBuys();
    }).catch(e => toast(e.message));
  }, [user]); // eslint-disable-line
  async function pay(pack) {
    setBusy(true);
    try { const r = await api('/api/pay', { op: 'create', pack: pack.id }); location.href = r.url; }
    catch (e) { toast(e.message); setBusy(false); }
  }
  if (!profile) return <div className="empty">Carregando…</div>;
  const vip = profile.vip_until && new Date(profile.vip_until) > new Date();
  const owned = profile.owned || [], eq = profile.equipped || {};
  const last = profile.last_bonus ? new Date(profile.last_bonus).getTime() : 0;
  const bonusOk = Date.now() - last > 20 * 3600 * 1000;
  async function call(body, okMsg) {
    setBusy(true);
    try { const r = await api('/api/shop', body); sfx('coin'); toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); reloadProfile(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  const vipItem = ITEMS.find(i => i.slot === 'vip');
  return <>
    <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 40 }}>🎁</span>
      <div style={{ flex: 1, minWidth: 180 }}><h3 style={{ fontSize: 20 }}>Bônus diário</h3><span className="hint">Fichas grátis todo dia{vip ? ' (VIP ganha em dobro)' : ''}.</span></div>
      <button className="pillbtn" disabled={busy || !bonusOk} onClick={() => call({ op: 'bonus' }, r => `+ 🪙 ${fmt(r.amount)} no seu saldo!`)}>{bonusOk ? 'Pegar bônus' : 'Volte amanhã'}</button>
    </div>
    <div className="vipbox">
      <h3 style={{ margin: 0, font: '700 24px Oswald', color: 'var(--gold)' }}>👑 VIP {vip && <small style={{ fontSize: 14, color: '#fff' }}>ativo até {new Date(profile.vip_until).toLocaleDateString('pt-BR')}</small>}</h3>
      <ul>{VIP_PERKS.map(p => <li key={p}>{p}</li>)}</ul>
      <button className="go" disabled={busy || profile.coins < vipItem.price} onClick={() => call({ op: 'buy', item: vipItem.id }, 'VIP ativado! 👑')}>{vip ? 'Renovar' : 'Ativar'} 30 dias · 🪙 {fmt(vipItem.price)}</button>
    </div>
    {['back', 'felt'].map(slot => (
      <div key={slot} className="panel"><h3 style={{ fontSize: 20 }}>{slot === 'back' ? 'Verso das cartas' : 'Feltro da mesa'}</h3>
        <div className="shopgrid" style={{ marginTop: 10 }}>{ITEMS.filter(i => i.slot === slot).map(it => {
          const isEq = (eq[slot] || (slot === 'back' ? 'back-azul' : 'felt-verde')) === it.id;
          const has = it.price === 0 && !it.vipOnly || owned.includes(it.id) || (it.vipOnly && vip);
          return (
            <div key={it.id} className={`item ${isEq ? 'eq' : ''}`}>
              <Swatch it={it} /><b>{it.name}</b>
              {isEq ? <span className="won">✓ Em uso</span>
                : has ? <button className="pillbtn dark" disabled={busy} onClick={() => call({ op: 'equip', item: it.id }, 'Pronto, já está na sua mesa')}>Usar</button>
                : it.vipOnly ? <span className="hint">Só para VIP</span>
                : <button className="pillbtn" disabled={busy || profile.coins < it.price} onClick={() => call({ op: 'buy', item: it.id }, 'Comprado e equipado!')}>🪙 {fmt(it.price)}</button>}
            </div>);
        })}</div></div>))}
    <div className="panel"><h3 style={{ fontSize: 20 }}>Pacotes de fichas</h3>
      <p className="hint">Pague com <b>Pix</b> ou cartão pelo Mercado Pago. As fichas são virtuais: servem só para jogar, não valem dinheiro, não têm saque e não podem ser trocadas.</p>
      <div className="shopgrid">{PACKS.map(p => (
        <div key={p.id} className="item"><span style={{ fontSize: 36 }}>🪙</span><b>{fmt(p.coins)} fichas</b><span className="hint">R$ {p.brl.toFixed(2).replace('.', ',')}</span>
          <button className="pillbtn blue" disabled={busy} onClick={() => pay(p)}>Comprar com Pix</button></div>))}</div>
      {buys.length > 0 && <><h3 style={{ fontSize: 16, marginTop: 14 }}>Suas compras</h3><div className="rows">{buys.map(b => (
        <div key={b.id} className="rowi"><div className="grow"><b>{fmt(b.coins)} fichas</b><small>{new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · R$ {Number(b.price_brl || 0).toFixed(2).replace('.', ',')}</small></div>
          <span className={`num ${b.status === 'done' ? 'won' : ''}`}>{b.status === 'done' ? 'Creditado' : b.status === 'pending' ? 'Aguardando' : 'Não concluído'}</span></div>))}</div></>}
    </div>
  </>;
}
export default function Loja() { return <Shell title="🛒 Loja">{auth => <Body {...auth} />}</Shell>; }
