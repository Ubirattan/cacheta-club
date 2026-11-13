'use client';
// ONÇA DA SORTE: caça-níquel 3x3, 5 linhas, onça coringa e tela cheia x10.
// O sorteio e o pagamento são feitos no servidor (/api/onca). No link de teste sem login, sorteia no celular.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { SIMBOLOS, LINHAS, APOSTAS, MULT_CHEIA, gira, premio } from '../../lib/onca.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
const fichas = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const aleat = () => Math.floor(Math.random() * SIMBOLOS.length);
const espera = ms => new Promise(r => setTimeout(r, ms));
// pontos (em % da grade) por onde passa cada linha, pra desenhar
const PONTO = c => [16.67 + (c % 3) * 33.33, 16.67 + Math.floor(c / 3) * 33.33];

export default function Onca() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  const local = TESTE && !profile;
  const [maior, setMaior] = useState(null);
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [grade, setGrade] = useState([1, 2, 3, 4, 0, 5, 3, 2, 1]);
  const [girando, setGirando] = useState([false, false, false]);
  const [res, setRes] = useState(null);
  const [aposta, setAposta] = useState(5);
  const [coins, setCoins] = useState(null);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [erro, setErro] = useState('');
  const ocupado = useRef(false), autoRef = useRef(0), testeCoins = useRef(1000);
  autoRef.current = auto;

  useEffect(() => { setSom(soundOn()); try { setMaior(localStorage.getItem('on_18') === '1'); } catch { setMaior(false); } }, []);
  useEffect(() => { if (profile) setCoins(Number(profile.coins) || 0); else if (local) setCoins(testeCoins.current); }, [profile?.coins, local]); // eslint-disable-line

  // gira as colunas enquanto espera o servidor
  useEffect(() => {
    if (!girando.some(Boolean)) return;
    const t = setInterval(() => setGrade(g => g.map((s, i) => girando[i % 3] ? aleat() : s)), 70);
    return () => clearInterval(t);
  }, [girando]);

  async function rodar() {
    if (ocupado.current) return;
    if (coins != null && coins < aposta) { setErro('Fichas insuficientes'); setAuto(0); sfx('err'); return; }
    ocupado.current = true; setErro(''); setRes(null);
    setCoins(c => c == null ? c : Math.round((c - aposta) * 100) / 100);
    setGirando([true, true, true]); sfx('card');
    let r;
    try {
      if (local) {
        const g = gira(Math.random), ganho = premio(aposta, g.mult);
        testeCoins.current = Math.round((testeCoins.current - aposta + ganho) * 100) / 100;
        r = { ...g, ganho, coins: testeCoins.current };
        await espera(250);
      } else r = await api('/api/onca', { aposta });
    } catch (e) {
      setGirando([false, false, false]); setErro(e.message || 'Erro'); sfx('err'); setAuto(0); ocupado.current = false;
      if (profile) setCoins(Number(profile.coins) || 0); return;
    }
    const passo = turbo ? 120 : 380;
    for (let col = 0; col < 3; col++) {
      await espera(col ? passo : passo + 150);
      setGirando(gv => gv.map((v, i) => i === col ? false : v));
      setGrade(g => g.map((s, i) => i % 3 === col ? r.grade[i] : s));
      sfx('tick');
    }
    setCoins(r.coins);
    setRes(r);
    if (r.ganho > 0) { sfx(r.mult >= 10 ? 'win' : 'coin'); try { navigator.vibrate && navigator.vibrate(r.cheia ? [80, 60, 80, 60, 200] : 60); } catch {} }
    if (!local) reloadProfile && reloadProfile();
    ocupado.current = false;
    if (autoRef.current > 0) {
      const falta = autoRef.current - 1; setAuto(falta);
      if (falta > 0) setTimeout(rodar, r.ganho > 0 ? (turbo ? 700 : 1300) : (turbo ? 250 : 500));
    }
  }

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>🐆 ONÇA DA SORTE</h2>
      <p>Jogo só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('on_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/jogos/onca')}>Voltar</button>
    </div></div></div>
  );

  const ganhas = new Set((res?.linhas || []).flatMap(l => LINHAS[l.linha]));
  const idx = APOSTAS.indexOf(aposta);
  const travado = girando.some(Boolean) || auto > 0;
  return (
    <div className="page lounge onp">
      <div className="on-top">
        <div className="on-logo">🐆 ONÇA DA SORTE</div>
        <span className="on-saldo">💰 <b>{coins == null ? '–' : fichas(coins)}</b>{local && <small> teste</small>}</span>
        <button className="rbtn" title="Prêmios" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Comprar fichas" onClick={() => router.push('/loja#comprar')}>💰</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/onca')}>↩</button>
      </div>
      <div className="on-main">
        <div className="on-maq">
          <div className="on-grade">
            {grade.map((s, i) => (
              <div key={i} className={'on-cel' + (girando[i % 3] ? ' gira' : '') + (ganhas.has(i) ? ' ganha' : '') + (res && res.ganho > 0 && !ganhas.has(i) ? ' apaga' : '') + (s === 0 ? ' onca' : '')}>
                <span>{SIMBOLOS[s].em}</span>
              </div>))}
            {res && res.linhas.length > 0 && <svg className="on-linhas" viewBox="0 0 100 100" preserveAspectRatio="none">
              {res.linhas.map((l, k) => { const [a, , c] = LINHAS[l.linha].map(PONTO); return <line key={k} x1={a[0] - 12} y1={a[1] - (l.linha === 3 ? 12 : l.linha === 4 ? -12 : 0)} x2={c[0] + 12} y2={c[1] + (l.linha === 3 ? 12 : l.linha === 4 ? -12 : 0)} />; })}
            </svg>}
            {res && res.ganho > 0 && <div className={'on-ganho' + (res.cheia ? ' cheia' : res.mult >= 10 ? ' grande' : '')}>
              {res.cheia ? <b>🐆 TELA CHEIA x{MULT_CHEIA}!</b> : res.mult >= 10 ? <b>GRANDE GANHO!</b> : null}
              <span>+{fichas(res.ganho)}</span></div>}
          </div>
        </div>
        <div className="on-ctl">
          <div className="on-msg">{erro ? <span style={{ color: '#fca5a5' }}>{erro}</span> : res ? (res.ganho > 0 ? `Ganhou ${fichas(res.ganho)} fichas (${res.mult}x)` : 'Não foi dessa vez') : '5 linhas · onça vale por qualquer símbolo'}</div>
          <div className="on-ap">
            <button disabled={travado || idx <= 0} onClick={() => setAposta(APOSTAS[idx - 1])}>−</button>
            <div><small>Aposta</small><b>{aposta}</b></div>
            <button disabled={travado || idx >= APOSTAS.length - 1} onClick={() => setAposta(APOSTAS[idx + 1])}>+</button>
          </div>
          <div className="on-bts">
            <button className={'on-mini' + (turbo ? ' on' : '')} onClick={() => setTurbo(!turbo)}>⚡<small>Turbo</small></button>
            <button className="on-gira" disabled={girando.some(Boolean) || auto > 0} onClick={rodar}>{girando.some(Boolean) ? '…' : '↻'}</button>
            <button className={'on-mini' + (auto ? ' on' : '')} onClick={() => { if (auto) setAuto(0); else { setAuto(10); setTimeout(rodar, 50); } }}>{auto ? auto : '🔁'}<small>{auto ? 'Parar' : 'Auto 10'}</small></button>
          </div>
        </div>
      </div>
      <div className="on-rod">Proibido para menores de 18 anos · Fichas sem valor em dinheiro · Jogue por diversão</div>
      {regras && <Modal onClose={() => setRegras(false)}><h2>Prêmios</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Faça <b>3 iguais</b> numa das <b>5 linhas</b> (3 de lado e 2 diagonais). A <b>onça 🐆</b> vale por qualquer símbolo.</p>
          <div className="on-tab">{SIMBOLOS.map(s => <div key={s.id}><span>{s.em} {s.em} {s.em}</span><b>{s.paga}x</b></div>)}</div>
          <p>• O prêmio é a aposta vezes o valor da tabela, somando todas as linhas que acertar.</p>
          <p>• <b>Tela cheia</b> com o mesmo símbolo (contando a onça) multiplica tudo por <b>{MULT_CHEIA}</b>.</p>
          <p>• Em média o jogo devolve 95% do que é apostado.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.onp{overflow:hidden!important;height:100dvh;background:radial-gradient(circle at 50% 30%,#14532d,#052e16 60%,#021a0c)}
.on-top{display:flex;align-items:center;gap:8px;padding:6px 10px 2px}
.on-logo{font:700 clamp(18px,4.6vmin,28px) Oswald;color:#facc15;font-style:italic;letter-spacing:1px;margin-right:auto;white-space:nowrap;text-shadow:0 2px 0 #000a}
.on-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #facc1588;border-radius:20px;padding:3px 10px;white-space:nowrap}
.on-saldo small{color:#fca5a5;font:500 11px Rubik}
.on-top .rbtn{width:36px;height:36px;font-size:15px}
.on-main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:4px 10px}
.on-maq{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
.on-grade{position:relative;height:100%;max-height:min(100%,92vw);aspect-ratio:1;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px;border-radius:22px;background:linear-gradient(180deg,#f59e0b,#b45309);box-shadow:0 0 0 4px #78350f,0 10px 30px #000a,inset 0 2px 0 #fde68a}
.on-cel{background:radial-gradient(circle at 50% 35%,#fffbeb,#fde68a 70%,#f59e0b);border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 -4px 0 #0002;transition:opacity .2s,transform .2s}
.on-cel span{font-size:min(9vh,12vw,64px);line-height:1;filter:drop-shadow(0 3px 2px #0005)}
.on-cel.gira span{filter:blur(1.5px);transform:translateY(4px)}
.on-cel.onca{background:radial-gradient(circle at 50% 35%,#fef9c3,#facc15 60%,#ca8a04)}
.on-cel.ganha{animation:onpulse .6s 3 alternate;box-shadow:0 0 0 3px #fff,0 0 18px #facc15}
.on-cel.apaga{opacity:.45}
@keyframes onpulse{to{transform:scale(1.08)}}
.on-linhas{position:absolute;inset:8px;width:calc(100% - 16px);height:calc(100% - 16px);pointer-events:none}
.on-linhas line{stroke:#ef4444;stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 0 2px #fff)}
.on-ganho{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;background:#000c;border:2px solid #facc15;border-radius:18px;padding:6px 18px;pointer-events:none;animation:onpop .35s}
.on-ganho span{font:700 clamp(24px,7vmin,44px) Oswald;color:#facc15}
.on-ganho b{font:700 clamp(14px,3.6vmin,22px) Oswald;color:#fff}
.on-ganho.cheia,.on-ganho.grande{border-color:#fff;box-shadow:0 0 30px #facc15}
@keyframes onpop{from{transform:translate(-50%,-50%) scale(.4)}}
.on-ctl{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:460px}
.on-msg{font:500 14px Rubik;color:#dcfce7;text-align:center;min-height:18px}
.on-ap{display:flex;align-items:center;gap:10px;background:#0007;border-radius:30px;padding:4px}
.on-ap button{width:40px;height:40px;border-radius:50%;border:none;background:#166534;color:#fff;font-size:22px}
.on-ap button:disabled{opacity:.4}
.on-ap div{min-width:80px;display:flex;flex-direction:column;align-items:center;line-height:1}
.on-ap small{font:500 11px Rubik;color:#bbf7d0}.on-ap b{font:700 22px Oswald;color:#fff}
.on-bts{display:flex;align-items:center;gap:22px}
.on-gira{width:84px;height:84px;border-radius:50%;border:4px solid #fde68a;background:radial-gradient(circle at 40% 30%,#4ade80,#15803d 70%);color:#fff;font:700 40px Rubik;box-shadow:0 6px 0 #064e3b,0 10px 22px #000a}
.on-gira:active{transform:translateY(4px);box-shadow:0 2px 0 #064e3b}
.on-gira:disabled{filter:grayscale(.3) brightness(.85)}
.on-mini{width:56px;height:56px;border-radius:50%;border:2px solid #ffffff44;background:#0008;color:#fff;font-size:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.on-mini small{font:500 10px Rubik}
.on-mini.on{background:#ca8a04;border-color:#fde68a}
.on-rod{font:400 10px Rubik;color:#86efac99;text-align:center;padding:0 0 6px}
.on-tab{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:6px 0 10px}
.on-tab div{display:flex;justify-content:space-between;background:#0005;border-radius:8px;padding:3px 8px}
@media (orientation:landscape){.on-main{flex-direction:row;gap:24px}.on-maq{flex:none;height:100%;width:auto}.on-ctl{width:auto;min-width:240px}}
@media (orientation:landscape) and (max-height:520px){.on-rod{display:none}.on-gira{width:70px;height:70px;font-size:32px}.on-mini{width:48px;height:48px}}
`}</style>
    </div>
  );
}
