'use client';
// MINES: grade 5x5 com bombas escondidas. Cada casa sem bomba aumenta o prêmio; saque quando quiser.
// O servidor sorteia as bombas e só mostra onde estavam quando a partida acaba (/api/mines).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { multDe, ganhoDe, fichas, CASAS, MIN_BOMBAS, MAX_BOMBAS, MIN_APOSTA, MAX_APOSTA, MAX_GANHO, BOMBAS_RAPIDAS, MARGEM } from '../../lib/mines.js';
import { criarTeste } from '../../lib/mines-teste.js';

// link de teste do Netlify: abre sem login, com fichas de mentira
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
let teste = null;
const fx = m => m.toFixed(2).replace('.', ',') + 'x';
const f2 = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Mines() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: false });
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/mines', b);
  const [p, setP] = useState(null);           // partida (aberta ou a última que acabou)
  const [coins, setCoins] = useState(null);
  const [valor, setValor] = useState(10);
  const [bombas, setBombas] = useState(3);
  const [busy, setBusy] = useState(false);
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [aviso, setAviso] = useState('');
  const [boom, setBoom] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => { setSom(soundOn()); try { const v = Number(localStorage.getItem('mn_valor')), b = Number(localStorage.getItem('mn_bombas')); if (v >= MIN_APOSTA && v <= MAX_APOSTA) setValor(v); if (b >= MIN_BOMBAS && b <= MAX_BOMBAS) setBombas(b); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('mn_valor', valor); localStorage.setItem('mn_bombas', bombas); } catch {} }, [valor, bombas]);
  useEffect(() => { if (profile) setCoins(profile.coins || 0); }, [profile?.coins]); // eslint-disable-line
  useEffect(() => {
    if (!profile && !TESTE) return;
    chama({ op: 'estado' }).then(r => { setCoins(r.coins); if (r.partida) { setP(r.partida); setValor(r.partida.valor); setBombas(r.partida.bombas); } }).catch(e => avisar(e.message));
  }, [local, !!profile]); // eslint-disable-line

  const avisar = t => { setAviso(t); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(''), 2400); };
  const jogando = p?.status === 'jogando';

  async function acao(b) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try {
      const r = await chama(b);
      if (r.coins != null) setCoins(r.coins);
      const n = r.partida;
      if (n) {
        if (b.op === 'iniciar') { sfx('coin'); setBoom(false); }
        if (b.op === 'abrir') {
          if (n.status === 'perdeu') { sfx('lose'); setBoom(true); try { navigator.vibrate && navigator.vibrate(160); } catch {} setTimeout(() => setBoom(false), 700); }
          else if (n.status === 'sacou') { sfx('win'); avisar(`Você ganhou ${f2(n.ganho)} fichas! 💎`); }
          else sfx('tick');
        }
        if (b.op === 'sacar') { sfx('win'); avisar(`Sacou em ${fx(n.mult)}: +${f2(n.ganho)} fichas`); }
        setP(n);
      }
      if (b.op !== 'abrir' || n?.status !== 'jogando') reloadProfile && reloadProfile();
    } catch (e) { sfx('err'); avisar(e.message || 'Erro'); }
    busyRef.current = false; setBusy(false);
  }
  const iniciar = () => { if (coins != null && coins < valor) return avisar('Fichas insuficientes. Compre na Loja'); acao({ op: 'iniciar', valor, bombas }); };

  // casa da grade
  function casa(i) {
    const aberta = p?.abertas?.includes(i), fim = p && !jogando, mina = fim && p.minas?.includes(i);
    let cls = 'mn-c', dentro = null;
    if (aberta && mina) { cls += ' bomba'; dentro = '💣'; }
    else if (aberta) { cls += ' gema'; dentro = <Gema />; }
    else if (fim && mina) { cls += ' rev bomba-r'; dentro = '💣'; }
    else if (fim) { cls += ' rev'; dentro = <Gema apagada />; }
    return <button key={i} className={cls} disabled={!jogando || aberta || busy} onClick={() => acao({ op: 'abrir', casa: i })}>{dentro}</button>;
  }

  const k = p?.abertas?.length || 0;
  const proximo = jogando ? p.proximo : multDe(bombas, 1);
  const trava = jogando || busy;
  return (
    <div className="page lounge mnp">
      <div className="mn-top">
        <div className="mn-logo">💣 MINES</div>
        <span className="mn-saldo">💰 <b>{coins == null ? '–' : fichas(coins)}</b></span>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/cassino')}>↩</button>
      </div>
      <div className="mn-main">
        <div className="mn-painel">
          <label className="mn-lab">Aposta</label>
          <div className="mn-row">
            <button disabled={trava} onClick={() => setValor(v => Math.max(MIN_APOSTA, v - (v > 10 ? 5 : 1)))}>−</button>
            <input disabled={trava} inputMode="numeric" value={valor} onChange={e => setValor(Math.max(0, Math.min(MAX_APOSTA, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0))))} onBlur={() => setValor(v => Math.max(MIN_APOSTA, v))} />
            <button disabled={trava} onClick={() => setValor(v => Math.min(MAX_APOSTA, v + (v >= 10 ? 5 : 1)))}>+</button>
          </div>
          <div className="mn-q">{[10, 20, 50, 100].map(v => <button key={v} disabled={trava} className={valor === v ? 'on' : ''} onClick={() => setValor(v)}>{v}</button>)}</div>
          <label className="mn-lab">Bombas 💣</label>
          <div className="mn-row">
            <button disabled={trava} onClick={() => setBombas(b => Math.max(MIN_BOMBAS, b - 1))}>−</button>
            <input disabled value={bombas} readOnly />
            <button disabled={trava} onClick={() => setBombas(b => Math.min(MAX_BOMBAS, b + 1))}>+</button>
          </div>
          <div className="mn-q">{BOMBAS_RAPIDAS.map(v => <button key={v} disabled={trava} className={bombas === v ? 'on' : ''} onClick={() => setBombas(v)}>{v}</button>)}</div>
          <div className="mn-esc">{(() => {
            const n = CASAS - (jogando ? p.bombas : bombas), b0 = jogando ? p.bombas : bombas;
            const ini = Math.max(1, Math.min(k, n - 5));      // mostra 6 casas a partir da que está jogando
            return Array.from({ length: Math.min(6, n) }, (_, i) => ini + i).map(c => {
              const m = multDe(b0, c), cls = jogando && c <= k ? 'ok' : jogando && c === k + 1 ? 'prox' : '';
              return <div key={c} className={cls}><small>{c}ª</small><b>{m >= 1000 ? Math.round(m).toLocaleString('pt-BR') : fx(m)}</b></div>;
            });
          })()}</div>
          <div className="mn-info">
            {jogando ? <><span>💎 {k} de {CASAS - p.bombas}</span><span>Agora <b>{fx(p.mult)}</b></span>{proximo && <span>Próxima <b>{fx(proximo)}</b></span>}</>
              : <span>1ª casa paga <b>{fx(proximo)}</b></span>}
          </div>
          {jogando
            ? <button className="mn-btn sacar" disabled={busy || !k} onClick={() => acao({ op: 'sacar' })}>{k ? <>SACAR<small>{f2(p.premio)} fichas</small></> : <>ESCOLHA UMA CASA<small>abra pelo menos uma</small></>}</button>
            : <button className="mn-btn jogar" disabled={busy || (!profile && !local)} onClick={iniciar}>JOGAR<small>{valor} {valor === 1 ? 'ficha' : 'fichas'}</small></button>}
        </div>
        <div className="mn-campo">
          <div className={'mn-grade' + (boom ? ' treme' : '') + (p && !jogando ? ' fim' : '')}>{Array.from({ length: CASAS }, (_, i) => casa(i))}</div>
          {p && !jogando && <div className={'mn-res ' + p.status}>{p.status === 'perdeu' ? '💥 Bomba! Perdeu ' + p.valor + ' fichas' : `💎 Ganhou ${f2(p.ganho)} fichas (${fx(p.mult)})`}</div>}
          {!p && <div className="mn-res dica">Escolha a aposta e as bombas e toque em JOGAR</div>}
          {aviso && <div className="mn-aviso">{aviso}</div>}
        </div>
      </div>
      <div className="mn-rod">{TESTE && local ? '🧪 MODO TESTE · fichas de mentira · ' : ''}Proibido para menores de 18 anos · Fichas sem valor em dinheiro · Jogue por diversão</div>
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Escolha quantas fichas quer apostar e quantas <b>bombas</b> vão ficar escondidas na grade de 25 casas ({MIN_BOMBAS} a {MAX_BOMBAS}).</p>
          <p>• Toque em <b>JOGAR</b> e vá abrindo as casas. Cada 💎 aumenta o prêmio. Mais bombas = prêmio sobe mais rápido.</p>
          <p>• Toque em <b>SACAR</b> quando quiser pra receber a aposta vezes o multiplicador.</p>
          <p>• Se abrir uma 💣, perde a aposta. Abrindo todas as casas sem bomba, saca sozinho.</p>
          <p>• Aposta de {MIN_APOSTA} a {MAX_APOSTA} fichas. Prêmio máximo de {fichas(MAX_GANHO)} fichas por partida. A casa fica com {Math.round(MARGEM * 100)}% em média.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.mnp{overflow:hidden;background:radial-gradient(ellipse at 60% 40%,#1e2a4a,#0a0f1f 70%)}
.mn-top{display:flex;align-items:center;gap:8px;padding:6px 10px 2px}
.mn-logo{font:700 clamp(18px,4.6vmin,28px) Oswald;color:#38bdf8;font-style:italic;letter-spacing:1px;margin-right:auto;white-space:nowrap}
.mn-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #38bdf888;border-radius:20px;padding:3px 10px}
.mn-top .rbtn{width:38px;height:38px;font-size:16px}
.mn-main{flex:1;min-height:0;display:flex;gap:clamp(8px,2vw,22px);padding:4px clamp(8px,2vw,20px) 4px;align-items:stretch;justify-content:center}
.mn-painel{flex:0 0 clamp(190px,30vw,280px);display:flex;flex-direction:column;gap:5px;background:#0b1224cc;border:1.5px solid #38bdf855;border-radius:16px;padding:8px 10px;min-height:0;overflow:auto}
.mn-lab{font:600 12px Rubik;color:#93c5fd;text-transform:uppercase;letter-spacing:.5px}
.mn-row{display:flex;gap:4px}
.mn-row button{flex:none;width:36px;height:34px;border-radius:10px;border:none;background:#1e293b;color:#fff;font:700 20px Rubik}
.mn-row input{flex:1;min-width:0;height:34px;border-radius:10px;border:1.5px solid #334155;background:#020617;color:#fff;text-align:center;font:700 18px Oswald}
.mn-q{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.mn-q button{height:28px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;font:600 13px Rubik}
.mn-q button.on{background:#0ea5e9;color:#fff;border-color:#7dd3fc}
.mn-row button:disabled,.mn-q button:disabled{opacity:.45}
.mn-esc{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px}
.mn-esc div{display:flex;flex-direction:column;align-items:center;background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:2px 0;line-height:1.05;min-width:0}
.mn-esc small{font:500 10px Rubik;color:#94a3b8}.mn-esc b{font:700 12px Oswald;color:#e2e8f0;white-space:nowrap;overflow:hidden;max-width:100%}
.mn-esc .ok{background:#083344;border-color:#0e7490}.mn-esc .ok b{color:#67e8f9}
.mn-esc .prox{background:#422006;border-color:#facc15}.mn-esc .prox b{color:#facc15}
.mn-info{display:flex;flex-wrap:wrap;gap:4px 10px;justify-content:center;font:500 13px Rubik;color:#cbd5e1;padding:4px 0}
.mn-info b{color:#facc15;font:700 15px Oswald}
.mn-btn{margin-top:auto;border:none;border-radius:14px;padding:8px 6px;font:700 22px Oswald;color:#fff;display:flex;flex-direction:column;align-items:center;line-height:1.05;box-shadow:0 4px 0 #0008}
.mn-btn small{font:500 13px Rubik;opacity:.95}
.mn-btn.jogar{background:linear-gradient(180deg,#22c55e,#15803d)}
.mn-btn.sacar{background:linear-gradient(180deg,#fb923c,#c2410c)}
.mn-btn:disabled{filter:grayscale(.5);opacity:.7}
.mn-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #0008}
.mn-campo{position:relative;flex:0 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:0}
.mn-grade{--t:min(calc((100dvh - 120px) / 5),calc((100vw - 340px) / 5),88px);display:grid;grid-template-columns:repeat(5,var(--t));grid-template-rows:repeat(5,var(--t));gap:calc(var(--t) * .1);padding:calc(var(--t) * .12);background:#0b1224;border:2px solid #1e3a8a;border-radius:18px;box-shadow:inset 0 0 30px #000a}
.mn-c{border:none;border-radius:calc(var(--t) * .18);background:linear-gradient(180deg,#334155,#1e293b);box-shadow:0 calc(var(--t) * .07) 0 #0f172a,inset 0 2px 0 #ffffff22;display:grid;place-items:center;font-size:calc(var(--t) * .55);padding:0;transition:transform .08s}
.mn-c:not(:disabled):active{transform:translateY(3px);box-shadow:0 1px 0 #0f172a}
.mn-c:disabled{cursor:default}
.mn-c.gema{background:radial-gradient(circle,#0e7490,#083344);box-shadow:inset 0 0 12px #22d3ee88;animation:mnpop .25s}
.mn-c.bomba{background:radial-gradient(circle,#dc2626,#450a0a);animation:mnpop .25s}
.mn-c.rev{background:#0f172a;box-shadow:none;opacity:.55}
.mn-c.bomba-r{opacity:.85}
.mn-c svg{width:70%;height:70%}
@keyframes mnpop{0%{transform:scale(.6)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
.mn-grade.treme{animation:mntreme .35s}
@keyframes mntreme{0%,100%{transform:none}20%{transform:translate(-6px,2px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,1px)}80%{transform:translate(3px,0)}}
.mn-res{font:600 15px Oswald;color:#fff;background:#0009;border-radius:12px;padding:3px 12px;text-align:center}
.mn-res.perdeu{color:#fca5a5}.mn-res.sacou{color:#86efac}.mn-res.dica{color:#93c5fd;font:500 13px Rubik}
.mn-aviso{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);background:#000c;color:#fff;font:600 16px Rubik;padding:10px 16px;border-radius:14px;border:1.5px solid #facc15;z-index:3;text-align:center;pointer-events:none}
.mn-rod{text-align:center;font:400 10px Rubik;color:#64748b;padding:2px 0 4px}
@media (orientation:portrait){
.mn-main{flex-direction:column-reverse;align-items:center}
.mn-painel{flex:none;width:min(96vw,420px)}
.mn-grade{--t:min(calc((100vw - 40px) / 5),70px)}
}
`}</style>
    </div>
  );
}

function Gema({ apagada }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <defs><linearGradient id={apagada ? 'mng2' : 'mng'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={apagada ? '#64748b' : '#a5f3fc'} /><stop offset="1" stopColor={apagada ? '#334155' : '#0891b2'} /></linearGradient></defs>
      <path d="M10 6h20l8 10-18 20L2 16z" fill={`url(#${apagada ? 'mng2' : 'mng'})`} stroke={apagada ? '#475569' : '#ecfeff'} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 16h36M10 6l6 10 4-10 4 10 6-10M16 16l4 20 4-20" fill="none" stroke={apagada ? '#47556988' : '#ecfeffaa'} strokeWidth="1" />
    </svg>
  );
}
