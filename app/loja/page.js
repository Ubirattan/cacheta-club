'use client';
import { useState, useEffect, useRef } from 'react';
import { sb } from '../../lib/supabase-browser.js';
import Shell from '../../components/Shell.js';
import { api } from '../../lib/supabase-browser.js';
import { ITEMS, PACKS, VIP_PERKS, FICHAS_POR_REAL, RECARGA_MIN, RECARGA_MAX, WELCOME } from '../../lib/shop-items.js';
import { fmt } from '../../lib/modes.js';
import { toast, Modal } from '../../components/ui.js';
import { sfx } from '../../lib/sfx.js';
import { drawPipa } from '../../lib/pipa-arte.js';

// desenho da pipa no cartão da loja
function PipaSwatch({ id }) {
  const ref = useRef(null);
  useEffect(() => { const cv = ref.current; if (!cv) return; const g = cv.getContext('2d'); g.clearRect(0, 0, 160, 160); drawPipa(g, id, 120, 20, 14); }, [id]);
  return <div className="swatch" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#3b82c4,#9cc9ee)', borderColor: '#fff' }}><canvas ref={ref} width={160} height={160} style={{ width: '88%', height: '88%' }} /></div>;
}

function Swatch({ it }) {
  if (it.slot === 'pipa') return <PipaSwatch id={it.id} />;
  if (it.slot === 'avatar') return <div className="swatch" style={{ display: 'grid', placeItems: 'center', fontSize: 40, background: 'radial-gradient(circle,#3a2f1d,#120e08)', borderColor: '#f2c94c' }}>{it.em}</div>;
  if (it.slot === 'felt') return <div className="swatch felt" style={{ background: `radial-gradient(ellipse at 50% 45%,${it.colors[0]},${it.colors[1]} 45%,${it.colors[2]})` }} />;
  return <div className="swatch" style={{ background: `repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 3px,transparent 3px 7px),linear-gradient(135deg,${it.colors[0]},${it.colors[1]})`, borderColor: it.gold ? '#f2c94c' : '#fff' }} />;
}

function Body({ profile, reloadProfile, user }) {
  const [busy, setBusy] = useState(false);
  const [buys, setBuys] = useState([]);
  const loadBuys = () => user && sb().from('purchases').select('*').eq('user_id', user.id).not('coins', 'eq', 0).order('created_at', { ascending: false }).limit(10).then(({ data }) => setBuys(data || []));
  useEffect(() => { loadBuys(); }, [user]); // eslint-disable-line
  const welcome = !buys.some(b => b.status === 'done' && (b.coins || 0) > 0);
  useEffect(() => { if (profile && location.hash === '#comprar') setTimeout(() => document.getElementById('comprar')?.scrollIntoView({ behavior: 'smooth' }), 200); }, [!!profile]); // eslint-disable-line
  // voltou do Mercado Pago: confere o pagamento na hora
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(location.search), pid = q.get('payment_id') || q.get('collection_id'), st = q.get('pago');
    if (!st) return;
    history.replaceState(null, '', '/loja');
    if (st === 'erro') return toast('O pagamento não foi concluído.');
    if (!pid) return toast('Pagamento em processamento. As fichas entram assim que o Mercado Pago confirmar.');
    api('/api/pay', { op: 'check', paymentId: pid }).then(r => {
      if (r.credited) { sfx('coin'); toast(`Pagamento aprovado! + 💰 ${fmt(r.credited)}`); }
      else if (r.already) toast('Pagamento confirmado, fichas já estão no seu saldo.');
      else toast('Pagamento pendente (Pix): as fichas entram sozinhas assim que for confirmado.');
      reloadProfile(); loadBuys();
    }).catch(e => toast(e.message));
  }, [user]); // eslint-disable-line
  const [doc, setDoc] = useState(null);     // pede nome e CPF (GeraPix)
  const [livre, setLivre] = useState('');
  const [pix, setPix] = useState(null);     // QR Code + copia e cola esperando pagamento
  async function pay(pack, extra = {}) {
    setBusy(true);
    try {
      const r = await api('/api/pay', { op: 'create', pack: pack.id, valor: pack.brl, ...extra });
      if (r.needDoc) { setDoc({ pack, nome: '', cpf: '' }); setBusy(false); return; }
      if (r.pix) { setDoc(null); setPix({ ...r.pix, purchaseId: r.purchaseId }); setBusy(false); loadBuys(); return; }
      location.href = r.url;
    } catch (e) { toast(e.message); setBusy(false); }
  }
  // enquanto o QR está aberto, confere a cada 3 s se o pagamento caiu
  useEffect(() => {
    if (!pix) return;
    const t = setInterval(async () => {
      const { data } = await sb().from('purchases').select('status').eq('id', pix.purchaseId).maybeSingle();
      if (data && data.status === 'done') { clearInterval(t); setPix(null); sfx('coin'); toast(`Pagamento confirmado! + 💰 ${fmt(pix.coins)}`); reloadProfile(); loadBuys(); }
    }, 3000);
    return () => clearInterval(t);
  }, [pix]); // eslint-disable-line
  if (!profile) return <div className="empty">Carregando…</div>;
  const vip = profile.vip_until && new Date(profile.vip_until) > new Date();
  const owned = profile.owned || [], eq = profile.equipped || {};
  async function call(body, okMsg) {
    setBusy(true);
    try { const r = await api('/api/shop', body); sfx('coin'); toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); reloadProfile(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  const vipItem = ITEMS.find(i => i.slot === 'vip');
  return <>
    {doc && <Modal onClose={() => setDoc(null)}>
      <h2>Pagar com Pix</h2>
      <p>{fmt(doc.pack.coins)} fichas por <b>R$ {doc.pack.brl.toFixed(2).replace('.', ',')}</b>. O banco do Pix pede o nome e o CPF de quem paga.</p>
      <input className="field" placeholder="Nome e sobrenome" value={doc.nome} onChange={e => setDoc({ ...doc, nome: e.target.value })} />
      <input className="field" placeholder="CPF (só números)" inputMode="numeric" maxLength={14} value={doc.cpf} onChange={e => setDoc({ ...doc, cpf: e.target.value })} />
      <p className="hint">Seu CPF vai só para o gerador do Pix e não fica guardado na Casa de Jogos.</p>
      <button className="go" disabled={busy} onClick={() => pay(doc.pack, { nome: doc.nome, cpf: doc.cpf })}>{busy ? 'Gerando Pix…' : 'Gerar Pix'}</button>
      <button className="sec" onClick={() => setDoc(null)}>Cancelar</button>
    </Modal>}
    {pix && <Modal>
      <h2>Pix gerado</h2>
      <p>Pague <b>R$ {pix.valor.toFixed(2).replace('.', ',')}</b> no app do seu banco. As <b>{fmt(pix.coins)} fichas</b> entram sozinhas assim que o pagamento cair.</p>
      {pix.imagem && <img src={pix.imagem} alt="QR Code Pix" style={{ width: 220, height: 220, background: '#fff', borderRadius: 12, padding: 8 }} />}
      <p className="hint">Ou use o Pix copia e cola:</p>
      <textarea readOnly value={pix.copiaCola} onFocus={e => e.target.select()} style={{ width: '100%', height: 70, borderRadius: 10, padding: 8, fontSize: 12, userSelect: 'text' }} />
      <button className="go" onClick={async () => { try { await navigator.clipboard.writeText(pix.copiaCola); toast('Código Pix copiado'); } catch { toast('Selecione e copie o código acima'); } }}>Copiar código Pix</button>
      <p style={{ color: 'var(--gold)' }}>⏳ Aguardando pagamento…</p>
      <button className="sec" onClick={() => setPix(null)}>Fechar (as fichas entram mesmo assim)</button>
    </Modal>}
    <div className="panel" id="comprar" style={{ borderColor: '#22c55e' }}><h3 style={{ fontSize: 22 }}>💰 Comprar fichas com Pix</h3>
      <p className="hint"><b>R$ 1 = {FICHAS_POR_REAL} ficha</b>: o valor do Pix vira a mesma quantidade de fichas. Pague com <b>Pix</b>. As fichas são virtuais: servem só para jogar, não valem dinheiro, não têm saque e não podem ser trocadas.</p>
      {welcome && <div className="item" style={{ border: '2px solid #f2c94c', background: 'linear-gradient(135deg,#3a2a08,#120e08)', flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 44 }}>🎁</span>
        <div style={{ textAlign: 'left' }}><b style={{ fontSize: 18, color: 'var(--gold)' }}>Pacote de boas-vindas</b><br />
          <span>R$ {WELCOME.brl.toFixed(2).replace('.', ',')} → <b>{fmt(WELCOME.coins)} fichas</b> + avatar exclusivo 🌟 Estrela</span><br /><small className="hint">Só na sua primeira compra</small></div>
        <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', fontSize: 16, padding: '10px 18px' }} disabled={busy} onClick={() => pay({ id: WELCOME.id, brl: WELCOME.brl, coins: WELCOME.coins })}>Gerar Pix</button>
      </div>}
      <div className="shopgrid">{PACKS.map(p => (
        <div key={p.id} className="item"><span style={{ fontSize: 36 }}>💰</span><b style={{ fontSize: 20 }}>R$ {p.brl.toFixed(2).replace('.', ',')}</b><span style={{ color: 'var(--gold)', font: '600 16px Oswald' }}>{fmt(p.coins)} fichas</span>
          {p.bonus > 0 && <span style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '1px 8px', font: '600 12px Rubik' }}>+{p.pct}% bônus · +{fmt(p.bonus)}</span>}
          <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', fontSize: 16, padding: '10px 18px' }} disabled={busy} onClick={() => pay(p)}>Gerar Pix</button></div>))}
        <div className="item"><span style={{ fontSize: 36 }}>✏️</span><b>Outro valor</b>
          <input className="mini-in" style={{ width: 110, textAlign: 'center', fontSize: 16 }} inputMode="decimal" placeholder="R$" value={livre} onChange={e => setLivre(e.target.value.replace(/[^0-9,.]/g, ''))} />
          <span style={{ color: 'var(--gold)', font: '600 15px Oswald' }}>{(() => { const v = Number(livre.replace(',', '.')); return v >= RECARGA_MIN && v <= RECARGA_MAX ? `${fmt(Math.floor(v * FICHAS_POR_REAL))} fichas` : `de R$ ${RECARGA_MIN} a R$ ${fmt(RECARGA_MAX)}`; })()}</span>
          <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#34d399,#059669)', fontSize: 16, padding: '10px 18px' }} disabled={busy || !(Number(livre.replace(',', '.')) >= RECARGA_MIN && Number(livre.replace(',', '.')) <= RECARGA_MAX)}
            onClick={() => { const v = Math.round(Number(livre.replace(',', '.')) * 100) / 100; pay({ id: 'custom', brl: v, coins: Math.floor(v * FICHAS_POR_REAL) }); }}>Gerar Pix</button></div>
      </div>
      {buys.length > 0 && <><h3 style={{ fontSize: 16, marginTop: 14 }}>Suas compras</h3><div className="rows">{buys.map(b => (
        <div key={b.id} className="rowi"><div className="grow"><b>{fmt(b.coins)} fichas</b><small>{new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · R$ {Number(b.price_brl || 0).toFixed(2).replace('.', ',')}</small></div>
          <span className={`num ${b.status === 'done' ? 'won' : ''}`}>{b.status === 'done' ? 'Creditado' : b.status === 'pending' ? 'Aguardando' : 'Não concluído'}</span></div>))}</div></>}
    </div>
    <div className="vipbox">
      <h3 style={{ margin: 0, font: '700 24px Oswald', color: 'var(--gold)' }}>👑 VIP {vip && <small style={{ fontSize: 14, color: '#fff' }}>ativo até {new Date(profile.vip_until).toLocaleDateString('pt-BR')}</small>}</h3>
      <ul>{VIP_PERKS.map(p => <li key={p}>{p}</li>)}</ul>
      <button className="go" disabled={busy || profile.coins < vipItem.price} onClick={() => call({ op: 'buy', item: vipItem.id }, 'VIP ativado! 👑')}>{vip ? 'Renovar' : 'Ativar'} 30 dias · 💰 {fmt(vipItem.price)}</button>
    </div>
    {['avatar', 'pipa', 'back', 'felt'].map(slot => (
      <div key={slot} id={slot === 'avatar' ? 'itens' : undefined} className="panel"><h3 style={{ fontSize: 20 }}>{slot === 'avatar' ? '✨ Avatares especiais' : slot === 'pipa' ? '🪁 Pipas' : slot === 'back' ? '🂠 Baralhos' : '🟩 Mesas'}</h3>
        <div className="shopgrid" style={{ marginTop: 10 }}>{ITEMS.filter(i => i.slot === slot && (!i.exclusive || owned.includes(i.id))).map(it => {
          const isEq = slot === 'avatar' ? profile.avatar === it.em : (eq[slot] || (slot === 'back' ? 'back-azul' : slot === 'pipa' ? 'pipa-classica' : 'felt-verde')) === it.id;
          const has = it.price === 0 && !it.vipOnly || owned.includes(it.id) || (it.vipOnly && vip);
          return (
            <div key={it.id} className={`item ${isEq ? 'eq' : ''}`}>
              <Swatch it={it} /><b>{it.name}</b>
              {isEq ? <span className="won">✓ Em uso</span>
                : has ? <button className="pillbtn dark" disabled={busy} onClick={() => call({ op: 'equip', item: it.id }, slot === 'pipa' ? 'Pronto, essa é a sua pipa agora' : 'Pronto, já está na sua mesa')}>Usar</button>
                : it.vipOnly ? <span className="hint">Só para VIP</span>
                : <button className="pillbtn" disabled={busy || profile.coins < it.price} onClick={() => call({ op: 'buy', item: it.id }, 'Comprado e equipado!')}>💰 {fmt(it.price)}</button>}
            </div>);
        })}</div></div>))}
  </>;
}
export default function Loja() { return <Shell title="🛒 Loja">{auth => <Body {...auth} />}</Shell>; }
