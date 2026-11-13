'use client';
// SINUCA (bola 8) contra o computador. Cada partida custa 1 ficha (cobrada no servidor: /api/treino).
// Mesa vista de cima. Arraste na mesa pra mirar; puxe a barra de força (à esquerda) pra baixo e solte pra tacar.
// Bola na mão: arraste a branca pra onde quiser. Desenho e regras nossos (lib/sinuca.js).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, Seg, toast } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';
import { sfx, soundOn, setSound, unlockAudio, audioCtx } from '../../lib/sfx.js';
import { RAIL, corBola, NOME_MODO, toc, bola, mesa, Regras, SINUCA_CSS as CSS , tacoGrad, setTaco } from '../../components/Sinuca.js';
import { itemById } from '../../lib/shop-items.js';
import { W, H, R, POCKETS, NIVEIS, MODOS, BOLINHO_JOGOS, escolhe, podeEscolher, arrumaBola, comecaLisa, newSinuca, stepSinuca, tacar, colocaBranca, podeColocar, branca, alvos, restantes, grupoDe, primeiraBola, ateTabela, jogadaComputador, computadorColoca } from '../../lib/sinuca.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
const BOTS = [['Tião', '🤠'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zeca', '🦅'], ['Dete', '🐱']];
export default function Sinuca() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  useEffect(() => { setTaco(itemById(profile?.equipped?.taco)?.colors); }, [profile?.equipped?.taco]); // eslint-disable-line
  const [level, setLevel] = useState('medio');
  const [modo, setModo] = useState('bola8');
  const [game, setGame] = useState(null);         // { id, bot, level }
  const [hud, setHud] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);
  const [semFichas, setSemFichas] = useState(false);
  const [som, setSom] = useState(true);
  const cvRef = useRef(null), boxRef = useRef(null), barRef = useRef(null), comecarRef = useRef(null);

  useEffect(() => { setSom(soundOn()); try { const l = localStorage.getItem('sn_level'); if (NIVEIS.some(x => x[0] === l)) setLevel(l); const m = localStorage.getItem('sn_modo'); if (MODOS.some(x => x[0] === m)) setModo(m); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('sn_level', level); localStorage.setItem('sn_modo', modo); } catch {} }, [level, modo]);

  async function start() {
    if ((!profile && !TESTE) || busy) return;
    if (!TESTE && (profile.coins || 0) < 1) return setSemFichas(true);
    unlockAudio(); setBusy(true);
    try {
      if (!TESTE) { await api('/api/treino', { jogo: 'sinuca' }); reloadProfile && reloadProfile(); }
      setGame({ id: Date.now(), bot: BOTS[(Math.random() * BOTS.length) | 0], level, modo });
      setMsg(modo === 'lisa' ? 'Arrume as suas 5 bolas vermelhas no seu lado (metade da esquerda) e toque em COMEÇAR' : 'Você começa: arraste na mesa pra mirar e puxe a força pra tacar');
    } catch (e) { if (/fichas/i.test(e.message)) setSemFichas(true); else toast(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!game) return;
    const box = boxRef.current, cv = cvRef.current, bar = barRef.current, c = cv.getContext('2d');
    const S = newSinuca({ level: game.level, names: ['Você', game.bot[0]], modo: game.modo });
    let alive = true, raf, acc = 0, last = performance.now(), view = { s: 1, ox: 0, oy: 0, dpr: 1 };
    let ang = 0, forca = 0, puxando = false, arrastaBranca = false, mirando = false, arrastaLisa = -1;
    let bot = null;   // animação da jogada do computador { t0, de, para, forca }
    const sync = () => setHud({ modo: S.modo, jogo: S.jogo, placar: [...S.placar], turn: S.turn, grupos: [...S.grupos], naMao: S.naMao, phase: S.phase, winner: S.winner,
      rest: [0, 1].map(p => (S.grupos[p] ? restantes(S, S.grupos[p]) : 7)), mesa: S.balls.filter(b => !b.in && b.n).map(b => b.n), caidas: S.balls.filter(b => b.in && b.n).map(b => b.n) });

    function fit() {
      const r = box.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const s = Math.min(r.width / (W + RAIL * 2 + 10), r.height / (H + RAIL * 2 + 10));
      view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
    }
    fit(); const ro = new ResizeObserver(fit); ro.observe(box);
    const toMesa = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - view.ox) / view.s, (e.clientY - r.top - view.oy) / view.s]; };

    // mira inicial: na direção do triângulo
    { const cb = branca(S); ang = Math.atan2(H / 2 - cb.y, W * .72 - cb.x); }

    function events() {
      for (const e of S.events) {
        if (e.type === 'bate') toc(e.v);
        if (e.type === 'tabela') toc(.5, true);
        if (e.type === 'taco') toc(e.forca * 8);
        if (e.type === 'caiu') { toc(6, true); if (e.n === 0) setMsg('A branca caiu!'); }
        if (e.type === 'grupos') setMsg(e.p === 0 ? `Você é das ${e.g.toUpperCase()}` : `${game.bot[0]} é das ${e.g.toUpperCase()} · você é das ${e.g === 'lisas' ? 'LISTRADAS' : 'LISAS'}`);
        if (e.type === 'falta') { setMsg(e.semMao ? `${e.motivo}: passou a vez` : `Falta: ${e.motivo}. ${e.p === 0 ? `${game.bot[0]} joga com a bola na mão` : 'Bola na mão: arraste a branca pra onde quiser'}`); sfx('err'); }
        if (e.type === 'perdeu') setMsg(e.quem === 0 ? `Caiu bola sua! Vez do ${game.bot[0]}` : `${game.bot[0]} matou bola dele mesmo. Sua vez`);
        if (e.type === 'vez') setMsg(e.p === 0 ? 'Sua vez' : `Vez do ${game.bot[0]}`);
        if (e.type === 'boa') { setMsg(e.p === 0 ? (game.modo === 'lisa' ? 'Matou bola dele! Joga de novo' : 'Boa! Joga de novo') : `${game.bot[0]} encaçapou e joga de novo`); if (e.p === 0) sfx('coin'); }
        if (e.type === 'comecou') setMsg('Começou! Taque com qualquer bola vermelha pra matar as amarelas');
        if (e.type === 'jogo') { setMsg(`Jogo ${e.jogo}: ${e.winner === 0 ? 'você ganhou' : game.bot[0] + ' ganhou'} (${e.why})`); sfx(e.winner === 0 ? 'coin' : 'err'); }
        if (e.type === 'fim') { setMsg(e.winner === 0 ? `Você ganhou: ${e.why}!` : `${game.bot[0]} ganhou (${e.why})`); setTimeout(() => sfx(e.winner === 0 ? 'win' : 'lose'), 400); }
      }
      if (S.events.length) sync();
      S.events.length = 0;
    }

    function vezDoBot(now) {
      if (S.phase !== 'aim' || S.turn !== 1) { bot = null; return; }
      if (!bot) {
        if (S.naMao) computadorColoca(S);
        const j = jogadaComputador(S);
        bot = { t0: now + 650, de: ang, para: j.ang, forca: j.forca }; sync();
      }
      const k = Math.max(0, Math.min(1, (now - bot.t0) / 700));
      let d = bot.para - bot.de; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      ang = bot.de + d * (1 - Math.pow(1 - k, 3));
      const k2 = Math.max(0, Math.min(1, (now - bot.t0 - 800) / 450));
      forca = bot.forca * k2;
      if (now - bot.t0 > 1350) { tacar(S, bot.para, bot.forca); forca = 0; bot = null; }
    }

    function draw(now) {
      const { s, ox, oy, dpr } = view;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      mesa(c);
      const cb = branca(S);
      if (S.phase === 'monta') {   // bola lisa: arrumando as bolas no seu lado
        c.fillStyle = `rgba(255,255,255,${.06 + Math.sin(now / 300) * .03})`; c.fillRect(0, 0, W / 2, H);
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '600 22px Oswald, sans-serif'; c.textAlign = 'center'; c.fillText('SEU LADO', W / 4, H / 2); c.fillText('LADO DELE', W * .75, H / 2);
      }
      // área livre pra branca (bola na mão)
      if (S.phase === 'aim' && S.naMao && S.turn === 0 && !cb.in) {
        c.strokeStyle = `rgba(255,255,255,${.5 + Math.sin(now / 200) * .3})`; c.lineWidth = 2; c.setLineDash([5, 5]);
        c.beginPath(); c.arc(cb.x, cb.y, R * 2.2, 0, 7); c.stroke(); c.setLineDash([]);
      }
      // linha de mira
      if (S.phase === 'aim' && !cb.in) {
        const hit = primeiraBola(S, ang), meus = S.turn === 0 ? alvos(S, 0) : null;
        const fim = hit ? [hit.gx, hit.gy] : (() => { const p = ateTabela(S, ang); return [p.x, p.y]; })();
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cb.x, cb.y); c.lineTo(fim[0], fim[1]); c.stroke();
        c.beginPath(); c.arc(fim[0], fim[1], R, 0, 7); c.stroke();
        if (hit && S.turn === 0) {
          const nx = hit.b.x - hit.gx, ny = hit.b.y - hit.gy, d = Math.hypot(nx, ny) || 1, bom = meus.includes(hit.b);
          c.strokeStyle = bom ? 'rgba(255,255,255,.85)' : 'rgba(239,68,68,.9)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(hit.b.x, hit.b.y); c.lineTo(hit.b.x + nx / d * 130, hit.b.y + ny / d * 130); c.stroke();
          // pra onde a bola da tacada desvia depois de bater (tangente)
          const ax = Math.cos(ang), ay = Math.sin(ang), dot = ax * nx / d + ay * ny / d, tx = ax - dot * nx / d, ty = ay - dot * ny / d, tl = Math.hypot(tx, ty);
          if (tl > .05) { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hit.gx, hit.gy); c.lineTo(hit.gx + tx / tl * 60 * tl, hit.gy + ty / tl * 60 * tl); c.stroke(); }
          if (!bom) { c.beginPath(); c.moveTo(hit.b.x - 7, hit.b.y - 7); c.lineTo(hit.b.x + 7, hit.b.y + 7); c.moveTo(hit.b.x + 7, hit.b.y - 7); c.lineTo(hit.b.x - 7, hit.b.y + 7); c.stroke(); }
        }
      }
      for (const b of S.balls) if (!b.in) bola(c, b);
      if (S.modo === 'lisa' && S.phase === 'aim' && !cb.in) {   // bola escolhida pra tacar (e as outras que dá pra escolher)
        S.balls.forEach((b, i) => { if (S.turn === 0 && i !== S.sel && podeEscolher(S, i)) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, R + 4, 0, 7); c.stroke(); } });
        c.strokeStyle = `rgba(255,255,255,${.7 + Math.sin(now / 160) * .3})`; c.lineWidth = 2.5; c.beginPath(); c.arc(cb.x, cb.y, R + 5, 0, 7); c.stroke();
      }
      // taco
      if (S.phase === 'aim' && !cb.in) {
        const pux = 14 + forca * 120, dx = Math.cos(ang), dy = Math.sin(ang), L = 420;
        const x1 = cb.x - dx * (R + pux), y1 = cb.y - dy * (R + pux), x2 = x1 - dx * L, y2 = y1 - dy * L;
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 9; c.beginPath(); c.moveTo(x1 + 4, y1 + 5); c.lineTo(x2 + 4, y2 + 5); c.stroke();
        const gr = tacoGrad(c, x1, y1, x2, y2);
        c.strokeStyle = gr; c.lineWidth = 7; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      // barra de força
      const pin = bar.querySelector('i');
      if (pin) pin.style.height = (forca * 100) + '%';
    }

    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      acc = Math.min(acc + (now - last), 100); last = now;
      try {
        while (acc >= 1000 / 60) { acc -= 1000 / 60; stepSinuca(S); events(); }
        if (S.phase === 'aim' && S.turn === 1) vezDoBot(now);
        draw(now);
      } catch (e) { console.error('sinuca', e); }
    }

    // toques na mesa: mirar (ou arrastar a branca, com a bola na mão)
    function down(e) {
      if (S.phase === 'monta') {
        const [x, y] = toMesa(e);
        arrastaLisa = S.balls.findIndex(b => b.n > 100 && b.n < 200 && Math.hypot(x - b.x, y - b.y) < R * 2.4);
        if (arrastaLisa >= 0) try { cv.setPointerCapture(e.pointerId); } catch {}
        return;
      }
      if (S.phase !== 'aim' || S.turn !== 0) return;
      const [x, y] = toMesa(e), cb = branca(S);
      try { cv.setPointerCapture(e.pointerId); } catch {}
      if (S.naMao && Math.hypot(x - cb.x, y - cb.y) < R * 3) { arrastaBranca = true; return; }
      if (S.modo === 'lisa') {   // tocou numa bola sua: ela vira a bola da tacada
        const i = S.balls.findIndex((b, k) => k !== S.sel && podeEscolher(S, k) && Math.hypot(x - b.x, y - b.y) < R * 2.2);
        if (i >= 0) { escolhe(S, i); toc(.3); return; }
      }
      mirando = { a: Math.atan2(y - cb.y, x - cb.x), t: performance.now(), x: e.clientX, y: e.clientY, moveu: false };
    }
    function move(e) {
      if (S.phase === 'monta') { if (arrastaLisa >= 0) { const [x, y] = toMesa(e); arrumaBola(S, arrastaLisa, x, y); } return; }
      if (S.phase !== 'aim' || S.turn !== 0) return;
      const [x, y] = toMesa(e), cb = branca(S);
      if (arrastaBranca) { if (podeColocar(S, x, y)) colocaBranca(S, x, y); return; }
      if (mirando) {   // arrastar gira a mira em volta da bola, mais devagar que o dedo (mira fina)
        const a = Math.atan2(y - cb.y, x - cb.x); let d = a - mirando.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        if (Math.hypot(e.clientX - mirando.x, e.clientY - mirando.y) > 6) mirando.moveu = true;
        if (mirando.moveu) { ang += d * .45; mirando.a = a; }
      }
    }
    const up = e => {   // toque rápido sem arrastar: aponta direto pro lugar tocado
      if (mirando && !mirando.moveu && performance.now() - mirando.t < 350 && e && e.clientX != null) { const [x, y] = toMesa(e), cb = branca(S); ang = Math.atan2(y - cb.y, x - cb.x); }
      arrastaBranca = false; mirando = false; arrastaLisa = -1;
    };
    comecarRef.current = () => { if (comecaLisa(S)) { const b = branca(S); ang = Math.atan2(H / 2 - b.y, W * .75 - b.x); sync(); } };
    // barra de força: puxa pra baixo e solta
    let y0 = 0;
    function bDown(e) { if (S.phase !== 'aim' || S.turn !== 0) return; puxando = true; y0 = e.clientY; try { bar.setPointerCapture(e.pointerId); } catch {} e.stopPropagation(); }
    function bMove(e) { if (!puxando) return; forca = Math.max(0, Math.min(1, (e.clientY - y0) / (bar.clientHeight * .85))); }
    function bUp() { if (!puxando) return; puxando = false; if (forca > .03 && S.turn === 0) tacar(S, ang, forca); forca = 0; }
    const key = e => { if (e.code === 'ArrowLeft') ang -= .01; if (e.code === 'ArrowRight') ang += .01; if (e.code === 'Space' && S.turn === 0) { tacar(S, ang, .6); } };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    bar.addEventListener('pointerdown', bDown); bar.addEventListener('pointermove', bMove); bar.addEventListener('pointerup', bUp); bar.addEventListener('pointercancel', bUp);
    addEventListener('keydown', key);
    sync(); raf = requestAnimationFrame(loop);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      bar.removeEventListener('pointerdown', bDown); bar.removeEventListener('pointermove', bMove); bar.removeEventListener('pointerup', bUp); bar.removeEventListener('pointercancel', bUp);
      removeEventListener('keydown', key);
    };
  }, [game]); // eslint-disable-line

  /* ------------------------- MENU ------------------------- */
  if (!game) return (
    <div className="page lounge sn-menu">
      <div className="hdr"><button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/sinuca')}>↩</button>
        <div className="sn-logo">SINUCA <small>{NOME_MODO[modo]}</small></div>
        <a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a></div>
      <div className="sn-box">
        {TESTE && <p className="hint" style={{ color: '#fbbf24', textAlign: 'center' }}>🧪 MODO TESTE · sem login e sem fichas</p>}
        <div className="sn-prev">{[1, 9, 8, 3, 11].map(n => <span key={n} style={{ background: n > 8 ? `linear-gradient(#f8f6ee 22%, ${corBola(n)} 22% 78%, #f8f6ee 78%)` : corBola(n) }}><b>{n}</b></span>)}</div>
        <Seg label="Modalidade" value={modo} onChange={setModo} options={MODOS} />
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>{modo === 'bola8' ? 'Lisas x listradas. A 8 é a última.' : modo === 'lisa' ? 'Sem a branca: 5 vermelhas x 5 amarelas. Arrume as suas no seu lado e taque com elas pra matar as do outro. Quem ficar sem bolas perde.' : '3 bolas por jogo, 5 jogos. Quem matar a última ganha o jogo. Cegou ou caiu a branca: perde. Joga sempre os 5: quem ganhar mais jogos leva.'}</p>
        <Seg label="Computador" value={level} onChange={setLevel} options={NIVEIS} />
        <button className="go" disabled={(!profile && !TESTE) || busy} onClick={start}>{busy ? 'Começando…' : `🎱 Jogar · ${TESTE ? 'teste grátis' : '1 ficha'}`}</button>
        <button className="sec" onClick={() => router.push('/lobby?jogo=sinuca')}>🌐 Jogar online (1 contra 1, valendo fichas)</button>
        <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
        <p className="hint" style={{ textAlign: 'center' }}>Contra o computador: cada partida custa 1 ficha.</p>
      </div>
      {rules && <Regras onClose={() => setRules(false)} />}
      {semFichas && <Modal onClose={() => setSemFichas(false)}><h2>Sem fichas</h2>
        <p>Cada partida contra o computador custa 1 ficha. Compre fichas pra jogar.</p>
        <button className="go" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas com Pix</button>
        <button className="sec" onClick={() => setSemFichas(false)}>Fechar</button></Modal>}
      <style>{CSS}</style>
    </div>
  );

  /* ------------------------- JOGO ------------------------- */
  const h = hud || { turn: 0, grupos: [null, null], rest: [7, 7], caidas: [], phase: 'aim' };
  const bolinha = n => <span key={n} className={h.caidas.includes(n) ? 'foi' : ''} style={{ background: n > 8 && n < 100 ? `linear-gradient(#f8f6ee 22%, ${corBola(n)} 22% 78%, #f8f6ee 78%)` : corBola(n) }} />;
  const fila = p => {
    if (h.modo === 'bolinho') return <div className="sn-fila">{Array.from({ length: 5 }, (_, k) => <span key={k} className={k < h.placar[p] ? 'ganho' : 'vazio'} />)}</div>;
    const g = h.grupos[p];
    const nums = g === 'lisas' ? [1, 2, 3, 4, 5, 6, 7] : g === 'listradas' ? [9, 10, 11, 12, 13, 14, 15] : g === 'verm' ? [101, 102, 103, 104, 105] : g === 'amar' ? [201, 202, 203, 204, 205] : [];
    return <div className="sn-fila">{g ? nums.map(bolinha) : Array.from({ length: 7 }, (_, k) => <span key={k} className="vazio" />)}</div>;
  };
  const jog = p => (
    <div className={`sn-pl ${h.turn === p && h.phase === 'aim' ? 'vez' : ''} ${p ? 'dir' : ''}`}>
      <span className="av">{p ? game.bot[1] : (profile?.avatar || '😎')}</span>
      <div><b>{p ? game.bot[0] : 'Você'}{h.modo === 'bolinho' ? <small> · {h.placar[p]} jogos</small> : h.grupos[p] ? <small> · {({ verm: 'vermelhas', amar: 'amarelas' })[h.grupos[p]] || h.grupos[p]}</small> : null}</b>{fila(p)}</div>
    </div>
  );
  return (
    <div className="page sn">
      <div className="sn-top">
        <button className="rbtn" title="Voltar" onClick={() => { if (h.phase === 'over' || confirm('Sair da partida? A ficha já foi usada.')) setGame(null); }}>↩</button>
        {jog(0)}<div className="sn-vs">{h.modo === 'bolinho' ? <>JOGO<br />{Math.min(h.jogo + 1, BOLINHO_JOGOS)}/{BOLINHO_JOGOS}</> : 'VS'}</div>{jog(1)}
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
      </div>
      <div className="sn-area">
        <div className="sn-bar" ref={barRef} style={h.phase === 'monta' ? { display: 'none' } : null}><i /><span>FORÇA</span></div>
        {h.phase === 'monta' && <button className="sn-comeca" onClick={() => comecarRef.current && comecarRef.current()}>▶<b>COMEÇAR</b></button>}
        <div className="sn-mesa" ref={boxRef}><canvas ref={cvRef} /><div className="sn-msg">{msg}</div></div>
        <div className="sn-caiu">{h.caidas.slice(-12).map(n => <span key={n} style={{ background: n > 8 && n < 100 ? `linear-gradient(#f8f6ee 22%, ${corBola(n)} 22% 78%, #f8f6ee 78%)` : corBola(n) }}>{n < 100 ? <b>{n}</b> : null}</span>)}</div>
      </div>
      {h.phase === 'over' && <Modal><h2>{h.winner === 0 ? '🏆 Você ganhou!' : `${game.bot[0]} ganhou`}</h2>
        <p>{msg}</p>
        <button className="go" disabled={busy} onClick={start}>🎱 Jogar de novo · {TESTE ? 'teste grátis' : '1 ficha'}</button>
        <button className="sec" onClick={() => setGame(null)}>Voltar ao menu</button></Modal>}
      <style>{CSS}</style>
    </div>
  );
}

