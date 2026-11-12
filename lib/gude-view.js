'use client';
// Desenho e animação da mesa da gude (chão de terra, bolinhas, mira, poeira, som).
// Usado contra o computador e no online. As tecadas chegam numa fila e cada uma é
// refeita a partir da cópia da mesa (pre) com a mesma velocidade (vx, vy) do servidor.
import { W, H, LINE, TRI, MAXP, VK, FRICTION, HOLES, HOLE_R, step, launch, velOf, target } from './gude.js';
import { sfx, soundOn } from './sfx.js';

const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- chão ---------- */
export function paintGround(mode) {
  const K = 2, cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
  const g = cv.getContext('2d'); g.scale(K, K);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#bd8754'); gr.addColorStop(1, '#8c5a31');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.4 + .3, k = Math.random();
    g.fillStyle = k < .45 ? 'rgba(70,38,14,.28)' : k < .85 ? 'rgba(245,214,170,.22)' : 'rgba(30,15,5,.35)'; g.fillRect(x, y, r, r);
  }
  for (let i = 0; i < 30; i++) {
    let x = Math.random() * W, y = Math.random() * H, a = Math.random() * 6.3;
    g.strokeStyle = 'rgba(60,32,12,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (Math.random() - .5) * 1.2; x += Math.cos(a) * 10; y += Math.sin(a) * 10; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * W, y = Math.random() * H, rx = Math.random() * 4.5 + 2, ry = rx * (.6 + Math.random() * .3), sh = 150 + Math.random() * 60 | 0;
    if (mode === 'bulica' && HOLES.some(h => Math.hypot(h[0] - x, h[1] - y) < 40)) continue;
    g.fillStyle = 'rgba(40,20,5,.35)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, rx, ry, 0, 0, 7); g.fill();
    g.fillStyle = `rgb(${sh},${sh - 25},${sh - 55})`; g.beginPath(); g.ellipse(x, y, rx, ry, Math.random() * 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rx * .3, y - ry * .35, rx * .35, ry * .3, 0, 0, 7); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const top = Math.random() < .5, x = Math.random() * W, y = top ? Math.random() * 30 + 14 : H - Math.random() * 24;
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = k % 2 ? '#5f7d2a' : '#7a9a35'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + (k - 3) * 2, y - 8, x + (k - 3) * 3.5, y - 13 - Math.random() * 6); g.stroke();
    }
  }
  const groove = (pts, close, dash) => {
    g.setLineDash(dash || []); g.lineCap = 'round'; g.lineJoin = 'round';
    [[7, 'rgba(55,28,8,.55)', 0], [3, 'rgba(35,16,4,.75)', 0], [1.5, 'rgba(255,224,185,.45)', 2.5]].forEach(([w, col, o]) => {
      g.lineWidth = w; g.strokeStyle = col; g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + o) : g.moveTo(p[0], p[1] + o)); if (close) g.closePath(); g.stroke();
    });
    g.setLineDash([]);
  };
  if (mode === 'triangulo') { groove(TRI, true); groove([[LINE, 30], [LINE, H - 30]], false, [12, 8]); }
  if (mode === 'bulica') {
    groove([[LINE, 30], [LINE, H - 30]], false, [12, 8]);
    HOLES.forEach(([x, y], i) => {
      g.fillStyle = 'rgba(255,225,185,.25)'; g.beginPath(); g.ellipse(x + 1, y + 2, HOLE_R + 5, HOLE_R + 4, 0, 0, 7); g.fill();
      const hg = g.createRadialGradient(x - 3, y - 4, 1, x, y, HOLE_R + 2);
      hg.addColorStop(0, '#120802'); hg.addColorStop(.7, '#2a1406'); hg.addColorStop(1, '#6b4021');
      g.fillStyle = hg; g.beginPath(); g.arc(x, y, HOLE_R + 2, 0, 7); g.fill();
      g.font = '700 22px Oswald, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(55,28,8,.55)'; g.fillText(String(i + 1), x, y + 52);
      g.fillStyle = 'rgba(255,230,195,.35)'; g.fillText(String(i + 1), x - 1, y + 50);
    });
  }
  if (mode === 'matamata') {
    groove([[W / 2, 40], [W / 2, H - 40]], false, [12, 8]);
    const c = 26; g.strokeStyle = 'rgba(55,28,8,.5)'; g.lineWidth = 4;
    [[170, H / 2], [W - 170, H / 2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, c, 0, 7); g.stroke(); });
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  return cv;
}

export function marble(c, b) {
  const { x, y, r, k } = b;
  const sg = c.createRadialGradient(x + 4, y + 5, 1, x + 4, y + 5, r * 1.3);
  sg.addColorStop(0, 'rgba(20,8,0,.5)'); sg.addColorStop(1, 'rgba(20,8,0,0)');
  c.fillStyle = sg; c.beginPath(); c.ellipse(x + 4, y + 5, r * 1.25, r * 1.05, 0, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  const gb = c.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r * 1.05);
  if (b.type === 'leiteira') { gb.addColorStop(0, '#ffffff'); gb.addColorStop(.6, '#e2e8f0'); gb.addColorStop(1, '#94a3b8'); }
  else { gb.addColorStop(0, k[1]); gb.addColorStop(.35, k[0]); gb.addColorStop(1, k[2]); }
  c.fillStyle = gb; c.fillRect(x - r, y - r, r * 2, r * 2); c.translate(x, y); c.rotate(b.rot);
  if (b.type === 'leiteira') {
    c.strokeStyle = 'rgba(148,163,184,.55)'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(r * .2 * (i - 1), 0, r * (.5 + i * .2), -.5 + i, 1.2 + i); c.stroke(); }
  } else {
    const dark = b.type === 'olhopreto';
    for (let i = 0; i < 3; i++) {
      c.rotate(2.094);
      c.fillStyle = dark ? k[1] : 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(r * .3, -r * .35, r * .9, -r * .15, r * 1.05, 0); c.bezierCurveTo(r * .9, r * .12, r * .35, r * .2, 0, 0); c.fill();
      c.fillStyle = dark ? 'rgba(255,200,80,.5)' : k[1]; c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(r * .25, -r * .15, r * .6, -r * .08, r * .75, 0); c.bezierCurveTo(r * .6, r * .06, r * .25, r * .1, 0, 0); c.fill();
    }
  }
  c.restore();
  const hl = c.createRadialGradient(x - r * .38, y - r * .42, 0, x - r * .38, y - r * .42, r * .55);
  hl.addColorStop(0, 'rgba(255,255,255,.95)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl; c.beginPath(); c.arc(x - r * .38, y - r * .42, r * .55, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x + r * .35, y + r * .45, r * .28, r * .14, -.6, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r - .5, 0, 7); c.stroke();
}

/* ---------- som de vidro ---------- */
let AC = null;
export function clack(vol, hi) {
  if (!soundOn()) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const n = AC.sampleRate * .04, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gn = AC.createGain();
    f.type = 'bandpass'; f.frequency.value = hi ? 4200 : 2600; f.Q.value = 3; gn.gain.value = Math.min(1, vol);
    s.buffer = b; s.connect(f).connect(gn).connect(AC.destination); s.start();
  } catch {}
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

/* ---------- mesa ----------
  opts: { canvas, box, state, me (índice do jogador deste aparelho, -1 = só olhando),
          canPlay(): servidor deixou eu jogar agora?, onShoot({vx,vy}), onSettle(ev, S), onChange(S) } */
export function createView(opts) {
  const cv = opts.canvas, box = opts.box, c = cv.getContext('2d');
  let S = clone(opts.state);
  const ground = paintGround(S.mode);
  let queue = [], final = null, aiming = null, drag = null, dust = [], fx = [], lastHit = 0, raf = 0, alive = true;
  let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
  const me = () => opts.me;

  function fit() {
    const r = box.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    const s = Math.min(r.width / W, r.height / H);
    view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
  }
  fit();
  const ro = new ResizeObserver(fit); ro.observe(box);

  const idle = () => !S.moving && !aiming && !queue.length;
  const myTurn = () => me() >= 0 && idle() && !final && !S.over && S.turn === me() && (!opts.canPlay || opts.canPlay());

  function events() {
    for (const e of S.events) {
      if (e.type === 'shoot') clack(.8, false);
      if (e.type === 'hit') {
        const now = performance.now();
        if (now - lastHit > 35) {
          lastHit = now; clack(e.force / 8, true);
          if (e.force > 3 || e.sh) { for (let i = 0; i < 6; i++) { const a = Math.random() * 6.3, v = Math.random() * 1.3; dust.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: 2 + Math.random() * 3 }); } buzz(12); }
        }
      }
      if (e.type === 'hole') { clack(.5, false); for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3; dust.push({ x: e.x, y: e.y, vx: Math.cos(a) * .8, vy: Math.sin(a) * .8, life: 1, r: 2 + Math.random() * 2 }); } }
      if (e.type === 'settle') {
        e.got.forEach(b => { fx.push({ x: b.x, y: b.y, life: 1, t: '+1' }); for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3; dust.push({ x: b.x, y: b.y, vx: Math.cos(a), vy: Math.sin(a), life: 1, r: 2 + Math.random() * 3 }); } });
        const sh = S.players[e.pi].sh;
        if (e.hole != null) fx.push({ x: HOLES[e.hole][0], y: HOLES[e.hole][1] - 20, life: 1, t: e.matador ? 'MATADOR!' : '✓' });
        if (e.kill) { fx.push({ x: sh.x, y: sh.y - 24, life: 1, t: S.mode === 'matamata' ? '+1' : 'MATOU!' }); buzz(40); }
        if (e.got.length || e.hole != null || e.kill) sfx('coin');
        opts.onSettle && opts.onSettle(e, S);
        opts.onChange && opts.onChange(S);
      }
    }
    S.events.length = 0;
  }

  function aimDots(sh, ang, p) {
    // pontinhos até onde a bolinha pararia se não batesse em nada
    const v = p * VK, dist = Math.min(1100, v / (1 - FRICTION)), n = Math.max(4, Math.min(34, dist / 16 | 0));
    for (let i = 1; i <= n; i++) {
      const d = sh.r + 6 + (dist - sh.r - 6) * i / n, x = sh.x + Math.cos(ang) * d, y = sh.y + Math.sin(ang) * d;
      if (x < 0 || x > W || y < 0 || y > H) break;
      c.fillStyle = `rgba(255,255,255,${(1 - i / (n + 1)) * .85 + .1})`;
      c.beginPath(); c.arc(x, y, i === n ? 4.2 : 3 - i / n * 1.4, 0, 7); c.fill();
    }
    const ex = sh.x + Math.cos(ang) * dist, ey = sh.y + Math.sin(ang) * dist;
    if (ex > 0 && ex < W && ey > 0 && ey < H) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(ex, ey, sh.r, 0, 7); c.stroke(); }
  }

  function draw(now) {
    const { s, ox, oy, dpr } = view;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = cv.width / dpr, ch = cv.height / dpr, k = Math.max(cw / W, ch / H);
    c.drawImage(ground, (cw - W * k) / 2, (ch - H * k) / 2, W * k, H * k); c.fillStyle = 'rgba(15,8,2,.55)'; c.fillRect(0, 0, cw, ch);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    c.drawImage(ground, 0, 0, W, H);
    // búlica: o buraco que eu preciso acertar pisca
    if (S.mode === 'bulica' && me() >= 0 && !S.over) {
      const tg = target(S, me());
      if (tg != null && tg !== 'matador') {
        const [x, y] = HOLES[tg], kk = (now / 700) % 1;
        c.strokeStyle = `rgba(253,230,138,${(1 - kk) * .9})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, HOLE_R + 4 + kk * 14, 0, 7); c.stroke();
      }
    }
    for (const p of dust) { c.fillStyle = `rgba(225,190,145,${p.life * .5})`; c.beginPath(); c.arc(p.x, p.y, p.r * (1.6 - p.life), 0, 7); c.fill(); }
    S.balls.forEach(b => { if (!b.out) marble(c, b); });
    S.players.forEach((p, i) => {
      marble(c, p.sh);
      if (S.mode === 'bulica' && p.step >= 5) { c.font = '18px sans-serif'; c.textAlign = 'center'; c.fillText('💀', p.sh.x, p.sh.y - p.sh.r - 6); }
      if (i === S.turn && !S.over && !S.moving && !drag && !aiming) {
        const kk = (now / 900) % 1, mine = i === me();
        c.strokeStyle = mine ? `rgba(255,240,200,${(1 - kk) * .8})` : `rgba(255,140,120,${(1 - kk) * .6})`; c.lineWidth = 2;
        c.beginPath(); c.arc(p.sh.x, p.sh.y, p.sh.r + 4 + kk * 18, 0, 7); c.stroke();
      }
    });
    let aim = null;
    if (drag) { const sh = S.players[me()].sh, dx = drag.x - sh.x, dy = drag.y - sh.y; aim = { sh, ang: Math.atan2(dy, dx) + Math.PI, p: Math.min(Math.sqrt(dx * dx + dy * dy), MAXP), mine: true }; }
    if (aiming) aim = { sh: S.players[S.turn].sh, ang: Math.atan2(aiming.vy, aiming.vx), p: Math.min(1, (now - aiming.t0) / 600) * Math.sqrt(aiming.vx ** 2 + aiming.vy ** 2) / VK };
    if (aim) {
      const { sh, ang, p } = aim, col = p > MAXP * .7 ? '239,68,68' : p > MAXP * .38 ? '245,158,11' : '74,222,128';
      aimDots(sh, ang, p);
      c.lineWidth = 5; c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(sh.x, sh.y, sh.r + 10, 0, 7); c.stroke();
      c.strokeStyle = `rgb(${col})`; c.beginPath(); c.arc(sh.x, sh.y, sh.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p / MAXP); c.stroke();
      const pct = Math.round(p / MAXP * 100) + '%', ly = sh.y + (sh.y > 60 ? -sh.r - 18 : sh.r + 28);
      c.font = '700 15px Oswald, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(30,12,2,.85)'; c.strokeText(pct, sh.x, ly); c.fillStyle = `rgb(${col})`; c.fillText(pct, sh.x, ly);
      if (drag) { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(drag.x, drag.y); c.stroke(); c.setLineDash([]); }
    }
    for (const f of fx) {
      c.globalAlpha = Math.min(1, f.life * 1.5); c.font = `700 ${f.t.length > 3 ? 22 : 26}px Oswald, Rubik, sans-serif`; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(40,18,4,.8)'; c.strokeText(f.t, f.x, f.y); c.fillStyle = '#fde68a'; c.fillText(f.t, f.x, f.y); c.globalAlpha = 1;
    }
  }

  function loop(now) {
    if (!alive) return;
    if (S.moving) { step(S); events(); }
    else if (aiming) {
      if (now - aiming.t0 > 750) { const a = aiming; aiming = null; launch(S, a.vx, a.vy); events(); }
    } else if (queue.length) {
      const sh = queue.shift();
      S = clone(sh.pre); S.events = [];
      aiming = { vx: sh.vx, vy: sh.vy, t0: now };
      opts.onChange && opts.onChange(S);
    } else if (final) { S = final; final = null; opts.onChange && opts.onChange(S); }
    for (const p of dust) { p.x += p.vx; p.y += p.vy; p.vx *= .95; p.vy *= .95; p.life -= .02; }
    dust = dust.filter(p => p.life > 0);
    for (const f of fx) { f.y -= .6; f.life -= .012; }
    fx = fx.filter(f => f.life > 0);
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s }; };
  const down = e => {
    if (!myTurn()) return;
    const p = pt(e), sh = S.players[me()].sh;
    if (Math.hypot(p.x - sh.x, p.y - sh.y) < 80) { drag = p; try { cv.setPointerCapture(e.pointerId); } catch {} }
  };
  const move = e => { if (drag) drag = pt(e); };
  const up = () => {
    if (!drag) return;
    const sh = S.players[me()].sh, dx = drag.x - sh.x, dy = drag.y - sh.y, p = Math.min(Math.hypot(dx, dy), MAXP);
    drag = null; if (p < 10 || !myTurn()) return;
    const v = velOf(Math.atan2(dy, dx) + Math.PI, p);
    const used = launch(S, v.vx, v.vy); events();
    if (used) opts.onShoot && opts.onShoot({ vx: used.vx, vy: used.vy });
    opts.onChange && opts.onChange(S);
  };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  raf = requestAnimationFrame(loop);

  return {
    get state() { return S; },
    busy: () => !idle() || !!final,
    myTurn,
    // tecadas para animar (cada uma com a mesa de antes)
    push(shots) { queue.push(...shots); },
    // como a mesa fica no fim (mostrada quando a fila acaba)
    setFinal(st) { final = clone(st); final.events = []; },
    // troca a mesa na hora (sem animar)
    reset(st) { queue = []; aiming = null; drag = null; S = clone(st); S.events = []; final = null; opts.onChange && opts.onChange(S); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
    },
  };
}
