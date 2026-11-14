'use client';
// JOGO DO BICHO: sorteios em horários fixos (11h, 14h, 16h, 18h e 21h). O servidor sorteia e paga
// (/api/bicho); a tela consulta o estado a cada 10 s e mostra a contagem até o próximo sorteio.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, voltar } from '../../components/ui.js';
import { api, pedirConta } from '../../lib/supabase-browser.js';
import { sfx } from '../../lib/sfx.js';
import { BICHOS, TIPOS, POS, HORARIOS, MAX_POR_SORTEIO, PREMIO_MAXIMO, bicho, grupoDe, dezenasDo, conferir, premioPossivel, descreve, horaTxt, diaTxt } from '../../lib/bicho.js';
import { criarTeste } from '../../lib/bicho-teste.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
let teste = null;
const fx = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const VALORES = [1, 2, 5, 10, 20, 50, 100];
const relogio = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + 'h ' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };

export default function JogoDoBicho() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: false });
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/bicho', b);
  const chamaRef = useRef(chama); chamaRef.current = chama;
  const off = useRef(0);
  const [st, setSt] = useState(null), [agora, setAgora] = useState(Date.now());
  const [tipo, setTipo] = useState('grupo'), [pos, setPos] = useState('cabeca'), [palpite, setPalpite] = useState(''), [valor, setValor] = useState(5);
  const [aviso, setAviso] = useState(null), [enviando, setEnviando] = useState(false), [regras, setRegras] = useState(false), [aba, setAba] = useState('apostar');

  async function puxa() {
    const t0 = Date.now();
    try { const s = await chamaRef.current({ op: 'estado' }); off.current = s.agora - (t0 + Date.now()) / 2; setSt(s); } catch {}
  }
  useEffect(() => { puxa(); const t = setInterval(puxa, 10000); return () => clearInterval(t); }, [local]); // eslint-disable-line
  useEffect(() => { const t = setInterval(() => setAgora(Date.now() + off.current), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (st && agora >= st.proximo.fecha + 1500) puxa(); }, [agora >= (st?.proximo.fecha || Infinity)]); // eslint-disable-line

  const avisar = (t, bom) => { setAviso({ t, bom }); setTimeout(() => setAviso(null), 3500); };
  const ap = { tipo, palpite: tipo === 'grupo' ? palpite : palpite, pos, valor };
  const ok = !conferir(ap).erro;
  const coins = st?.coins;

  async function apostar() {
    if (!profile && !local) return pedirConta();
    const c = conferir(ap); if (c.erro) return avisar(c.erro);
    setEnviando(true);
    try {
      const r = await chamaRef.current({ op: 'apostar', aposta: c });
      sfx('coin'); avisar(`Aposta feita: ${descreve(c)} · ${valor} ${valor === 1 ? 'ficha' : 'fichas'}`, true);
      setPalpite(''); setSt(s => s ? { ...s, coins: r.coins } : s); reloadProfile && reloadProfile(); puxa();
    } catch (e) { avisar(e.message || 'Não deu pra apostar'); }
    setEnviando(false);
  }
  function digito(d) { const max = TIPOS[tipo].dig; setPalpite(p => d === '<' ? p.slice(0, -1) : p.length >= max ? p : p + d); }
  function trocaTipo(t) { setTipo(t); setPalpite(''); }

  const px = st?.proximo, falta = px ? (px.fecha - agora) / 1000 : 0;
  const abertas = (st?.minhas || []).filter(m => m.status === 'aberta');

  return (
    <div className="page lounge bx">
      <div className="bx-top">
        <div className="bx-logo">🐾 <b>BICHO</b></div>
        {coins != null && <button className="bx-saldo" onClick={() => router.push('/loja#comprar')}>💰 <b>{fx(coins)}</b><i>+</i></button>}
        <button className="rbtn bx-volta" title="Voltar" onClick={() => voltar(router, '/inicio')}>‹ Voltar</button>
      </div>

      <div className="bx-prox">
        <div><small>Próximo sorteio</small><b>{px ? `${diaTxt(px.hora, agora)} · ${local ? new Date(px.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : horaTxt(px.hora)}` : '…'}</b></div>
        <div className="bx-conta"><small>Fecha em</small><b>{px ? relogio(falta) : '--:--'}</b></div>
      </div>

      <div className="bx-abas">
        <button className={aba === 'apostar' ? 'on' : ''} onClick={() => setAba('apostar')}>Apostar</button>
        <button className={aba === 'minhas' ? 'on' : ''} onClick={() => setAba('minhas')}>Minhas{abertas.length ? <i>{abertas.length}</i> : null}</button>
        <button className={aba === 'resultados' ? 'on' : ''} onClick={() => setAba('resultados')}>Resultados</button>
      </div>

      <div className="bx-corpo">
        {aba === 'apostar' && <>
          <div className="bx-tipos">
            {Object.entries(TIPOS).map(([k, t]) => <button key={k} className={tipo === k ? 'on' : ''} onClick={() => trocaTipo(k)}><b>{t.nome}</b><small>paga {fx(t.paga)}x</small></button>)}
          </div>
          <div className="bx-pos">
            {Object.entries(POS).map(([k, t]) => <button key={k} className={pos === k ? 'on' : ''} onClick={() => setPos(k)}>{t}</button>)}
          </div>

          {tipo === 'grupo' ? <div className="bx-grade">
            {BICHOS.map(([nome, em], i) => <button key={i} className={palpite === String(i + 1) ? 'on' : ''} onClick={() => setPalpite(String(i + 1))}>
              <span className="bx-n">{String(i + 1).padStart(2, '0')}</span><i>{em}</i><b>{nome}</b><small>{dezenasDo(i + 1).join(' ')}</small></button>)}
          </div> : <div className="bx-num">
            <div className="bx-visor">
              {Array.from({ length: TIPOS[tipo].dig }, (_, i) => <span key={i} className={palpite[i] != null ? 'on' : ''}>{palpite[i] ?? '·'}</span>)}
              {palpite.length >= 2 && <em>{bicho(grupoDe(palpite.slice(-2))).em} {bicho(grupoDe(palpite.slice(-2))).nome}</em>}
            </div>
            <div className="bx-tecla">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0'].map(d => <button key={d} onClick={() => digito(d)}>{d === '<' ? '⌫' : d}</button>)}
              <button onClick={() => setPalpite(Array.from({ length: TIPOS[tipo].dig }, () => Math.floor(Math.random() * 10)).join(''))}>🎲</button>
            </div>
          </div>}

          <div className="bx-valor">
            <span>Valor</span>
            {VALORES.map(v => <button key={v} className={valor === v ? 'on' : ''} onClick={() => setValor(v)}>{v}</button>)}
          </div>
          <div className="bx-premio">Prêmio possível: <b>{ok ? fx(premioPossivel(conferir(ap))) : '–'} fichas</b>{pos === 'todos' && <small> por prêmio que acertar</small>}</div>
          <button className="bx-apostar" disabled={!ok || enviando || falta <= 0} onClick={apostar}>
            {enviando ? 'Enviando…' : ok ? `APOSTAR ${valor} ${valor === 1 ? 'FICHA' : 'FICHAS'} · ${descreve(conferir(ap))}` : tipo === 'grupo' ? 'ESCOLHA UM BICHO' : `DIGITE ${TIPOS[tipo].dig} NÚMEROS`}
          </button>
          <button className="bx-regras" onClick={() => setRegras(true)}>📖 Como jogar</button>
        </>}

        {aba === 'minhas' && <div className="bx-lista">
          {!profile && !local && <div className="bx-vazio">Entre na sua conta pra ver suas apostas.<br /><button className="bx-apostar" onClick={pedirConta}>Entrar</button></div>}
          {(profile || local) && !st?.minhas?.length && <div className="bx-vazio">Você ainda não apostou.</div>}
          {(st?.minhas || []).map(m => <div key={m.id} className={'bx-ap ' + m.status}>
            <div><b>{descreve(m)}</b><small>{POS[m.pos]} · sorteio {diaTxt(m.hora, agora).toLowerCase()} {local ? '' : horaTxt(m.hora)}</small></div>
            <span>{m.status === 'aberta' ? <>💰 {fx(m.valor)}<small>aguardando</small></> : m.status === 'ganhou' ? <>✅ +{fx(m.ganho)}<small>apostou {fx(m.valor)}</small></> : <>❌ {fx(m.valor)}<small>não deu</small></>}</span>
          </div>)}
        </div>}

        {aba === 'resultados' && <div className="bx-lista">
          {!st?.resultados?.length && <div className="bx-vazio">Ainda não teve sorteio.</div>}
          {(st?.resultados || []).filter(r => r.premios.length).map(r => <div key={r.id} className="bx-res">
            <div className="bx-rtit">{diaTxt(r.hora, agora)} · {local ? new Date(r.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : horaTxt(r.hora)}</div>
            {r.premios.map((m, i) => { const b = bicho(grupoDe(m)); return <div key={i} className="bx-rl"><span>{i + 1}º</span><b>{String(m).padStart(4, '0')}</b><i>{b.em}</i><em>{b.nome}</em><small>{String(b.g).padStart(2, '0')}</small></div>; })}
          </div>)}
        </div>}
      </div>

      {aviso && <div className={'bx-aviso' + (aviso.bom ? ' bom' : '')}>{aviso.t}</div>}
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Sorteios todo dia às <b>{HORARIOS.map(h => h + 'h').join(', ')}</b> (horário de Brasília). As apostas fecham 1 minuto antes. Cada sorteio tem <b>5 prêmios</b> (milhares de 0000 a 9999).</p>
          <p>• <b>Grupo:</b> acerta o bicho (as 2 últimas dezenas da milhar) e ganha <b>18x</b>. <b>Dezena</b> paga <b>60x</b>, <b>centena 600x</b> e <b>milhar 4.000x</b>.</p>
          <p>• <b>Na cabeça</b> vale só o 1º prêmio. <b>Do 1º ao 5º</b> vale qualquer um dos 5 prêmios, pagando 1/5 do valor por prêmio que acertar.</p>
          <p>• Até <b>{MAX_POR_SORTEIO} fichas</b> por sorteio e prêmio máximo de <b>{fx(PREMIO_MAXIMO)} fichas</b> por aposta.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>{local ? '🧪 MODO TESTE · sorteio a cada 2 minutos · fichas de mentira · ' : ''}Sorteio próprio da Casa de Jogos. Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.bx{overflow:hidden;display:flex;flex-direction:column}
.bx-top{display:flex;align-items:center;gap:6px;padding:8px 10px 4px;min-width:0}
.bx-logo{font:700 clamp(17px,5vw,28px) Oswald;color:#fff;font-style:italic;letter-spacing:.3px;margin-right:auto;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.bx-logo b{color:var(--gold)}
.bx-top .rbtn{width:40px;height:40px;font-size:18px;flex:none}
.bx-top .bx-volta{width:auto;padding:0 12px;border-radius:20px;font:700 15px Oswald;gap:4px;display:flex;align-items:center;background:linear-gradient(180deg,#3a3326,#1d1810)}
.bx-saldo{flex:none;display:flex;align-items:center;gap:5px;border:1px solid #4ade8088;background:#0008;color:#fff;border-radius:20px;padding:4px 4px 4px 10px;font:600 16px Oswald;cursor:pointer}
.bx-saldo i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#22c55e;font:700 15px Rubik}
.bx-prox{margin:4px 12px 6px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:16px;color:#fff;border:2px solid #fde68a99;
  background:repeating-linear-gradient(120deg,#ffffff10 0 14px,transparent 14px 34px),linear-gradient(135deg,#16a34a,#065f2c 60%,#033d1c);box-shadow:0 6px 16px #0008}
.bx-prox small{display:block;font:500 12px Rubik;opacity:.85}
.bx-prox b{font:700 22px Oswald;font-style:italic;text-transform:capitalize}
.bx-conta{text-align:right}.bx-conta b{color:#fde047;font-style:normal;font-variant-numeric:tabular-nums}
.bx-abas{display:flex;gap:6px;padding:0 12px 6px}
.bx-abas button{flex:1;border:1px solid #ffffff22;background:#0006;color:#d6cbb3;border-radius:12px;padding:8px 4px;font:600 15px Rubik;position:relative}
.bx-abas button.on{background:linear-gradient(180deg,#facc15,#d97706);color:#1a1206;border-color:#fde68a}
.bx-abas i{font-style:normal;position:absolute;top:-6px;right:6px;background:#ef4444;color:#fff;border-radius:10px;font:700 11px Rubik;padding:1px 6px}
.bx-corpo{flex:1;min-height:0;overflow-y:auto;padding:2px 12px 14px}
.bx-tipos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.bx-tipos button{border:1px solid #ffffff22;background:#1f1a12;color:#fff;border-radius:12px;padding:7px 2px;display:flex;flex-direction:column;align-items:center;gap:1px}
.bx-tipos b{font:700 15px Oswald}.bx-tipos small{font:500 11px Rubik;color:#fde047}
.bx-tipos button.on{background:linear-gradient(180deg,#a855f7,#6d28d9);border-color:#e9d5ff}
.bx-pos{display:flex;gap:6px;margin:6px 0}
.bx-pos button{flex:1;border:1px solid #ffffff22;background:#1f1a12;color:#d6cbb3;border-radius:10px;padding:7px 4px;font:500 13px Rubik}
.bx-pos button.on{background:#fde04722;border-color:#fde047;color:#fde047;font-weight:600}
.bx-grade{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.bx-grade button{position:relative;border:1.5px solid #ffffff1f;background:linear-gradient(180deg,#2a241b,#17130d);color:#fff;border-radius:12px;padding:14px 1px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0}
.bx-grade .bx-n{position:absolute;top:2px;left:5px;font:700 10px Oswald;color:#fde047}
.bx-grade i{font-style:normal;font-size:26px;line-height:1.1}
.bx-grade b{font:600 10.5px Rubik;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.bx-grade small{font:400 8.5px Rubik;color:#a8a29e;letter-spacing:-.2px}
.bx-grade button.on{border-color:#fde047;background:linear-gradient(180deg,#854d0e,#422006);box-shadow:0 0 0 2px #fde04766}
.bx-num{display:flex;flex-direction:column;gap:8px}
.bx-visor{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;border-radius:14px;background:#0008;border:1px solid #ffffff22;flex-wrap:wrap}
.bx-visor span{width:48px;height:58px;display:grid;place-items:center;border-radius:10px;background:#1f1a12;border:2px solid #ffffff22;font:700 34px Oswald;color:#78716c}
.bx-visor span.on{color:#fff;border-color:#fde047}
.bx-visor em{width:100%;text-align:center;font:500 14px Rubik;color:#fde047;font-style:normal}
.bx-tecla{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.bx-tecla button{border:1px solid #ffffff22;background:linear-gradient(180deg,#2a241b,#17130d);color:#fff;border-radius:12px;padding:10px 0;font:700 22px Oswald}
.bx-valor{display:flex;align-items:center;gap:5px;margin-top:8px;flex-wrap:wrap}
.bx-valor span{font:500 13px Rubik;color:#d6cbb3;margin-right:2px}
.bx-valor button{flex:1;min-width:34px;border:1px solid #ffffff22;background:#1f1a12;color:#fff;border-radius:10px;padding:7px 0;font:700 15px Oswald}
.bx-valor button.on{background:linear-gradient(180deg,#facc15,#d97706);color:#1a1206;border-color:#fde68a}
.bx-premio{margin:8px 0 6px;text-align:center;font:500 14px Rubik;color:#e7e5e4}
.bx-premio b{color:#4ade80}.bx-premio small{color:#a8a29e}
.bx-apostar{width:100%;border:none;border-radius:14px;background:linear-gradient(180deg,#22c55e,#15803d);color:#fff;font:700 16px Oswald;padding:13px 8px;box-shadow:0 4px 0 #0007;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bx-apostar:disabled{opacity:.55}
.bx-regras{display:block;margin:10px auto 0;border:none;background:none;color:#fde047;font:600 14px Rubik;text-decoration:underline}
.bx-lista{display:flex;flex-direction:column;gap:8px}
.bx-vazio{text-align:center;color:#a8a29e;font:500 14px Rubik;padding:30px 10px;display:flex;flex-direction:column;gap:12px;align-items:center}
.bx-ap{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:10px 12px;border-radius:14px;background:#1f1a12;border:1px solid #ffffff1f;color:#fff}
.bx-ap b{font:600 15px Rubik}.bx-ap small{display:block;font:400 12px Rubik;color:#a8a29e}
.bx-ap>span{text-align:right;font:700 16px Oswald;white-space:nowrap}
.bx-ap.ganhou{border-color:#4ade80aa;background:#14532d55}.bx-ap.ganhou>span{color:#4ade80}
.bx-ap.perdeu>span{color:#f87171}
.bx-res{border-radius:14px;background:#1f1a12;border:1px solid #ffffff1f;overflow:hidden}
.bx-rtit{background:linear-gradient(90deg,#854d0e,#422006);color:#fde047;font:700 15px Oswald;padding:6px 12px;text-transform:capitalize}
.bx-rl{display:flex;align-items:center;gap:10px;padding:5px 12px;border-top:1px solid #ffffff12;color:#fff}
.bx-rl span{width:24px;font:600 13px Rubik;color:#a8a29e}
.bx-rl b{font:700 20px Oswald;letter-spacing:2px;width:64px;font-variant-numeric:tabular-nums}
.bx-rl i{font-style:normal;font-size:22px}
.bx-rl em{flex:1;font:500 14px Rubik;font-style:normal}
.bx-rl small{font:600 12px Oswald;color:#fde047}
.bx-aviso{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:30;background:#000e;border:1px solid #f87171;border-radius:14px;padding:9px 14px;font:500 14px Rubik;color:#fff;max-width:92vw;text-align:center}
.bx-aviso.bom{border-color:#4ade80}
`}</style>
    </div>
  );
}
