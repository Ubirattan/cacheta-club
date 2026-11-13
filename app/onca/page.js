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
const PONTO = c => [16.67 + (c % 3) * 33.33, 16.67 + Math.floor(c / 3) * 33.33];

export default function Onca() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  const local = TESTE && !profile;
  const [maior, setMaior] = useState(null);
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
  const ocupado = useRef(false), autoRef = useRef(0), testeCoins = useRef(1000), gradeRef = useRef(grade), coinsRef = useRef(null), turboRef = useRef(false), apostaRef = useRef(5);
  autoRef.current = auto; gradeRef.current = grade; coinsRef.current = coins; turboRef.current = turbo; apostaRef.current = aposta;

  useEffect(() => { setSom(soundOn()); try { setMaior(localStorage.getItem('on_18') === '1'); } catch { setMaior(false); } }, []);
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
      <button className="sec" onClick={() => router.push('/jogos/onca')}>Voltar</button>
    </div></div></div>
  );

  const ganhas = new Set((res?.linhas || []).flatMap(l => LINHAS[l.linha]));
  const idx = APOSTAS.indexOf(aposta);
  return (
    <div className="page lounge onp">
      <OncaDefs />
      <div className="on-top">
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/onca')}>↩</button>
        <div className="on-logo">ONÇA DA SORTE</div>
        <button className="rbtn" title="Prêmios" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
      </div>
      <div className="on-main">
        <div className="on-maq">
          <div className="on-cab">
            <div className={'on-masc' + (res && res.ganho > 0 ? ' feliz' : '') + (rodada ? ' rodada' : '')}><svg viewBox="0 0 100 100"><Rosto grande={!!(res && res.ganho > 0) || !!rodada} /></svg></div>
            <div className="on-x10">x{MULT_CHEIA}</div>
          </div>
          <div className="on-moldura">
            <div className="on-grade">
              {[0, 1, 2].map(c => (
                <div key={c} className="on-col">
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
              {intro != null && <div className="on-intro"><svg viewBox="0 0 100 100" className="on-intro-masc"><Rosto grande /></svg><b>RODADA DA ONÇA!</b><div className="on-intro-s"><Icone s={intro} /></div></div>}
            </div>
          </div>
          <div className={'on-barra' + (res && res.ganho > 0 ? ' ganhou' : '')}>
            {erro ? <span style={{ color: '#fecaca' }}>{erro}</span>
              : res && res.ganho > 0 ? <>Ganho <b>{f2(res.ganho)}</b></>
              : rodada && rodando ? <>Rodada da Onça · só <span className="on-mini-ic"><Icone s={rodada} /></span> e coringa</>
              : 'Faça 3 iguais numa das 5 linhas'}
          </div>
        </div>
        <div className="on-ctl">
          <div className="on-info">
            <div><small>Saldo{local ? ' (teste)' : ''}</small><b>{coins == null ? '–' : fichas(coins)}</b></div>
            <div><small>Aposta</small><b>{aposta}</b></div>
            <div><small>Ganho</small><b>{res ? f2(res.ganho) : '0,00'}</b></div>
          </div>
          <div className="on-bts">
            <button className={'on-mini' + (turbo ? ' on' : '')} onClick={() => setTurbo(!turbo)}>⚡<small>Turbo</small></button>
            <button className="on-menos" disabled={rodando || auto > 0 || idx <= 0} onClick={() => setAposta(APOSTAS[idx - 1])}>−</button>
            <button className={'on-gira' + (rodando ? ' rodando' : '')} disabled={rodando || auto > 0} onClick={rodar}><span>↻</span></button>
            <button className="on-menos" disabled={rodando || auto > 0 || idx >= APOSTAS.length - 1} onClick={() => setAposta(APOSTAS[idx + 1])}>+</button>
            <button className={'on-mini' + (auto ? ' on' : '')} onClick={() => { if (auto) setAuto(0); else { setAuto(10); setTimeout(rodar, 50); } }}>{auto ? auto : '🔁'}<small>{auto ? 'Parar' : 'Auto'}</small></button>
          </div>
          <button className="on-loja" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas</button>
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
.onp{overflow:hidden!important;height:100dvh;background:radial-gradient(circle at 50% 25%,#dc2626,#7f1d1d 55%,#3b0a0a)}
.on-top{display:flex;align-items:center;gap:8px;padding:6px 10px 0}
.on-logo{flex:1;text-align:center;font:700 clamp(18px,4.6vmin,28px) Oswald;color:#fde68a;font-style:italic;letter-spacing:2px;text-shadow:0 2px 0 #7c2d12,0 0 12px #f59e0b88}
.on-top .rbtn{width:36px;height:36px;font-size:15px}
.on-main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:2px 10px 8px}
.on-maq{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center}
.on-cab{position:relative;height:clamp(54px,11vh,96px);aspect-ratio:1;margin-bottom:-14px;z-index:2}
.on-masc{width:100%;height:100%;filter:drop-shadow(0 4px 4px #0008)}
.on-masc svg{width:100%;height:100%}
.on-masc.feliz,.on-masc.rodada{animation:onmasc .5s 4 alternate}
@keyframes onmasc{to{transform:translateY(-6px) rotate(-6deg) scale(1.08)}}
.on-x10{position:absolute;left:100%;top:30%;font:700 clamp(18px,4vh,30px) Oswald;font-style:italic;color:#fde68a;text-shadow:0 2px 0 #b45309,0 0 8px #f59e0b;white-space:nowrap}
.on-moldura{flex:1;min-height:0;display:flex;justify-content:center;width:100%}
.on-grade{position:relative;height:100%;max-width:100%;aspect-ratio:1;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:10px;border-radius:24px;background:linear-gradient(180deg,#fde68a,#d97706 40%,#92400e);box-shadow:0 0 0 4px #7f1d1d,0 0 0 7px #fbbf24,0 12px 30px #000b}
.on-col{position:relative;overflow:hidden;border-radius:14px;background:linear-gradient(180deg,#fff7ed,#fde68a);display:flex;flex-direction:column;box-shadow:inset 0 0 12px #b4530966}
.on-tira{position:absolute;left:0;right:0;top:0;display:flex;flex-direction:column;will-change:transform}
.on-cel{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center;padding:9%;transition:opacity .25s}
.on-cel.ganha{animation:onpulse .55s 4 alternate;z-index:1}
.on-cel.apaga{opacity:.35}
.on-cel.presa{background:radial-gradient(circle,#fde68a,transparent 70%)}
.on-cel.cai{animation:oncai .35s cubic-bezier(.2,.7,.3,1.2)}
@keyframes onpulse{to{transform:scale(1.14)}}
@keyframes oncai{from{transform:translateY(-110%);opacity:.3}}
.on-linhas{position:absolute;inset:10px;width:calc(100% - 20px);height:calc(100% - 20px);pointer-events:none;z-index:2}
.on-linhas line{stroke:#fde047;stroke-width:2;stroke-linecap:round;filter:drop-shadow(0 0 2px #b45309)}
.on-intro{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#7f1d1dcc;border-radius:24px;animation:onpop .4s}
.on-intro b{font:700 clamp(20px,5vh,34px) Oswald;font-style:italic;color:#fde68a;text-shadow:0 2px 0 #7c2d12}
.on-intro-masc{width:38%;animation:onmasc .4s 4 alternate}
.on-intro-s{width:22%;aspect-ratio:1}
@keyframes onpop{from{transform:scale(.5);opacity:0}}
.on-barra{margin-top:10px;min-width:60%;text-align:center;font:600 clamp(14px,3.4vmin,19px) Oswald;color:#fde68a;background:linear-gradient(180deg,#991b1b,#7f1d1d);border:2px solid #fbbf24;border-radius:20px;padding:4px 16px;display:flex;align-items:center;justify-content:center;gap:6px}
.on-barra b{font-size:1.25em;color:#fff}
.on-barra.ganhou{background:linear-gradient(180deg,#d946ef,#a21caf);animation:onpop .3s}
.on-mini-ic{display:inline-block;width:22px;height:22px}
.on-ctl{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:460px}
.on-info{display:flex;gap:6px;width:100%}
.on-info div{flex:1;display:flex;flex-direction:column;align-items:center;background:#0006;border-radius:12px;padding:3px 0;line-height:1.1}
.on-info small{font:500 11px Rubik;color:#fecaca}.on-info b{font:700 17px Oswald;color:#fde68a}
.on-bts{display:flex;align-items:center;gap:12px}
.on-gira{width:82px;height:82px;border-radius:50%;border:4px solid #fde68a;background:radial-gradient(circle at 40% 30%,#4ade80,#16a34a 55%,#14532d);color:#fff;font:700 42px Rubik;box-shadow:0 6px 0 #052e16,0 10px 22px #000a;display:flex;align-items:center;justify-content:center}
.on-gira:active{transform:translateY(4px);box-shadow:0 2px 0 #052e16}
.on-gira.rodando span{animation:ongiro .6s linear infinite;display:inline-block}
@keyframes ongiro{to{transform:rotate(360deg)}}
.on-menos{width:42px;height:42px;border-radius:50%;border:2px solid #fbbf24;background:#7f1d1d;color:#fde68a;font-size:24px}
.on-menos:disabled{opacity:.4}
.on-mini{width:50px;height:50px;border-radius:50%;border:2px solid #ffffff44;background:#0007;color:#fff;font-size:17px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.on-mini small{font:500 10px Rubik}
.on-mini.on{background:#ca8a04;border-color:#fde68a}
.on-loja{border:none;background:none;color:#fecaca;font:500 12px Rubik;text-decoration:underline}
.on-grande{position:fixed;inset:0;z-index:50;background:radial-gradient(circle,#facc15ee,#b45309ee 50%,#450a0aee);display:flex;align-items:center;justify-content:center;animation:onpop .3s}
.on-tab{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:6px 0 10px}
.on-tab div{display:flex;justify-content:space-between;align-items:center;background:#0005;border-radius:8px;padding:3px 8px}
.on-tab-ic{display:flex;gap:2px}.on-tab-ic svg{width:20px;height:20px}
@media (orientation:landscape){.on-main{flex-direction:row;justify-content:center;gap:24px}.on-maq{flex:none;height:100%;width:auto}.on-ctl{width:auto;min-width:260px;align-self:center}}
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
