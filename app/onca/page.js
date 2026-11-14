'use client';
// ONÇA DA SORTE: caça-níquel 3x3, 5 linhas, onça coringa, tela cheia x10 e Rodada da Onça.
// O sorteio e o pagamento são feitos no servidor (/api/onca). No link de teste sem login, sorteia no celular.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { OncaDefs, Icone, Rosto } from '../../components/OncaIcones.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { SIMBOLOS, LINHAS, APOSTAS, MULT_CHEIA, RETORNO, VAZIO, gira, premio } from '../../lib/onca.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
const fichas = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const f2 = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aleat = () => 1 + Math.floor(Math.random() * (SIMBOLOS.length - 1));
const espera = ms => new Promise(r => setTimeout(r, ms));
const coluna = (g, c) => [g[c], g[c + 3], g[c + 6]];
const MSGS = ['Ganhe até 1700x!', 'Rodada da Onça: ganho garantido!', 'Tela cheia multiplica por x10!', 'A onça é coringa!', 'Faça 3 iguais numa das 5 linhas'];
const PONTO = c => [16.67 + (c % 3) * 33.33, 16.67 + Math.floor(c / 3) * 33.33];

export default function Onca() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: false });
  const local = TESTE && !profile;
  const [maior, setMaior] = useState(true);   // +18 confirmado no cadastro
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [grade, setGrade] = useState([3, 2, 6, 5, 0, 4, 7, 1, 6]);
  const [tiras, setTiras] = useState([null, null, null]);   // por coluna: { simb: [...], y, dur }
  const [rodando, setRodando] = useState(false);
  const [res, setRes] = useState(null);
  const [rodada, setRodada] = useState(null);                // símbolo da Rodada da Onça
  const [intro, setIntro] = useState(null);
  const [presas, setPresas] = useState(new Set());
  const [caindo, setCaindo] = useState({ n: 0, cel: new Set() });
  const [grande, setGrande] = useState(null);
  const [aposta, setAposta] = useState(5);
  const [coins, setCoins] = useState(null);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState(0);
  useEffect(() => { const t = setInterval(() => setMsg(m => (m + 1) % MSGS.length), 3500); return () => clearInterval(t); }, []);
  const ocupado = useRef(false), autoRef = useRef(0), testeCoins = useRef(1000), gradeRef = useRef(grade), coinsRef = useRef(null), turboRef = useRef(false), apostaRef = useRef(5);
  autoRef.current = auto; gradeRef.current = grade; coinsRef.current = coins; turboRef.current = turbo; apostaRef.current = aposta;

  useEffect(() => { setSom(soundOn()); try { setMaior(true); } catch { setMaior(false); } }, []);
  useEffect(() => { if (profile) setCoins(Number(profile.coins) || 0); else if (local) setCoins(testeCoins.current); }, [profile?.coins, local]); // eslint-disable-line

  // rolos descendo: cada coluna é uma fita que desce até parar no resultado
  async function rolar(final) {
    const t = turboRef.current;
    const durs = t ? [450, 560, 670] : [950, 1250, 1550];
    const novas = [0, 1, 2].map(c => {
      const ant = coluna(gradeRef.current, c), fim = coluna(final, c);
      const meio = Array.from({ length: (t ? 8 : 14) + c * (t ? 3 : 5) }, aleat);
      const simb = [...fim, ...meio, ...ant];
      return { simb, y: -(simb.length - 3) / simb.length * 100, dur: 0 };
    });
    setTiras(novas);
    await espera(40);
    setTiras(novas.map((x, c) => ({ ...x, y: 0, dur: durs[c] })));
    for (let c = 0; c < 3; c++) {
      await espera(c ? durs[c] - durs[c - 1] : durs[0]);
      sfx('tick');
      setGrade(g => g.map((s, i) => i % 3 === c ? final[i] : s));
      setTiras(tv => tv.map((x, i) => i === c ? null : x));
    }
  }

  async function rodar() {
    if (ocupado.current) return;
    const ap = apostaRef.current;
    if (coinsRef.current != null && coinsRef.current < ap) { setErro('Fichas insuficientes'); setAuto(0); sfx('err'); return; }
    ocupado.current = true; setRodando(true); setErro(''); setRes(null); setPresas(new Set()); setRodada(null);
    setCoins(c => c == null ? c : Math.round((c - ap) * 100) / 100);
    sfx('card');
    let r;
    try {
      if (local) {
        const g = gira(Math.random), ganho = premio(ap, g.mult);
        testeCoins.current = Math.round((testeCoins.current - ap + ganho) * 100) / 100;
        r = { ...g, ganho, coins: testeCoins.current };
      } else r = await api('/api/onca', { aposta: ap });
    } catch (e) {
      setErro(e.message || 'Erro'); sfx('err'); setAuto(0); ocupado.current = false; setRodando(false);
      if (profile) setCoins(Number(profile.coins) || 0); return;
    }
    if (r.rodada) {
      setIntro(r.rodada); sfx('turn'); await espera(turboRef.current ? 900 : 1600); setIntro(null);
      setRodada(r.rodada);
      await rolar(r.passos[0]);
      let ant = r.passos[0];
      setPresas(new Set(ant.map((s, i) => s !== VAZIO ? i : -1).filter(i => i >= 0)));
      for (let k = 1; k < r.passos.length; k++) {
        await espera(turboRef.current ? 350 : 650);
        const p = r.passos[k], novas = new Set(p.map((s, i) => ant[i] === VAZIO && s !== VAZIO ? i : -1).filter(i => i >= 0));
        setCaindo(cv => ({ n: cv.n + 1, cel: novas }));
        setGrade(p.slice());
        if (novas.size) sfx('tick');
        setPresas(new Set(p.map((s, i) => s !== VAZIO ? i : -1).filter(i => i >= 0)));
        ant = p;
      }
      await espera(300);
    } else await rolar(r.grade);
    setGrade(r.grade);
    setCoins(r.coins);
    setRes(r);
    if (r.ganho > 0) {
      sfx(r.mult >= 5 ? 'win' : 'coin');
      try { navigator.vibrate && navigator.vibrate(r.cheia ? [80, 60, 80, 60, 200] : 60); } catch {}
      if (r.cheia || r.mult >= 10) setGrande({ valor: r.ganho, cheia: r.cheia });
    }
    if (!local) reloadProfile && reloadProfile();
    ocupado.current = false; setRodando(false);
    if (autoRef.current > 0) {
      const falta = autoRef.current - 1; setAuto(falta);
      if (falta > 0) setTimeout(rodar, (r.cheia || r.mult >= 10) ? 4200 : r.ganho > 0 ? (turboRef.current ? 800 : 1400) : (turboRef.current ? 250 : 500));
    }
  }

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>🐆 ONÇA DA SORTE</h2>
      <p>Jogo só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('on_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/jogos/cassino')}>Voltar</button>
    </div></div></div>
  );

  const ganhas = new Set((res?.linhas || []).flatMap(l => LINHAS[l.linha]));
  const idx = APOSTAS.indexOf(aposta);
  return (
    <div className="page lounge onp">
      <OncaDefs />
      <div className="on-cel-tela">
        <div className="on-top">
          <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/cassino')}>↩</button>
          <div className="on-logo">ONÇA DA SORTE</div>
          <button className="rbtn" title="Prêmios" onClick={() => setRegras(true)}>📖</button>
          <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        </div>
        <div className="on-cena">
          <div className="on-arco" />
          <div className={'on-masc' + (res && res.ganho > 0 ? ' feliz' : '') + (rodada || intro != null ? ' rodada' : '')}><svg viewBox="0 0 100 100"><Rosto grande={!!(res && res.ganho > 0) || !!rodada || intro != null} /></svg></div>
          <div className={'on-x10' + (rodada || intro != null ? ' on' : '')}>x{MULT_CHEIA}</div>
        </div>
        <div className="on-maq">
          <div className="on-pilar">{[4, 2, 1, 3, 5].map(n => <i key={n}>{n}</i>)}</div>
          <div className="on-grade">
            {[0, 1, 2].map(c => (
              <div key={c} className={'on-col' + (rodada && c !== 1 && rodando ? ' fundo' : '')}>
                {tiras[c] ? (
                  <div className="on-tira" style={{ transform: `translateY(${tiras[c].y}%)`, transition: tiras[c].dur ? `transform ${tiras[c].dur}ms cubic-bezier(.18,.62,.28,1.07)` : 'none', height: `${tiras[c].simb.length * 100 / 3}%` }}>
                    {tiras[c].simb.map((s, k) => <div key={k} className="on-cel"><Icone s={s} /></div>)}
                  </div>
                ) : [0, 1, 2].map(rw => {
                  const i = rw * 3 + c, s = grade[i];
                  const cls = 'on-cel' + (ganhas.has(i) ? ' ganha' : '') + (res && res.ganho > 0 && !ganhas.has(i) ? ' apaga' : '') + (presas.has(i) && rodada ? ' presa' : '') + (caindo.cel.has(i) ? ' cai' : '');
                  return <div key={rw + '-' + (caindo.cel.has(i) ? caindo.n : 0)} className={cls}><Icone s={s} /></div>;
                })}
              </div>))}
            {res && res.linhas.length > 0 && <svg className="on-linhas" viewBox="0 0 100 100" preserveAspectRatio="none">
              {res.linhas.map((l, k) => { const [a, , c] = LINHAS[l.linha].map(PONTO); const d = l.linha === 3 ? 10 : l.linha === 4 ? -10 : 0; return <line key={k} x1={a[0] - 10} y1={a[1] - d} x2={c[0] + 10} y2={c[1] + d} />; })}
            </svg>}
            {intro != null && <div className="on-intro"><b>RODADA DA ONÇA!</b><div className="on-intro-s"><Icone s={intro} /></div><small>ganho garantido</small></div>}
          </div>
          <div className="on-pilar">{[4, 2, 1, 3, 5].map(n => <i key={n}>{n}</i>)}</div>
        </div>
        <div className={'on-barra' + (res && res.ganho > 0 ? ' ganhou' : '')}>
          {erro ? <span style={{ color: '#fecaca' }}>{erro}</span>
            : res && res.ganho > 0 ? <span>Ganho <b>{f2(res.ganho)}</b></span>
            : rodada && rodando ? <span>Rodada da Onça · só <span className="on-mini-ic"><Icone s={rodada} /></span> e coringa</span>
            : <span className="on-letreiro" key={msg}>{MSGS[msg]}</span>}
        </div>
        <div className="on-info">
          <div><i>💰</i><b>{coins == null ? '–' : f2(coins)}</b>{local && <small>teste</small>}</div>
          <div><i>🎯</i><b>{f2(aposta)}</b></div>
          <div><i>🏆</i><b>{res ? f2(res.ganho) : '0,00'}</b></div>
        </div>
        <div className="on-bts">
          <button className={'on-mini' + (turbo ? ' on' : '')} title="Turbo" onClick={() => setTurbo(!turbo)}>⚡</button>
          <button className="on-menos" disabled={rodando || auto > 0 || idx <= 0} onClick={() => setAposta(APOSTAS[idx - 1])}>−</button>
          <button className={'on-gira' + (rodando ? ' rodando' : '')} disabled={rodando || auto > 0} onClick={rodar}><span>↻</span></button>
          <button className="on-menos" disabled={rodando || auto > 0 || idx >= APOSTAS.length - 1} onClick={() => setAposta(APOSTAS[idx + 1])}>+</button>
          <button className={'on-mini' + (auto ? ' on' : '')} title="Automático" onClick={() => { if (auto) setAuto(0); else { setAuto(10); setTimeout(rodar, 50); } }}>{auto ? auto : '🔁'}</button>
        </div>
      </div>
      {grande && <div className="on-grande" onClick={() => setGrande(null)}><GrandeGanho {...grande} onFim={() => setGrande(null)} /></div>}
      {regras && <Modal onClose={() => setRegras(false)}><h2>Prêmios</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Faça <b>3 iguais</b> numa das <b>5 linhas</b> (3 de lado e 2 diagonais). A <b>onça</b> é coringa: vale por qualquer símbolo.</p>
          <div className="on-tab">{SIMBOLOS.map((s, i) => <div key={s.id}><span className="on-tab-ic"><Icone s={i} /><Icone s={i} /><Icone s={i} /></span><b>{s.paga}x</b></div>)}</div>
          <p>• O prêmio é a aposta vezes o valor da tabela, somando as linhas que acertar.</p>
          <p>• <b>Tela cheia</b> com o mesmo símbolo (contando a onça) multiplica tudo por <b>{MULT_CHEIA}</b>.</p>
          <p>• <b>Rodada da Onça</b>: de surpresa a onça escolhe um símbolo e os rolos giram só com ele e o coringa. O que encaixa fica preso até sair um prêmio.</p>
          <p>• Em média o jogo devolve {Math.round(RETORNO * 100)}% do que é apostado.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.onp{overflow:hidden!important;height:100dvh;background:#3b0a0a;align-items:center}
.on-cel-tela{position:relative;height:100%;width:100%;max-width:min(100vw,62vh);display:flex;flex-direction:column;background:linear-gradient(180deg,#b91c1c,#7f1d1d 60%,#5b0f0f);box-shadow:0 0 40px #000}
.on-top{display:flex;align-items:center;gap:6px;padding:4px 8px 0;position:relative;z-index:3}
.on-logo{flex:1;text-align:center;font:700 clamp(15px,2.6vh,22px) Oswald;color:#fde68a;font-style:italic;letter-spacing:2px;text-shadow:0 2px 0 #7c2d12}
.on-top .rbtn{width:30px;height:30px;font-size:13px}
.on-cena{position:relative;flex:0 0 19%;display:flex;justify-content:center;align-items:flex-end;overflow:hidden;background:radial-gradient(ellipse at 50% 110%,#fde68a,#f59e0b 35%,#dc2626 70%,#7f1d1d)}
.on-arco{position:absolute;left:4%;right:4%;bottom:-40%;height:150%;border-radius:50% 50% 0 0;border:7px solid #fbbf24;border-bottom:none;box-shadow:inset 0 0 0 4px #7f1d1d,0 0 0 4px #7f1d1d;background:repeating-conic-gradient(from 0deg at 50% 100%,#ffffff22 0 6deg,transparent 6deg 12deg)}
.on-masc{position:relative;height:96%;aspect-ratio:1;filter:drop-shadow(0 4px 4px #0008);z-index:1}
.on-masc svg{width:100%;height:100%}
.on-masc.feliz,.on-masc.rodada{animation:onmasc .45s 6 alternate}
@keyframes onmasc{to{transform:translateY(-6%) rotate(-7deg) scale(1.08)}}
.on-x10{position:absolute;right:16%;top:22%;font:700 clamp(20px,4vh,34px) Oswald;font-style:italic;color:#fde68a;text-shadow:0 2px 0 #b45309,0 0 8px #f59e0b;opacity:.75;z-index:2}
.on-x10.on{opacity:1;animation:onx10 .4s 6 alternate}
@keyframes onx10{to{transform:scale(1.35) rotate(-6deg)}}
.on-maq{flex:1;min-height:0;display:flex;gap:0;padding:0 4px;background:linear-gradient(180deg,#fbbf24,#b45309);border-top:4px solid #7f1d1d;border-bottom:4px solid #7f1d1d}
.on-pilar{flex:0 0 7%;display:flex;flex-direction:column;justify-content:space-around;align-items:center;background:linear-gradient(90deg,#991b1b,#dc2626,#991b1b);border-left:2px solid #fbbf24;border-right:2px solid #fbbf24}
.on-pilar i{font:700 clamp(10px,1.7vh,15px) Oswald;font-style:normal;color:#fde68a}
.on-grade{position:relative;flex:1;min-width:0;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:6px 4px}
.on-col{position:relative;overflow:hidden;border-radius:6px;background:linear-gradient(180deg,#fff4dc,#f8dcae);display:flex;flex-direction:column;box-shadow:inset 0 0 10px #b4530955;transition:filter .3s}
.on-col.fundo{filter:brightness(.92)}
.on-tira{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;will-change:transform}
.on-cel{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center;padding:8%;transition:opacity .25s}
.on-cel.ganha{animation:onpulse .5s 4 alternate;z-index:1;background:radial-gradient(circle,#fef08a99,transparent 70%)}
.on-cel.apaga{opacity:.35}
.on-cel.presa{background:radial-gradient(circle,#fde68aaa,transparent 70%)}
.on-cel.cai{animation:oncai .35s cubic-bezier(.2,.7,.3,1.2)}
@keyframes onpulse{to{transform:scale(1.13)}}
@keyframes oncai{from{transform:translateY(-110%);opacity:.3}}
.on-linhas{position:absolute;inset:6px 4px;width:calc(100% - 8px);height:calc(100% - 12px);pointer-events:none;z-index:2}
.on-linhas line{stroke:#fde047;stroke-width:1.8;stroke-linecap:round;filter:drop-shadow(0 0 2px #b45309)}
.on-intro{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(circle,#facc15ee,#b45309ee 70%);animation:onpop .4s}
.on-intro b{font:700 clamp(22px,4.5vh,38px) Oswald;font-style:italic;color:#fff;text-shadow:0 3px 0 #9a3412}
.on-intro small{font:600 clamp(13px,2.2vh,18px) Oswald;color:#7c2d12}
.on-intro-s{width:42%;aspect-ratio:1;animation:onpulse .5s infinite alternate}
@keyframes onpop{from{transform:scale(.5);opacity:0}}
.on-barra{flex:none;margin:6px 8px 0;text-align:center;font:600 clamp(14px,2.5vh,20px) Oswald;font-style:italic;color:#fde68a;background:linear-gradient(180deg,#b91c1c,#7f1d1d);border:2px solid #fbbf24;border-radius:10px;padding:4px 10px;overflow:hidden;white-space:nowrap;display:flex;align-items:center;justify-content:center;min-height:clamp(28px,4.4vh,40px)}
.on-barra b{font-size:1.2em;color:#fff}
.on-barra.ganhou{background:linear-gradient(180deg,#e879f9,#a21caf);animation:onpop .3s}
.on-letreiro{display:inline-block;animation:onletreiro 3.5s linear}
@keyframes onletreiro{0%{transform:translateX(70%);opacity:0}12%{transform:translateX(0);opacity:1}88%{transform:translateX(0);opacity:1}100%{transform:translateX(-70%);opacity:0}}
.on-mini-ic{display:inline-block;width:1.3em;height:1.3em;vertical-align:middle}
.on-info{flex:none;display:flex;gap:6px;margin:6px 8px 0}
.on-info div{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;background:#450a0a;border:1px solid #fbbf2466;border-radius:18px;padding:3px 6px;line-height:1.1}
.on-info i{font-style:normal;font-size:13px}.on-info b{font:600 clamp(13px,2.2vh,17px) Oswald;color:#fde68a}.on-info small{font:500 10px Rubik;color:#fca5a5}
.on-bts{flex:none;display:flex;align-items:center;justify-content:space-evenly;padding:6px 8px 10px}
.on-gira{width:clamp(64px,11vh,96px);height:clamp(64px,11vh,96px);border-radius:50%;border:5px solid #fbbf24;background:radial-gradient(circle at 40% 30%,#86efac,#22c55e 40%,#15803d 70%,#14532d);color:#fff;font:700 clamp(30px,5vh,46px) Rubik;box-shadow:0 0 0 3px #7f1d1d,0 6px 0 #450a0a,0 0 22px #facc1566;display:flex;align-items:center;justify-content:center}
.on-gira:active{transform:translateY(3px)}
.on-gira.rodando span{animation:ongiro .6s linear infinite;display:inline-block}
@keyframes ongiro{to{transform:rotate(360deg)}}
.on-menos{width:clamp(36px,5.5vh,46px);height:clamp(36px,5.5vh,46px);border-radius:50%;border:2px solid #fbbf24;background:#7f1d1d;color:#fde68a;font-size:24px}
.on-menos:disabled{opacity:.4}
.on-mini{width:clamp(34px,5vh,44px);height:clamp(34px,5vh,44px);border-radius:50%;border:2px solid #ffffff44;background:#0006;color:#fff;font-size:16px}
.on-mini.on{background:#ca8a04;border-color:#fde68a}
.on-grande{position:fixed;inset:0;z-index:50;background:radial-gradient(circle,#facc15ee,#b45309ee 50%,#450a0aee);display:flex;align-items:center;justify-content:center;animation:onpop .3s}
.on-tab{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:6px 0 10px}
.on-tab div{display:flex;justify-content:space-between;align-items:center;background:#0005;border-radius:8px;padding:3px 8px}
.on-tab-ic{display:flex;gap:2px}.on-tab-ic svg{width:20px;height:20px}
`}</style>
    </div>
  );
}

// tela de GRANDE GANHO: o número sobe contando
function GrandeGanho({ valor, cheia, onFim }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const passo = t => { const k = Math.min(1, (t - t0) / 2200); setV(valor * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    const fim = setTimeout(onFim, 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(fim); };
  }, []); // eslint-disable-line
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: 'min(40vw,30vh)', animation: 'onmasc .5s infinite alternate' }}><Rosto grande /></svg>
      <div style={{ font: '700 clamp(34px,9vmin,70px) Oswald', fontStyle: 'italic', color: '#fef08a', textShadow: '0 4px 0 #9a3412,0 0 20px #fff' }}>{cheia ? `TELA CHEIA x${MULT_CHEIA}` : 'GRANDE GANHO'}</div>
      <div style={{ font: '700 clamp(40px,12vmin,90px) Oswald', color: '#fff', textShadow: '0 4px 0 #b45309,0 0 24px #facc15' }}>{f2(v)}</div>
      <div style={{ font: '500 13px Rubik', color: '#fff8' }}>toque pra continuar</div>
    </div>
  );
}
