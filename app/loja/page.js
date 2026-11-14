'use client';
import { useState, useEffect, useRef } from 'react';
import { sb } from '../../lib/supabase-browser.js';
import Shell from '../../components/Shell.js';
import { api } from '../../lib/supabase-browser.js';
import { JOGOS, LOJA_TITULO } from '../../lib/jogos.js';
import { ITEMS, PACKS, FICHAS_POR_REAL, RECARGA_MIN, RECARGA_MAX, WELCOME } from '../../lib/shop-items.js';
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
  if (it.slot === 'taco') { const [pt, an, c1, c2, cb] = it.colors; return <div className="swatch" style={{ display: 'grid', placeItems: 'center', background: 'radial-gradient(circle,#14532d,#052e16)', borderColor: '#f2c94c' }}><div style={{ width: '88%', height: 9, borderRadius: 6, transform: 'rotate(-28deg)', boxShadow: '0 3px 4px #0008', background: `linear-gradient(90deg,${pt} 0 4%,${an} 4% 8%,${c1} 8% 40%,${c2} 62%,${cb} 64% 100%)` }} /></div>; }
  if (it.slot === 'bola') { const [m, cl, es] = it.colors; return <div className="swatch" style={{ display: 'grid', placeItems: 'center', background: 'radial-gradient(circle,#a0714a,#5a3a1f)', borderColor: '#f2c94c' }}><div style={{ width: 52, height: 52, borderRadius: '50%', boxShadow: '3px 5px 8px #0008', background: it.tipo === 'leiteira' ? 'radial-gradient(circle at 35% 30%,#fff,#e2e8f0 60%,#94a3b8)' : `radial-gradient(circle at 35% 30%,#fff 0 8%,${cl} 22%,${m} 55%,${es})` }} /></div>; }
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
  const [hist, setHist] = useState(false);  // janela "Minhas compras"
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
  const jogo = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('jogo') : null;
  const vip = profile.vip_until && new Date(profile.vip_until) > new Date();
  const owned = profile.owned || [], eq = profile.equipped || {};
  async function call(body, okMsg) {
    setBusy(true);
    try { const r = await api('/api/shop', body); sfx('coin'); toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); reloadProfile(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
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
    {!jogo && <div className="panel lj" id="comprar">
      <div className="lj-top">
        <div className="lj-tit"><h3>💰 Comprar fichas com Pix</h3>
          <small>O valor do Pix vira a mesma quantidade de fichas.</small></div>
        <a className="pillbtn dark lj-hist" href="/jogo-responsavel" style={{ textDecoration: 'none' }}>🛡 Limites</a>
        {buys.length > 0 && <button className="pillbtn dark lj-hist" onClick={() => setHist(true)}>📜 Minhas compras</button>}
      </div>
      <div className="lj-grade">
        {welcome && <div className="item lj-card lj-bv">
          <span className="lj-em">🎁</span><b className="lj-preco">R$ {WELCOME.brl.toFixed(2).replace('.', ',')}</b>
          <span className="lj-fichas">{fmt(WELCOME.coins)} fichas</span><span className="lj-tag">Boas-vindas · só na 1ª compra</span>
          <button className="pillbtn lj-btn" disabled={busy} onClick={() => pay({ id: WELCOME.id, brl: WELCOME.brl, coins: WELCOME.coins })}>Gerar Pix</button></div>}
        {PACKS.map(p => (
          <div key={p.id} className="item lj-card"><span className="lj-em">💰</span><b className="lj-preco">R$ {p.brl.toFixed(2).replace('.', ',')}</b>
            <span className="lj-fichas">{fmt(p.coins)} fichas</span>
            {p.bonus > 0 && <span className="lj-tag">+{p.pct}% bônus</span>}
            <button className="pillbtn lj-btn" disabled={busy} onClick={() => pay(p)}>Gerar Pix</button></div>))}
        <div className="item lj-card"><span className="lj-em">✏️</span><b className="lj-preco">Outro valor</b>
          <input className="mini-in lj-in" inputMode="decimal" placeholder="R$" value={livre} onChange={e => setLivre(e.target.value.replace(/[^0-9,.]/g, ''))} />
          <span className="lj-fichas">{(() => { const v = Number(livre.replace(',', '.')); return v >= RECARGA_MIN && v <= RECARGA_MAX ? `${fmt(Math.floor(v * FICHAS_POR_REAL))} fichas` : `R$ ${RECARGA_MIN} a ${fmt(RECARGA_MAX)}`; })()}</span>
          <button className="pillbtn lj-btn" disabled={busy || !(Number(livre.replace(',', '.')) >= RECARGA_MIN && Number(livre.replace(',', '.')) <= RECARGA_MAX)}
            onClick={() => { const v = Math.round(Number(livre.replace(',', '.')) * 100) / 100; pay({ id: 'custom', brl: v, coins: Math.floor(v * FICHAS_POR_REAL) }); }}>Gerar Pix</button></div>
      </div>
      <style>{`
.pagebody:has(.lj){min-height:0;padding:8px 12px;gap:8px}
.page:has(.lj){overflow:hidden}
.lj{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-color:#22c55e}
.lj-top{display:flex;align-items:center;gap:10px}
.lj-tit{flex:1;min-width:0}
.lj-tit h3{font-size:clamp(18px,3.6vmin,22px)}
.lj-tit small{display:block;font:400 clamp(11px,2.2vmin,13px) Rubik;color:#cfc4ad;line-height:1.3}
.lj-hist{flex:none;padding:7px 12px;font-size:14px}
.lj-grade{flex:1;min-height:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:clamp(6px,1.2vw,12px)}
.lj-card{justify-content:center;gap:clamp(2px,.8vh,6px);padding:clamp(6px,1.4vh,12px) 6px;min-height:0;max-height:240px;align-self:center;height:100%}
.lj-bv{border-color:#f2c94c;background:linear-gradient(160deg,#3a2a08,#120e08)}
.lj-em{font-size:clamp(24px,6vmin,38px);line-height:1}
.lj-preco{font:600 clamp(16px,3.4vmin,21px) Oswald!important}
.lj-fichas{color:var(--gold);font:600 clamp(13px,2.8vmin,16px) Oswald}
.lj-tag{background:#16a34a;color:#fff;border-radius:10px;padding:1px 6px;font:600 10px Rubik;line-height:1.3}
.lj-btn{background:linear-gradient(180deg,#34d399,#059669)!important;padding:6px 12px!important;font-size:clamp(13px,2.6vmin,15px)!important;white-space:nowrap}
.lj-in{width:min(100%,96px)!important;text-align:center;font-size:15px!important;padding:5px 6px!important}
@media (orientation:portrait){.page:has(.lj){overflow:auto}.lj-grade{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-columns:auto;align-content:start}.lj-card{height:auto}}
`}</style>
    </div>}
    {hist && <Modal onClose={() => setHist(false)}>
      <h2>Suas compras</h2>
      <div className="rows" style={{ textAlign: 'left' }}>{buys.map(b => (
        <div key={b.id} className="rowi"><div className="grow"><b>{fmt(b.coins)} fichas</b><small>{new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · R$ {Number(b.price_brl || 0).toFixed(2).replace('.', ',')}</small></div>
          <span className={`num ${b.status === 'done' ? 'won' : ''}`}>{b.status === 'done' ? 'Creditado' : b.status === 'pending' ? 'Aguardando' : 'Não concluído'}</span></div>))}</div>
      <button className="sec" onClick={() => setHist(false)}>Fechar</button>
    </Modal>}
    {jogo && JOGOS[jogo] && <div className="panel" style={{ textAlign: 'center', borderColor: 'var(--gold)' }}><h3 style={{ fontSize: 22, margin: 0 }}>{JOGOS[jogo].em || '🔵'} Loja: {JOGOS[jogo].nome}</h3>
      <button className="sec" style={{ marginTop: 8 }} onClick={() => { location.href = JOGOS[jogo].href; }}>↩ Voltar pro jogo</button></div>}
    {(jogo && JOGOS[jogo] ? (JOGOS[jogo].loja || []) : []).map(slot => (
      <div key={slot} id={slot === 'avatar' ? 'itens' : undefined} className="panel"><h3 style={{ fontSize: 20 }}>{LOJA_TITULO[slot]}</h3>
        <div className="shopgrid" style={{ marginTop: 10 }}>{ITEMS.filter(i => i.slot === slot && !i.retirado && (!i.exclusive || owned.includes(i.id))).map(it => {
          const isEq = slot === 'avatar' ? profile.avatar === it.em : (eq[slot] || ({ back: 'back-azul', pipa: 'pipa-classica', felt: 'felt-verde', taco: 'taco-classico', bola: 'bola-leiteira' }[slot])) === it.id;
          const has = it.price === 0 && !it.vipOnly || owned.includes(it.id) || (it.vipOnly && vip);
          return (
            <div key={it.id} className={`item ${isEq ? 'eq' : ''}`}>
              <Swatch it={it} /><b>{it.name}</b>
              {isEq ? <span className="won">✓ Em uso</span>
                : has ? <button className="pillbtn dark" disabled={busy} onClick={() => call({ op: 'equip', item: it.id }, slot === 'pipa' ? 'Pronto, essa é a sua pipa agora' : slot === 'taco' ? 'Pronto, esse é o seu taco agora' : slot === 'bola' ? 'Pronto, essa é a sua bolinha agora' : 'Pronto, já está na sua mesa')}>Usar</button>
                : it.vipOnly ? <span className="hint">Só para VIP</span>
                : <button className="pillbtn" disabled={busy || profile.coins < it.price} onClick={() => call({ op: 'buy', item: it.id }, 'Comprado e equipado!')}>💰 {fmt(it.price)}</button>}
            </div>);
        })}</div></div>))}
  </>;
}
export default function Loja() { return <Shell required>{auth => <Body {...auth} />}</Shell>; }
