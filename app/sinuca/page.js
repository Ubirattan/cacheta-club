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
import { W, H, R, POCKETS, NIVEIS, MODOS, BOLINHO_JOGOS, escolhe, podeEscolher, arrumaBola, comecaLisa, newSinuca, stepSinuca, tacar, colocaBranca, podeColocar, branca, alvos, restantes, grupoDe, primeiraBola, ateTabela, jogadaComputador, computadorColoca } from '../../lib/sinuca.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
const BOTS = [['Tião', '🤠'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zeca', '🦅'], ['Dete', '🐱']];
const RAIL = 34;                 // largura da tabela (madeira) em volta da área de jogo
const COR = { 1: '#f5c518', 2: '#1d4ed8', 3: '#dc2626', 4: '#6d28d9', 5: '#f97316', 6: '#15803d', 7: '#7f1d1d', 8: '#111' };
const corBola = n => (n > 200 ? '#facc15' : n > 100 ? '#dc2626' : COR[n > 8 ? n - 8 : n] || '#fff');
const NOME_MODO = { bola8: 'bola 8', lisa: 'bola lisa', bolinho: 'bolinho' };

/* ---------- sons da mesa (curtinhos, sintetizados) ---------- */
function toc(v, grave = false) {
  if (!soundOn()) return;
  const AC = audioCtx(); if (!AC) return;
  try {
    const t = AC.currentTime, n = AC.sampleRate * .05, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, grave ? 2 : 6);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    f.type = 'bandpass'; f.frequency.value = grave ? 180 : 2600; f.Q.value = grave ? 1 : 2.5;
    g.gain.setValueAtTime(Math.min(.9, .08 + v * (grave ? .5 : .05)), t);
    s.buffer = b; s.connect(f).connect(g).connect(AC.destination); s.start(t);
  } catch {}
}

/* ---------- desenho ---------- */
function bola(c, b, s = 1) {
  const r = R * s, x = b.x, y = b.y;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 2.5, y + 3, r, r * .9, 0, 0, 7); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  if (b.n === 0) { c.fillStyle = '#f8f6ee'; c.fillRect(x - r, y - r, r * 2, r * 2); }
  else if (b.n > 8 && b.n < 100) { c.fillStyle = '#f8f6ee'; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = corBola(b.n); c.fillRect(x - r, y - r * .55, r * 2, r * 1.1); }
  else { c.fillStyle = corBola(b.n); c.fillRect(x - r, y - r, r * 2, r * 2); }
  if (b.n && b.n < 100) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * .48, 0, 7); c.fill();
    c.fillStyle = '#111'; c.font = `700 ${r * .62}px Rubik, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(b.n), x, y + r * .04);
  }
  const g = c.createRadialGradient(x - r * .4, y - r * .45, r * .1, x, y, r * 1.1);
  g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.25, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
function mesa(c) {
  // madeira
  const m = c.createLinearGradient(0, -RAIL, 0, H + RAIL); m.addColorStop(0, '#5a3418'); m.addColorStop(.5, '#3d220f'); m.addColorStop(1, '#5a3418');
  c.fillStyle = m; c.beginPath(); c.roundRect ? c.roundRect(-RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2, 26) : c.rect(-RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2); c.fill();
  c.strokeStyle = '#c8901c'; c.lineWidth = 3; c.stroke();
  // pano verde
  const p = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .7); p.addColorStop(0, '#1f8a4c'); p.addColorStop(1, '#0f5a30');
  c.fillStyle = '#0c4a27'; c.fillRect(-14, -14, W + 28, H + 28);
  c.fillStyle = p; c.fillRect(0, 0, W, H);
  // marcações
  c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * .25, 0); c.lineTo(W * .25, H); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(W * .72, H / 2, 3, 0, 7); c.fill();
  // losangos na madeira
  c.fillStyle = '#e8d8a8';
  for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = W * k / 8; [[x, -RAIL / 2], [x, H + RAIL / 2]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a, b - 4); c.lineTo(a + 3, b); c.lineTo(a, b + 4); c.lineTo(a - 3, b); c.fill(); }); }
  for (let k = 1; k < 4; k++) { const y = H * k / 4; [[-RAIL / 2, y], [W + RAIL / 2, y]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a, b - 4); c.lineTo(a + 3, b); c.lineTo(a, b + 4); c.lineTo(a - 3, b); c.fill(); }); }
  // caçapas
  for (const [x, y] of POCKETS) {
    c.fillStyle = '#2b1606'; c.beginPath(); c.arc(x, y, 27, 0, 7); c.fill();
    c.fillStyle = '#050505'; c.beginPath(); c.arc(x, y, 21, 0, 7); c.fill();
  }
}

export default function Sinuca() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
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
        const gr = c.createLinearGradient(x1, y1, x2, y2); gr.addColorStop(0, '#f1e6c8'); gr.addColorStop(.03, '#f1e6c8'); gr.addColorStop(.035, '#1e3a8a'); gr.addColorStop(.06, '#1e3a8a'); gr.addColorStop(.065, '#d9b26f'); gr.addColorStop(.6, '#a8692e'); gr.addColorStop(.62, '#111'); gr.addColorStop(1, '#3a1d0a');
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
      <div className="hdr"><button className="rbtn" title="Voltar" onClick={() => router.push('/')}>↩</button>
        <div className="sn-logo">SINUCA <small>{NOME_MODO[modo]}</small></div>
        <a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a></div>
      <div className="sn-box">
        {TESTE && <p className="hint" style={{ color: '#fbbf24', textAlign: 'center' }}>🧪 MODO TESTE · sem login e sem fichas</p>}
        <div className="sn-prev">{[1, 9, 8, 3, 11].map(n => <span key={n} style={{ background: n > 8 ? `linear-gradient(#f8f6ee 22%, ${corBola(n)} 22% 78%, #f8f6ee 78%)` : corBola(n) }}><b>{n}</b></span>)}</div>
        <Seg label="Modalidade" value={modo} onChange={setModo} options={MODOS} />
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>{modo === 'bola8' ? 'Lisas x listradas. A 8 é a última.' : modo === 'lisa' ? 'Sem a branca: 5 vermelhas x 5 amarelas. Arrume as suas no seu lado e taque com elas pra matar as do outro. Quem ficar sem bolas perde.' : '3 bolas por jogo, 5 jogos. Quem matar a última ganha o jogo. Cegou ou caiu a branca: perde. Joga sempre os 5: quem ganhar mais jogos leva.'}</p>
        <Seg label="Computador" value={level} onChange={setLevel} options={NIVEIS} />
        <button className="go" disabled={(!profile && !TESTE) || busy} onClick={start}>{busy ? 'Começando…' : `🎱 Jogar · ${TESTE ? 'teste grátis' : '1 ficha'}`}</button>
        <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
        <p className="hint" style={{ textAlign: 'center' }}>Contra o computador. Cada partida custa 1 ficha.</p>
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

function Regras({ onClose }) {
  return (
    <Modal onClose={onClose}><h2>Como jogar</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• <b>Mirar:</b> arraste o dedo na mesa. A linha mostra onde a branca bate e pra onde a bola vai.</p>
        <p>• <b>Tacar:</b> puxe a barra de <b>FORÇA</b> (à esquerda) pra baixo e solte. Quanto mais puxa, mais forte.</p>
        <p><b>Bola 8:</b></p><p>• <b>Lisas (1 a 7) x listradas (9 a 15):</b> quem encaçapar primeiro depois da saída fica com aquele grupo.</p>
        <p>• Encaçapou uma bola sua: <b>joga de novo</b>.</p>
        <p>• <b>Falta</b> (branca na caçapa, não encostar em nada ou bater primeiro na bola do outro): o adversário joga com a <b>bola na mão</b> e coloca a branca onde quiser.</p>
        <p>• <b>A 8 é a última.</b> Matou a 8 depois de limpar as suas: ganhou. Matou antes da hora: perdeu.</p>
        <p><b>Bola lisa:</b> sem a branca. Você é das vermelhas, o computador das amarelas. Antes de começar, cada um arruma as suas 5 bolas onde quiser, no seu lado da mesa (você arrasta as suas na metade da esquerda). Depois de COMEÇAR ninguém mexe mais. Na sua vez, toque em qualquer bola vermelha e taque com ela pra <b>matar as amarelas</b>. Matou bola dele: joga de novo. Se cair bola sua, você perdeu ela. Quem ficar sem bolas perde.</p>
        <p><b>Bolinho:</b> 3 bolas na mesa por jogo (são 5 jogos com as 15 bolas). Quem matar a última ganha o jogo. Se cegar (não encostar em nenhuma) ou a branca cair, perde o jogo. Sempre se jogam os 5 jogos: quem ganhar mais leva a partida.</p>
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

const CSS = `
.sn-menu .hdr{align-items:center}
.sn-logo{font:700 clamp(24px,5.6vmin,40px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;text-align:center;flex:1}
.sn-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:6px}
.sn-box{margin:auto;width:min(420px,94vw);background:radial-gradient(circle at 50% 0%,#1f8a4c,#0b3d22);border:3px solid #5a3418;outline:2px solid var(--gold2);border-radius:20px;padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.sn-prev{display:flex;justify-content:center;gap:6px;margin:4px 0}
.sn-prev span{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset -4px -5px 8px #0006,inset 3px 3px 5px #fff5,0 3px 5px #0007}
.sn-prev b{width:16px;height:16px;border-radius:50%;background:#fff;color:#111;font:700 10px Rubik,Arial;display:flex;align-items:center;justify-content:center}
.sn{overflow:hidden;background:radial-gradient(ellipse at 50% 55%,#1c2a3c,#070a10 75%)}
.sn-top{display:flex;align-items:center;gap:8px;padding:max(4px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 2px max(10px,env(safe-area-inset-left));justify-content:center}
.sn-top .rbtn:first-child{margin-right:auto}.sn-top .rbtn:last-child{margin-left:auto}
.sn-top .rbtn{width:34px;height:34px;font-size:15px;border-width:2px}
.sn-pl{flex:1;min-width:0;max-width:300px;display:flex;align-items:center;gap:7px;background:linear-gradient(#0f1622,#05080d);border:2px solid #ffffff1c;border-radius:12px;padding:2px 8px 2px 2px}
.sn-pl.dir{flex-direction:row-reverse;padding:2px 2px 2px 8px;text-align:right}
.sn-pl.vez{border-color:var(--gold);box-shadow:0 0 10px #f2c94c77}
.sn-pl .av{width:30px;height:30px;border-radius:9px;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
.sn-pl>div{min-width:0;display:flex;flex-direction:column;gap:2px}
.sn-pl.dir>div{align-items:flex-end}
.sn-pl b{font:500 13px Oswald;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
.sn-pl b small{color:var(--gold);font-size:11px}
.sn-fila{display:flex;flex-direction:row;gap:3px}
.sn-fila span{width:11px;height:11px;border-radius:50%;box-shadow:inset -2px -2px 3px #0007}
.sn-fila span.vazio{background:#ffffff18;box-shadow:none}
.sn-fila span.foi{opacity:.18}
.sn-fila span.ganho{background:var(--gold);box-shadow:0 0 6px #f2c94c}
.sn-vs{font:700 15px Oswald;color:var(--gold);font-style:italic;text-align:center;line-height:1}
.sn-area{flex:1;min-height:0;display:flex;align-items:stretch;gap:6px;padding:2px max(6px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left))}
.sn-bar{flex:none;width:30px;align-self:center;height:78%;max-height:380px;border-radius:15px;border:2px solid #ffffff44;background:linear-gradient(#ef4444,#f59e0b 50%,#22c55e);position:relative;overflow:hidden;touch-action:none;cursor:ns-resize;display:flex;align-items:flex-end;justify-content:center;box-shadow:0 0 0 3px #0008}
.sn-bar i{position:absolute;left:0;right:0;top:0;height:0;background:#000c;border-bottom:3px solid #fff}
.sn-bar span{position:relative;writing-mode:vertical-rl;transform:rotate(180deg);font:600 10px Oswald;color:#fff;letter-spacing:2px;margin-bottom:8px;text-shadow:0 1px 2px #000;pointer-events:none}
.sn-comeca{flex:none;width:64px;align-self:center;height:64px;border-radius:50%;border:3px solid #fff;background:radial-gradient(circle at 40% 30%,#ffe08a,#c8901c);color:#3a2300;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 0 #6b4a05,0 6px 14px #0008;padding:0}
.sn-comeca b{font:700 9px Oswald;letter-spacing:.3px}
.sn-mesa{flex:1;min-width:0;position:relative;touch-action:none}
.sn-mesa canvas{position:absolute;inset:0;display:block;touch-action:none;user-select:none;-webkit-user-select:none}
.sn-msg{position:absolute;left:50%;top:2px;transform:translateX(-50%);max-width:80%;pointer-events:none;font:500 clamp(11px,2.2vmin,14px) Oswald;color:#fff;background:#000a;border-radius:10px;padding:2px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sn-msg:empty{display:none}
.sn-caiu{flex:none;width:22px;align-self:center;height:78%;max-height:380px;border-radius:11px;background:linear-gradient(90deg,#05080d,#1a2232,#05080d);border:2px solid #ffffff22;display:flex;flex-direction:column-reverse;align-items:center;gap:2px;padding:3px 0;overflow:hidden}
.sn-caiu span{width:16px;height:16px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;box-shadow:inset -2px -3px 4px #0007}
.sn-caiu b{width:8px;height:8px;border-radius:50%;background:#fff;color:#111;font:700 6px Arial;display:flex;align-items:center;justify-content:center}
`;
