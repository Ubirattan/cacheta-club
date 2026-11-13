'use client';
// PIPA — batalha de cortar contra o computador. Cada partida custa 1 ficha (cobrada no servidor: /api/treino).
// Segure o dedo na tela pra PUXAR (a pipa vai pra onde o bico aponta); solte pra DAR LINHA (ela gira).
// Céu em 3D (câmera na laje olhando pra cima, com a foto da rua do Jd. Guaracy), de dia ou de noite,
// com 1 a 3 pipas do computador. Se o 3D não abrir no celular, usa a tela 2D.
// A sua pipa é a que está em uso na loja (slot 'pipa').
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, Seg, toast } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { W, H, GROUND, LINE_HP, ROUNDS_TO_WIN, NIVEIS, newPipa, stepPipa, linePts, crossOf } from '../../lib/pipa.js';
import { drawPipa, modelo, modelosBots, PIPA_PADRAO } from '../../lib/pipa-arte.js';
import { loadThree, webglOk } from '../../lib/three-loader.js';
import { createPipa3D } from '../../lib/pipa-view3d.js';
import { foto } from '../../lib/gude-view.js';

const BOTS = [['Tião', '🤠'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zeca', '🦅'], ['Dete', '🐱'], ['Brisa', '🦜']];
const QUANTAS = [[2, '1 x 1'], [3, '3 pipas'], [4, '4 pipas']];
const CEUS = [['dia', '☀️ Dia'], ['noite', '🌙 Noite'], ['auto', '🕐 Hora certa']];
const ehNoite = ceu => ceu === 'noite' || (ceu === 'auto' && (() => { const h = new Date().getHours(); return h >= 18 || h < 6; })());

// pipa desenhada uma vez numa imagem (a tela 2D só gira e cola)
const ARTE = {};
function arte(id) {
  if (ARTE[id]) return ARTE[id];
  const c = document.createElement('canvas'); c.width = c.height = 128; drawPipa(c.getContext('2d'), id, 120, 4, 4);
  return (ARTE[id] = c);
}
function PipaIcon({ id, size = 64 }) {
  const ref = useRef(null);
  useEffect(() => { const c = ref.current; if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128); drawPipa(g, id, 120, 4, 4); }, [id]);
  return <canvas ref={ref} width={128} height={128} style={{ width: size, height: size }} />;
}

/* ---------- cenário 2D: céu em cima das lajes do bairro (de dia ou de noite) ---------- */
function paintFundo(night, hands) {
  const K = 2, cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
  const g = cv.getContext('2d'); g.scale(K, K);
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (night) { sky.addColorStop(0, '#02040c'); sky.addColorStop(.5, '#0a1838'); sky.addColorStop(.85, '#1d2c55'); sky.addColorStop(1, '#3a3f66'); }
  else { sky.addColorStop(0, '#2f6fb5'); sky.addColorStop(.45, '#7fb3de'); sky.addColorStop(.8, '#f6c98a'); sky.addColorStop(1, '#f0a868'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (night) {
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .6})`; g.fillRect(r() * W, r() * 330, 1.4, 1.4); }
    g.fillStyle = '#f1f0e4'; g.beginPath(); g.arc(200, 90, 26, 0, 7); g.fill();
  } else {
    const sun = g.createRadialGradient(770, 300, 10, 770, 300, 170); sun.addColorStop(0, 'rgba(255,244,214,.95)'); sun.addColorStop(.18, 'rgba(255,224,160,.7)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
  }
  // morros lá longe
  g.fillStyle = 'rgba(92,120,160,.55)'; g.beginPath(); g.moveTo(0, 360);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, 330 + Math.sin(x / 130) * 26 + Math.sin(x / 47) * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  // casinhas no morro (bem pequenas, apagadas)
  for (let i = 0; i < 220; i++) {
    const x = r() * W, y = 340 + Math.sin(x / 130) * 26 + r() * 70, w = 7 + r() * 9, h = 5 + r() * 7;
    g.fillStyle = `hsla(${[18, 30, 200, 45, 120, 0][i % 6]},${30 + r() * 25}%,${55 + r() * 15}%,.55)`; g.fillRect(x, y, w, h);
  }
  // casas da frente (as lajes), coloridas, com caixa d'água, antena e varal
  const cores = ['#d9784a', '#c2410c', '#e8b04a', '#5b8fb9', '#7aa65a', '#d8d2c4', '#b45309', '#e07a8a', '#8f6aa8'];
  let x = -10;
  while (x < W + 10) {
    const w = 70 + r() * 70, top = GROUND + (r() * 14 - 4) | 0, col = cores[(r() * cores.length) | 0];
    const near = hands.some(([hx]) => Math.abs(hx - (x + w / 2)) < w / 2 + 10);
    const ty = near ? GROUND + 8 : top;
    g.fillStyle = col; g.fillRect(x, ty, w, H - ty);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w - 6, ty, 6, H - ty);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, ty, w, 3);                                       // borda da laje
    if (r() < .35) { g.fillStyle = 'rgba(140,60,30,.35)'; for (let yy = ty + 10; yy < H; yy += 9) for (let xx = x + ((yy / 9) % 2) * 8; xx < x + w; xx += 16) g.fillRect(xx, yy, 14, 7); } // tijolinho
    for (let wy = ty + 16; wy < H - 10; wy += 30) for (let wx = x + 10; wx < x + w - 18; wx += 26) {
      g.fillStyle = r() < (night ? .35 : .5) ? '#2b2f3a' : '#f8e3a1'; g.fillRect(wx, wy, 12, 14);
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.strokeRect(wx, wy, 12, 14);
    }
    if (!near && r() < .5) {   // caixa d'água azul
      const cx = x + 12 + r() * (w - 40); g.fillStyle = '#2b6cb0'; g.fillRect(cx, ty - 20, 26, 20); g.fillStyle = '#3b82c4'; g.beginPath(); g.ellipse(cx + 13, ty - 20, 13, 4, 0, 0, 7); g.fill();
    }
    if (!near && r() < .45) {  // antena
      const ax = x + 8 + r() * (w - 16); g.strokeStyle = '#3f3f46'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ax, ty); g.lineTo(ax, ty - 34); g.moveTo(ax - 10, ty - 28); g.lineTo(ax + 10, ty - 28); g.moveTo(ax - 7, ty - 20); g.lineTo(ax + 7, ty - 20); g.stroke();
    }
    if (!near && r() < .3) {   // varal com roupa
      const vx = x + 6, vw = w - 12; g.strokeStyle = 'rgba(40,40,40,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(vx, ty - 16); g.quadraticCurveTo(vx + vw / 2, ty - 10, vx + vw, ty - 16); g.stroke();
      for (let k = 0; k < 4; k++) { g.fillStyle = cores[(r() * cores.length) | 0]; g.fillRect(vx + 6 + k * vw / 4.5, ty - 14, 9, 11); }
    }
    x += w - 2;
  }
  // fios do poste atravessando (só desenho)
  g.strokeStyle = 'rgba(30,30,35,.55)'; g.lineWidth = 1.2;
  for (const yy of [395, 402]) { g.beginPath(); g.moveTo(0, yy); g.quadraticCurveTo(W / 2, yy + 22, W, yy - 4); g.stroke(); }
  if (night) { g.fillStyle = 'rgba(6,10,30,.35)'; g.fillRect(0, 300, W, H - 300); }
  return cv;
}

// molequinho em cima da laje segurando a linha
function moleque(c, hand, i, pull, t, cor) {
  const [hx, hy] = hand, f = hx > W / 2 ? -1 : 1, bx = hx - 16 * f, by = GROUND + 8;
  c.save(); c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bx, by, 13, 3, 0, 0, 7); c.fill();
  c.strokeStyle = '#3b2a1e'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(bx - 4, by); c.lineTo(bx - 2, by - 18); c.moveTo(bx + 4, by); c.lineTo(bx + 2, by - 18); c.stroke();     // pernas
  c.fillStyle = cor; c.fillRect(bx - 8, by - 38, 16, 22);                                                   // camiseta
  c.strokeStyle = '#8d5a3b'; c.lineWidth = 4;
  const pl = pull ? 6 : 0;
  c.beginPath(); c.moveTo(bx + 6 * f, by - 34); c.lineTo(hx - pl * f, hy + (pull ? 6 : 0)); c.stroke();                                // braço da linha
  c.beginPath(); c.moveTo(bx - 6 * f, by - 32); c.lineTo(bx - 14 * f, by - 22 + Math.sin(t / 9) * 2); c.stroke();                    // outro braço (lata)
  c.fillStyle = '#c8a24a'; c.beginPath(); c.ellipse(bx - 16 * f, by - 20, 5, 7, 0, 0, 7); c.fill();                                // lata com a linha
  c.fillStyle = '#8d5a3b'; c.beginPath(); c.arc(bx, by - 46, 8, 0, 7); c.fill();                                                    // cabeça
  c.fillStyle = i ? '#f8fafc' : '#facc15'; c.beginPath(); c.arc(bx, by - 49, 8.5, Math.PI, 0); c.fill(); c.fillRect(bx, by - 51, 13 * f, 3); // boné
  c.restore();
}

// a pipa do modelo (losango com o desenho), girada pro lado do bico
function desenhaPipa(c, k, id) {
  c.save(); c.translate(k.x, k.y); c.rotate(k.a + Math.PI / 2);
  c.globalAlpha = .2; c.filter = 'brightness(0)'; c.drawImage(arte(id), -25 + 4, -25 + 6, 50, 50); c.filter = 'none'; c.globalAlpha = 1;
  c.drawImage(arte(id), -25, -25, 50, 50);
  c.restore();
  return [k.x - Math.cos(k.a) * 26, k.y - Math.sin(k.a) * 26];
}

export default function Pipa() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth();
  const [level, setLevel] = useState('medio');
  const [quantas, setQuantas] = useState(2);
  const [ceu, setCeu] = useState('dia');
  const [modo3d, setModo3d] = useState(true);       // false = tela 2D (escolha do jogador ou 3D não abriu)
  const [game, setGame] = useState(null);           // { id, bots, level, n, night, models }
  const [hud, setHud] = useState(null);
  const [msg, setMsg] = useState('');
  const [rules, setRules] = useState(false);
  const [semFichas, setSemFichas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [som, setSom] = useState(true);
  const cvRef = useRef(null), boxRef = useRef(null);
  const minha = (profile?.equipped && profile.equipped.pipa) || PIPA_PADRAO;

  useEffect(() => {
    setSom(soundOn());
    try {
      const l = localStorage.getItem('pp_level'); if (NIVEIS.some(x => x[0] === l)) setLevel(l);
      const q = +localStorage.getItem('pp_n'); if (QUANTAS.some(x => x[0] === q)) setQuantas(q);
      const c = localStorage.getItem('pp_ceu'); if (CEUS.some(x => x[0] === c)) setCeu(c);
      if (localStorage.getItem('pp_2d') === '1') setModo3d(false);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('pp_level', level); localStorage.setItem('pp_n', String(quantas)); localStorage.setItem('pp_ceu', ceu); } catch {} }, [level, quantas, ceu]);

  async function start() {
    if (!profile || busy) return;
    if ((profile.coins || 0) < 1) return setSemFichas(true);
    setBusy(true);
    try {
      await api('/api/treino', { jogo: 'pipa' });
      reloadProfile && reloadProfile();
      const pool = [...BOTS].sort(() => Math.random() - .5), n = quantas;
      setGame({ id: Date.now(), bots: pool.slice(0, n - 1), level, n, night: ehNoite(ceu), models: [minha, ...modelosBots(minha, n - 1)] });
      setMsg('Segure o dedo pra PUXAR · solte pra DAR LINHA');
    } catch (e) { if (/fichas/i.test(e.message)) setSemFichas(true); else toast(e.message); }
    finally { setBusy(false); }
  }

  // laço do jogo: física em passos fixos de 1/60 s, desenho (3D ou 2D), toque
  useEffect(() => {
    if (!game) return;
    const box = boxRef.current, cv = cvRef.current;
    const names = ['Você', ...game.bots.map(b => b[0])];
    const G = newPipa({ level: game.level, names, pipas: game.n });
    let raf, alive = true, pull = false, acc = 0, last = performance.now(), lastHud = 0, wasCross = false, v3 = null;
    const sync = () => setHud({ score: [...G.score], hp: G.k.map(k => Math.max(0, k.hp)), cut: G.k.map(k => k.cut), over: G.over, round: G.round, phase: G.phase, cross: crossOf(G, 0).length > 0 });

    /* ---- tela 2D (reserva) ---- */
    const c = cv.getContext('2d');
    let fundo = null, view = { s: 1, ox: 0, oy: 0, dpr: 1 };
    const tails = G.k.map(() => []), sparks = [], fx = [];
    const clouds = Array.from({ length: game.night ? 3 : 6 }, (_, i) => ({ x: i * 190 + Math.random() * 80, y: 40 + Math.random() * 150, s: .6 + Math.random() * .8 }));
    const birds = game.night ? [] : Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: 60 + Math.random() * 120, v: .4 + Math.random() * .5 }));
    function fit() {
      const r = box.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const s = Math.max(r.width / W, r.height / H);     // cobre a tela toda (corta um pouco do céu, se precisar)
      view = { s, ox: (r.width - W * s) / 2, oy: Math.min(0, r.height - H * s), dpr };
      if (v3) v3.resize();
    }
    fit(); const ro = new ResizeObserver(fit); ro.observe(box);

    // tenta o 3D; se não der, segue no 2D
    const usar3d = modo3d && webglOk();
    cv.style.visibility = usar3d ? 'hidden' : 'visible';
    if (usar3d) loadThree().then(THREE => {
      if (!alive) return;
      const fotos = { fundo: foto('rua-fundo.jpg', () => v3 && v3.setFoto({ fundo: foto('rua-fundo.jpg') })), chao: foto('rua-chao.jpg', () => v3 && v3.setFoto({ chao: foto('rua-chao.jpg') })) };
      try { v3 = createPipa3D({ THREE, box, models: game.models, night: game.night, foto: fotos }); v3.canvas.addEventListener('pointerdown', down); }
      catch (e) { console.error('pipa 3D', e); v3 = null; cv.style.visibility = 'visible'; }
    }).catch(() => { cv.style.visibility = 'visible'; });

    function popTxt(t, x, y) { if (v3) v3.pop(t, x, y); else fx.push({ x, y: y - 30, life: 1, t }); }
    function events() {
      for (const e of G.events) {
        if (e.type === 'go') setMsg(game.n > 2 ? 'Já! Corte todo mundo e seja o último no céu' : 'Já! Cruze a linha e puxe pra cortar');
        if (e.type === 'cruzou' && (e.a === 0 || e.b === 0)) { sfx('tick'); try { navigator.vibrate && navigator.vibrate(15); } catch {} }
        if (e.type === 'corte' || e.type === 'caiu') {
          popTxt(e.type === 'corte' ? 'CORTOU!' : 'CAIU!', e.x, e.y);
          const quem = names[e.loser], por = e.winner != null ? names[e.winner] : null;
          if (e.type === 'corte') setMsg(e.winner === 0 ? `Você cortou a pipa do ${quem}!` : e.loser === 0 ? `${por} cortou a sua pipa!` : `${por} cortou a pipa do ${quem}`);
          else setMsg(e.loser === 0 ? 'Sua pipa caiu no telhado!' : `A pipa do ${quem} caiu no telhado!`);
          if (e.winner === 0) sfx('coin'); else if (e.loser === 0) sfx('err'); else sfx('tick');
        }
        if (e.type === 'rodada') {
          const eu = e.winner === 0;
          if (e.why === 'tempo') setMsg(eu ? 'Acabou o tempo: você estava com mais linha!' : `Acabou o tempo: ${names[e.winner]} estava com mais linha.`);
          else if (game.n > 2) setMsg(eu ? '🏆 Você é o dono do céu nessa rodada!' : `${names[e.winner]} ganhou a rodada`);
          sfx(eu ? 'coin' : 'err'); try { navigator.vibrate && navigator.vibrate(eu ? 30 : [20, 40, 20]); } catch {}
          if (G.over) setTimeout(() => sfx(G.over.winner === 0 ? 'win' : 'lose'), 900);
        }
      }
      G.events.length = 0;
    }

    function tailStep(i, end) {
      const T = tails[i];
      if (!T.length) for (let j = 0; j < 14; j++) T.push({ x: end[0], y: end[1] + j * 8 });
      T[0].x = end[0]; T[0].y = end[1];
      for (let j = 1; j < T.length; j++) {
        const p = T[j], q = T[j - 1];
        p.x += G.wind * .7 + Math.sin((G.t + j * 9) / 8) * .6; p.y += 1.4;
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
        p.x = q.x + dx / d * 8; p.y = q.y + dy / d * 8;
      }
    }

    function draw2d(now) {
      if (!fundo) fundo = paintFundo(game.night, G.hands);
      const { s, ox, oy, dpr } = view;
      c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      c.drawImage(fundo, 0, 0, W, H);
      for (const cl of clouds) {
        cl.x += .12 * cl.s + G.wind * .05; if (cl.x > W + 120) cl.x = -140;
        c.fillStyle = game.night ? 'rgba(150,160,190,.18)' : 'rgba(255,255,255,.75)';
        for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(cl.x + k * 22 * cl.s, cl.y + Math.sin(k * 1.7) * 6, 30 * cl.s, 16 * cl.s, 0, 0, 7); c.fill(); }
      }
      c.strokeStyle = 'rgba(40,40,50,.7)'; c.lineWidth = 1.6;
      for (const b of birds) {
        b.x += b.v; if (b.x > W + 20) { b.x = -20; b.y = 60 + Math.random() * 120; }
        const fl = Math.sin(now / 140 + b.y) * 4; c.beginPath(); c.moveTo(b.x - 7, b.y - fl); c.quadraticCurveTo(b.x - 3, b.y - 2, b.x, b.y); c.quadraticCurveTo(b.x + 3, b.y - 2, b.x + 7, b.y - fl); c.stroke();
      }
      for (let i = 0; i < G.n; i++) {
        const k = G.k[i], [hx, hy] = G.hands[i];
        c.strokeStyle = game.night ? (i ? 'rgba(170,180,208,.9)' : 'rgba(255,233,176,.95)') : (i ? 'rgba(30,41,59,.9)' : 'rgba(69,26,3,.9)'); c.lineWidth = 1.3;
        if (!k.cut) { const L = linePts(G, i, 22); c.beginPath(); L.forEach(([x, y], j) => j ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
        else { const d = hx < W / 2 ? 1 : -1; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + 30 * d, hy + 10, hx + 60 * d, hy + 30); c.stroke(); }
      }
      for (let i = 0; i < G.n; i++) {
        const k = G.k[i]; if (k.y > H + 40) continue;
        const M = modelo(game.models[i]), tail = desenhaPipa(c, k, game.models[i]);
        tailStep(i, tail);
        c.strokeStyle = M.rab[0]; c.lineWidth = 2; c.beginPath(); tails[i].forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
        tails[i].forEach((p, j) => { if (j % 2) return; c.fillStyle = M.rab[(j / 2) % 2]; c.save(); c.translate(p.x, p.y); c.rotate(Math.sin((G.t + j * 7) / 6) * .6); c.fillRect(-5, -1.5, 10, 3); c.restore(); });
      }
      for (const cr of G.crosses) for (let j = 0; j < 3; j++) { const a = Math.random() * 6.3, v = 1 + Math.random() * 2.5; sparks.push({ x: cr.p[0], y: cr.p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1 }); }
      for (const p of sparks) { p.x += p.vx; p.y += p.vy; p.vy += .12; p.life -= .045; c.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},120,${Math.max(0, p.life)})`; c.fillRect(p.x, p.y, 2.5, 2.5); }
      for (let j = sparks.length - 1; j >= 0; j--) if (sparks[j].life <= 0) sparks.splice(j, 1);
      for (const cr of G.crosses) { c.strokeStyle = `rgba(255,240,180,${.5 + Math.sin(now / 60) * .3})`; c.lineWidth = 2; c.beginPath(); c.arc(cr.p[0], cr.p[1], 9 + Math.sin(now / 80) * 3, 0, 7); c.stroke(); }
      G.hands.forEach((h, i) => moleque(c, h, i, G.k[i].pull, G.t, modelo(game.models[i]).c[0]));
      for (const f of fx) {
        f.y -= .5; f.life -= .01;
        c.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5)); c.font = '700 30px Oswald, Rubik, sans-serif'; c.textAlign = 'center';
        c.lineWidth = 5; c.strokeStyle = 'rgba(40,18,4,.85)'; c.strokeText(f.t, f.x, f.y); c.fillStyle = '#fde68a'; c.fillText(f.t, f.x, f.y); c.globalAlpha = 1;
      }
      for (let j = fx.length - 1; j >= 0; j--) if (fx[j].life <= 0) fx.splice(j, 1);
    }

    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      acc = Math.min(acc + (now - last), 100); last = now;
      try {
        while (acc >= 1000 / 60) {
          acc -= 1000 / 60;
          const before = G.phase;
          stepPipa(G, { pull });
          events();
          if (G.phase !== before && G.phase === 'ready') { tails.forEach(t => (t.length = 0)); setMsg(`Rodada ${G.round} · segure pra PUXAR, solte pra DAR LINHA`); }
        }
        const cr = crossOf(G, 0).length > 0;
        if (now - lastHud > 120 || cr !== wasCross) { lastHud = now; wasCross = cr; sync(); }
        if (v3) v3.draw(G, now); else draw2d(now);
      } catch (e) { console.error('pipa', e); }
    }

    function down(e) { pull = true; try { e.target.setPointerCapture(e.pointerId); } catch {} }
    const up = () => { pull = false; };
    const key = e => { if (e.code === 'Space') { e.preventDefault(); pull = e.type === 'keydown'; } };
    cv.addEventListener('pointerdown', down);
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('keydown', key); addEventListener('keyup', key);
    sync(); raf = requestAnimationFrame(loop);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      removeEventListener('keydown', key); removeEventListener('keyup', key);
      if (v3) { v3.dispose(); v3 = null; }
    };
  }, [game]); // eslint-disable-line

  /* ------------------------- MENU ------------------------- */
  if (!game) return (
    <div className="page lounge pp-menu">
      <div className="hdr"><a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a>
        <div className="pp-logo">PIPA <small>batalha de cortar</small></div>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/')}>↩</button></div>
      <div className="pp-box">
        <div className="pp-minha"><PipaIcon id={minha} size={70} /><div><b>Sua pipa</b><a href="/loja#itens" onClick={e => { e.preventDefault(); router.push('/loja'); }}>🛒 Trocar na loja</a></div></div>
        <Seg label="Pipas no céu" value={quantas} onChange={setQuantas} options={QUANTAS} />
        <Seg label="Computador" value={level} onChange={setLevel} options={NIVEIS} />
        <Seg label="Céu" value={ceu} onChange={setCeu} options={CEUS} />
        <button className="go" disabled={!profile || busy} onClick={start}>{busy ? 'Começando…' : '🪁 Empinar · 1 ficha'}</button>
        <div className="pp-row">
          <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
          <button className="sec" onClick={() => { const v = !modo3d; setModo3d(v); try { localStorage.setItem('pp_2d', v ? '0' : '1'); } catch {} }}>{modo3d ? '🎥 Visão 3D' : '🖼 Visão 2D'}</button>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>Cada partida contra o computador custa 1 ficha. Quem ganhar 2 rodadas primeiro leva.</p>
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
  const h = hud || { score: Array(game.n).fill(0), hp: Array(game.n).fill(LINE_HP), cut: [], over: null, round: 1 };
  const nome = i => (i ? game.bots[i - 1][0] : 'Você');
  const placar = i => (
    <div key={i} className={`pp-pill ${i === 0 && h.cross ? 'x' : ''} ${h.cut[i] && h.phase === 'play' ? 'off' : ''} ${game.n > 2 ? 'mini' : ''}`}>
      <span className="av"><PipaIcon id={game.models[i]} size={game.n > 2 ? 26 : 32} /></span>
      <div><b>{i ? `${game.bots[i - 1][1]} ${nome(i)}` : `${profile?.avatar || '😎'} Você`}</b>
        <span className="hp"><i style={{ width: `${h.hp[i] / LINE_HP * 100}%`, background: h.hp[i] < 35 ? '#ef4444' : h.hp[i] < 65 ? '#f59e0b' : '#4ade80' }} /></span></div>
      <strong>{Array.from({ length: ROUNDS_TO_WIN }, (_, k) => <em key={k} className={k < h.score[i] ? 'on' : ''} />)}</strong>
    </div>
  );
  const ganhou = h.over && h.over.winner === 0;
  return (
    <div className="page lounge pp">
      <div className="pp-top">
        <div className="pp-pills">{Array.from({ length: game.n }, (_, i) => placar(i))}</div>
        <div className="pp-mid">{h.cross ? <b className="cruz">⚔️ PUXA!</b> : <>Rodada <b>{h.round}</b></>}</div>
        <button className="rbtn" title="Regras" onClick={() => setRules(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={() => { if (h.over || confirm('Sair da partida? A ficha já foi usada.')) setGame(null); }}>↩</button>
      </div>
      <div className={`pp-field ${game.night ? 'noite' : ''}`} ref={boxRef}><canvas ref={cvRef} /></div>
      <div id="msg">{msg || ' '}</div>
      {rules && <Regras onClose={() => setRules(false)} />}
      {h.over && h.phase === 'cut' && <Modal><h2>{ganhou ? '🏆 Você ganhou!' : `${nome(h.over.winner)} ganhou`}</h2>
        <div className="score">{Array.from({ length: game.n }, (_, i) => i).sort((a, b) => h.score[b] - h.score[a]).map(i =>
          <div key={i}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PipaIcon id={game.models[i]} size={22} />{nome(i)}</span><b>{h.score[i]} {h.score[i] === 1 ? 'rodada' : 'rodadas'}</b></div>)}</div>
        <p>{ganhou ? 'Dono do céu! Cortou geral.' : 'Quase! Tenta de novo.'}</p>
        <button className="go" disabled={busy} onClick={start}>🪁 Jogar de novo · 1 ficha</button>
        <button className="sec" onClick={() => setGame(null)}>Voltar ao menu</button></Modal>}
      <style>{CSS}</style>
    </div>
  );
}

function Regras({ onClose }) {
  return (
    <Modal onClose={onClose}><h2>Como jogar</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• <b>Segure o dedo na tela pra PUXAR:</b> a pipa dá um tiro pra onde o bico está apontando.</p>
        <p>• <b>Solte pra DAR LINHA:</b> a pipa fica girando e o vento leva. Espere o bico apontar pra onde você quer e puxe!</p>
        <p>• <b>Cruze a sua linha com a do adversário.</b> Enquanto estão cruzadas, as duas se gastam, e quem está <b>puxando corta muito mais rápido</b>.</p>
        <p>• Linha acabou = pipa cortada. Pipa que encosta no telhado <b>cai</b>. Rodada de até 1 minuto: se ninguém cortar, ganha quem tem mais linha.</p>
        <p>• <b>Várias pipas no céu:</b> todo mundo corta todo mundo. A rodada é de quem ficar por último no céu. Se a sua cair, a rodada acaba.</p>
        <p>• <b>Quem ganhar 2 rodadas primeiro leva.</b> No computador dá pra usar a barra de espaço pra puxar.</p>
        <p>• Troque o desenho da sua pipa na <b>Loja</b>.</p>
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

const CSS = `
.pp-menu .hdr{align-items:center}
.pp-logo{font:700 clamp(24px,5.6vmin,40px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;text-align:center}
.pp-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:6px}
.pp-box{margin:auto;width:min(440px,94vw);background:linear-gradient(180deg,#1d2a3a,#0e141c);border:2px solid var(--gold2);border-radius:20px;padding:14px 18px;text-align:center}
.pp-box h2{margin:0 0 6px;font:700 22px Oswald;color:var(--gold);text-transform:uppercase;font-style:italic}
.pp-minha{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:4px}
.pp-minha canvas{filter:drop-shadow(3px 5px 5px rgba(0,0,0,.5))}
.pp-minha div{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.pp-minha b{font:600 17px Oswald;color:var(--gold)}
.pp-minha a{font:500 14px Oswald;color:#9cc9ee;text-decoration:none}
.pp-row{display:flex;gap:8px}.pp-row .sec{flex:1}
.pp-pills{display:flex;gap:6px;min-width:0;flex:1 1 auto;overflow:hidden}
.pp-pill.off{opacity:.4;filter:grayscale(1)}
.pp-pill.mini{padding:2px 8px 2px 3px;gap:5px}
.pp-pill.mini b{font-size:12px}.pp-pill.mini .hp{width:clamp(34px,6vw,70px)}
.pp-pill.mini div{min-width:0}
.pp-pill.mini strong em{width:9px;height:9px}
.pp-pill .av{background:#1e3a5f}
.pp-field.noite{background:#02040c;border-radius:14px}
.pp{overflow:hidden}
.pp-top{display:flex;align-items:center;gap:clamp(6px,1.4vw,12px);padding:8px 12px 6px}
.pp-pill{display:flex;align-items:center;gap:8px;background:#0c0a07;border:2px solid var(--gold2);border-radius:30px;padding:3px 12px 3px 4px;min-width:0}
.pp-pill.x{border-color:#f59e0b;box-shadow:0 0 12px rgba(245,158,11,.55)}
.pp-pill .av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
.pp-pill div{display:flex;flex-direction:column;gap:3px;min-width:70px}
.pp-pill b{font:500 15px Oswald;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1}
.pp-pill .hp{display:block;height:7px;border-radius:4px;background:#2a2a2a;overflow:hidden;width:clamp(60px,12vw,120px)}
.pp-pill .hp i{display:block;height:100%;border-radius:4px;transition:width .12s}
.pp-pill strong{display:flex;gap:4px;margin-left:4px}
.pp-pill strong em{width:12px;height:12px;border-radius:50%;border:2px solid var(--gold);display:block}
.pp-pill strong em.on{background:var(--gold)}
.pp-mid{font:500 14px Oswald;color:var(--mut);background:#000a;border:1.5px solid var(--gold2);border-radius:20px;padding:5px 12px;white-space:nowrap}
.pp-mid b{color:#fff;font-size:17px}
.pp-mid .cruz{color:#fbbf24;animation:ppb .4s infinite alternate}
@keyframes ppb{to{opacity:.55}}
.pp-top .rbtn:first-of-type{margin-left:auto}
.pp-top .pp-mid{flex:none}
.pp-top .rbtn{width:42px;height:42px;font-size:18px}
.pp-field{flex:1;min-height:0;position:relative;margin:0 8px}
.pp-field canvas{position:absolute;inset:0;display:block;touch-action:none;border-radius:14px;cursor:pointer;user-select:none;-webkit-user-select:none}
`;
