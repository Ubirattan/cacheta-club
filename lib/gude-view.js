'use client';
// Desenho e animação da mesa da gude (chão de terra, bolinhas, mira, poeira, som).
// Usado contra o computador e no online. As tecadas chegam numa fila e cada uma é
// refeita a partir da cópia da mesa (pre) com a mesma velocidade (vx, vy) do servidor.
import { W, H, LINE, TRI, MAXP, VK, FRICTION, HOLES, HOLE_R, step, launch, velOf, target } from './gude.js';
import { sfx, soundOn, audioCtx } from './sfx.js';

const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- fotos da rua (Jd. Guaracy) ---------- */
// rua-chao.jpg: o asfalto da calçada, vira o chão da mesa. rua-fundo.jpg: a rua inteira, desfocada, em volta.
// Enquanto as fotos não chegam, usa o desenho antigo; quando chegam, a mesa é redesenhada.
const FOTOS = {};
export function foto(nome, onLoad) {
  if (typeof Image === 'undefined') return null;
  let f = FOTOS[nome];
  if (!f) { f = FOTOS[nome] = { img: new Image(), ok: false, cbs: [] }; f.img.onload = () => { f.ok = true; f.cbs.splice(0).forEach(cb => cb()); }; f.img.src = '/gude/' + nome; }
  if (f.ok) return f.img;
  if (onLoad) f.cbs.push(onLoad);
  return null;
}

/* ---------- rua em volta do terreno ---------- */
// Vista de cima: o terreno de terra fica num lote com meio-fio, calçada de lajotas,
// e em volta o asfalto com faixa amarela, faixa de pedestre, bueiro, folhas e tampinhas.
// (fx, fy, fw, fh) = onde o terreno aparece, em pixels da tela.
export function paintStreet(cw, ch, fx, fy, fw, fh, dpr /*, fundo */) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr));
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const fundo = arguments[7];
  if (fundo) {   // foto da rua cobrindo a tela, escurecida, com o lote em cima
    const k = Math.max(cw / fundo.width, ch / fundo.height), iw = fundo.width * k, ih = fundo.height * k;
    g.drawImage(fundo, (cw - iw) / 2, (ch - ih) * .45, iw, ih);
    g.fillStyle = 'rgba(8,10,14,.45)'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(fx - 4, fy - 2, fw + 10, fh + 10);
    g.fillStyle = '#9d9a94'; g.fillRect(fx - 5, fy - 5, fw + 10, fh + 10);   // meio-fio em volta
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(fx - 5, fy - 5, fw + 10, 2);
    return cv;
  }
  // asfalto
  g.fillStyle = '#3b3d40'; g.fillRect(0, 0, cw, ch);
  for (let i = 0, n = cw * ch / 60; i < n; i++) {
    const k = rnd(); g.fillStyle = k < .5 ? 'rgba(0,0,0,.22)' : k < .9 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.16)';
    g.fillRect(rnd() * cw, rnd() * ch, 1.2, 1.2);
  }
  for (let i = 0; i < 6; i++) { // remendos
    g.fillStyle = 'rgba(20,20,22,.35)'; g.beginPath();
    g.ellipse(rnd() * cw, rnd() * ch, 20 + rnd() * 40, 12 + rnd() * 22, rnd() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(15,15,15,.6)'; g.lineWidth = 1.2; // rachaduras
  for (let i = 0; i < 10; i++) {
    let x = rnd() * cw, y = rnd() * ch; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 26; y += (rnd() - .5) * 26; g.lineTo(x, y); } g.stroke();
  }
  const SW = 30, CURB = 6;                             // largura da calçada e do meio-fio
  const ox = fx - SW - CURB, oy = fy - SW - CURB, ow = fw + 2 * (SW + CURB), oh = fh + 2 * (SW + CURB);
  const gapL = ox, gapR = cw - (ox + ow), gapT = oy, gapB = ch - (oy + oh);
  // faixa amarela no meio da rua onde sobra espaço
  g.strokeStyle = '#e8b923'; g.lineWidth = 4; g.setLineDash([26, 18]);
  if (gapL > 70) { g.beginPath(); g.moveTo(gapL / 2, 0); g.lineTo(gapL / 2, ch); g.stroke(); }
  if (gapR > 70) { g.beginPath(); g.moveTo(cw - gapR / 2, 0); g.lineTo(cw - gapR / 2, ch); g.stroke(); }
  if (gapT > 70) { g.beginPath(); g.moveTo(0, gapT / 2); g.lineTo(cw, gapT / 2); g.stroke(); }
  if (gapB > 70) { g.beginPath(); g.moveTo(0, ch - gapB / 2); g.lineTo(cw, ch - gapB / 2); g.stroke(); }
  g.setLineDash([]);
  // faixa de pedestre na maior sobra lateral
  const zebra = (x, y, w, h, vert) => {
    g.fillStyle = 'rgba(235,235,230,.82)';
    if (vert) for (let yy = y; yy < y + h; yy += 18) g.fillRect(x, yy, w, 10);
    else for (let xx = x; xx < x + w; xx += 18) g.fillRect(xx, y, 10, h);
  };
  if (Math.max(gapL, gapR) > 50) { const L = gapL >= gapR; zebra(L ? 8 : cw - Math.max(gapL, gapR) + 8, fy + fh * .55, Math.max(gapL, gapR) - 16, 110, true); }
  else if (Math.max(gapT, gapB) > 50) { const T = gapT >= gapB; zebra(fx + fw * .62, T ? 8 : ch - Math.max(gapT, gapB) + 8, 120, Math.max(gapT, gapB) - 16, false); }
  // meio-fio (sombra + concreto)
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ox + 3, oy + 5, ow, oh);
  g.fillStyle = '#b9b6ae'; g.fillRect(ox, oy, ow, oh);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(ox, oy, ow, 2); g.fillRect(ox, oy, 2, oh);
  g.strokeStyle = 'rgba(60,60,60,.45)'; g.lineWidth = 1;
  for (let x = ox + 40; x < ox + ow; x += 46) { g.beginPath(); g.moveTo(x, oy); g.lineTo(x, oy + CURB); g.moveTo(x, oy + oh - CURB); g.lineTo(x, oy + oh); g.stroke(); }
  // calçada de lajotas com matinho nas juntas
  const sx = ox + CURB, sy = oy + CURB, sw = ow - 2 * CURB, sh = oh - 2 * CURB, T = 30;
  g.fillStyle = '#cfc8bb'; g.fillRect(sx, sy, sw, sh);
  for (let y = sy; y < sy + sh; y += T) for (let x = sx; x < sx + sw; x += T) {
    const t = 196 + (rnd() * 22 | 0); g.fillStyle = `rgb(${t},${t - 6},${t - 18})`; g.fillRect(x + 1, y + 1, T - 2, T - 2);
    if (rnd() < .12) { g.strokeStyle = 'rgba(90,80,70,.5)'; g.beginPath(); g.moveTo(x + rnd() * T, y + 2); g.lineTo(x + rnd() * T, y + T - 2); g.stroke(); }
    if (rnd() < .18) { g.fillStyle = 'rgba(95,125,42,.8)'; for (let k = 0; k < 5; k++) g.fillRect(x + (rnd() < .5 ? 0 : T - 2) + rnd() * 2, y + rnd() * T, 2, 3); }
  }
  // bueiro na rua
  const bx = gapL > 50 ? gapL * .3 : gapR > 50 ? cw - gapR * .7 : null, by = fy + fh * .2;
  const gx = bx != null ? bx : fx + fw * .25, gy = bx != null ? by : (gapT > 40 ? gapT * .25 : gapB > 40 ? ch - gapB * .75 : null);
  if (gy != null) {
    g.fillStyle = '#26272a'; g.fillRect(gx - 14, gy - 22, 28, 44); g.strokeStyle = '#6b6d70'; g.lineWidth = 2; g.strokeRect(gx - 14, gy - 22, 28, 44);
    g.strokeStyle = '#55575a'; g.lineWidth = 2.5; for (let y = gy - 16; y < gy + 20; y += 7) { g.beginPath(); g.moveTo(gx - 10, y); g.lineTo(gx + 10, y); g.stroke(); }
  }
  // folhas secas e tampinhas espalhadas
  for (let i = 0; i < 40; i++) {
    const x = rnd() * cw, y = rnd() * ch;
    if (x > fx - 2 && x < fx + fw + 2 && y > fy - 2 && y < fy + fh + 2) continue;
    g.save(); g.translate(x, y); g.rotate(rnd() * 6.3);
    if (rnd() < .78) {
      g.fillStyle = ['#a16207', '#854d0e', '#b45309', '#65a30d'][rnd() * 4 | 0]; g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.stroke();
    } else {
      g.fillStyle = ['#dc2626', '#d4d4d8', '#facc15', '#16a34a'][rnd() * 4 | 0]; g.beginPath(); g.arc(0, 0, 4.5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 3, 0, 7); g.stroke();
    }
    g.restore();
  }
  // sombra do lote por cima da calçada (o terreno é um pouco mais baixo)
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(fx - 3, fy - 3, fw + 6, fh + 6);
  return cv;
}

/* ---------- chão ---------- */
export function paintGround(mode, chao) {   // chao: foto do asfalto (sem ela, desenha terra)
  const K = 2, cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
  const g = cv.getContext('2d'); g.scale(K, K);
  if (chao) {   // chão de asfalto da foto, um pouco mais claro nas bordas pra não ficar chapado
    g.drawImage(chao, 0, 0, W, H);
    const lz = g.createRadialGradient(W * .45, H * .45, 40, W / 2, H / 2, W * .6);
    lz.addColorStop(0, 'rgba(255,240,215,.10)'); lz.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = lz; g.fillRect(0, 0, W, H);
  } else {
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
  }
  const groove = (pts, close, dash) => {
    g.setLineDash(dash || []); g.lineCap = 'round'; g.lineJoin = 'round';
    (chao ? [[6, 'rgba(255,255,255,.18)', 0], [3, 'rgba(245,245,240,.78)', 0], [1, 'rgba(255,255,255,.9)', -.5]]   // giz
          : [[7, 'rgba(55,28,8,.55)', 0], [3, 'rgba(35,16,4,.75)', 0], [1.5, 'rgba(255,224,185,.45)', 2.5]]).forEach(([w, col, o]) => {
      g.lineWidth = w; g.strokeStyle = col; g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + o) : g.moveTo(p[0], p[1] + o)); if (close) g.closePath(); g.stroke();
    });
    g.setLineDash([]);
  };
  if (mode === 'triangulo') { groove(TRI, true); groove([[LINE, 30], [LINE, H - 30]], false, [12, 8]); }
  if (mode === 'bulica') {
    groove([[LINE, 30], [LINE, H - 30]], false, [12, 8]);
    HOLES.forEach(([x, y], i) => {
      g.fillStyle = chao ? 'rgba(200,200,195,.22)' : 'rgba(255,225,185,.25)'; g.beginPath(); g.ellipse(x + 1, y + 2, HOLE_R + 5, HOLE_R + 4, 0, 0, 7); g.fill();
      const hg = g.createRadialGradient(x - 3, y - 4, 1, x, y, HOLE_R + 2);
      hg.addColorStop(0, '#050505'); hg.addColorStop(.7, chao ? '#141414' : '#2a1406'); hg.addColorStop(1, chao ? '#5a5a58' : '#6b4021');
      g.fillStyle = hg; g.beginPath(); g.arc(x, y, HOLE_R + 2, 0, 7); g.fill();
      g.font = '700 22px Oswald, sans-serif'; g.textAlign = 'center'; g.fillStyle = chao ? 'rgba(0,0,0,.5)' : 'rgba(55,28,8,.55)'; g.fillText(String(i + 1), x, y + 52);
      g.fillStyle = chao ? 'rgba(250,250,245,.85)' : 'rgba(255,230,195,.35)'; g.fillText(String(i + 1), x - 1, y + 50);
    });
  }
  if (mode === 'matamata') {
    groove([[W / 2, 40], [W / 2, H - 40]], false, [12, 8]);
    const c = 26; g.strokeStyle = chao ? 'rgba(245,245,240,.75)' : 'rgba(55,28,8,.5)'; g.lineWidth = chao ? 3 : 4;
    [[170, H / 2], [W - 170, H / 2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, c, 0, 7); g.stroke(); });
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, chao ? 'rgba(0,0,0,.45)' : 'rgba(20,8,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
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
// usa o AudioContext que já foi criado num toque de botão (nunca cria aqui: travava o celular na tecada)
export function clack(vol, hi) {
  const AC = audioCtx();
  if (!AC || !soundOn() || AC.state !== 'running') return;
  try {
    const n = Math.floor(AC.sampleRate * .04), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
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
  let S = clone(opts.state); S.events = [];   // a mesa do servidor vem sem a lista de eventos: sem isso a tecada dava erro
  const redo = () => { if (!alive) return; ground = paintGround(S.mode, foto('rua-chao.jpg')); street = null; };
  let ground = paintGround(S.mode, foto('rua-chao.jpg', redo));
  foto('rua-fundo.jpg', redo);
  let queue = [], final = null, aiming = null, drag = null, dust = [], fx = [], lastHit = 0, raf = 0, alive = true;
  let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
  let street = null;   // rua desenhada uma vez por tamanho de tela
  const me = () => opts.me;

  function fit() {
    const r = box.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    const m = Math.max(12, Math.min(r.width, r.height) * .045);   // sobra pra rua aparecer em volta
    const s = Math.max(.1, Math.min((r.width - 2 * m) / W, (r.height - 2 * m) / H));
    view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
    street = null;
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
    if (!street) street = paintStreet(cw, ch, ox, oy, W * s, H * s, dpr, foto('rua-fundo.jpg'));
    c.drawImage(street, 0, 0, cw, ch);
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

  let movingFrames = 0;
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);      // já agenda o próximo: um erro neste quadro não congela a mesa
    try { tick(now); } catch (e) { console.error('gude', e); recover(); }
  }
  // se algo der errado, volta pra mesa certa (a do servidor, se já chegou) em vez de travar
  function recover() {
    drag = null; aiming = null; movingFrames = 0;
    if (S.moving) { for (const b of [S.players[0].sh, S.players[1].sh, ...S.balls]) { b.vx = 0; b.vy = 0; } }
    if (queue.length || final) return;    // a fila/mesa final do servidor arruma o resto
    S.moving = false;
  }
  function tick(now) {
    if (S.moving) {
      // trava de segurança igual à do servidor (simulate, 8000 quadros): bolinha que não para é parada
      if (movingFrames >= 8000) { for (const b of [S.players[0].sh, S.players[1].sh, ...S.balls]) { b.vx = 0; b.vy = 0; } }
      else movingFrames++;
      step(S); events();
      if (!S.moving) movingFrames = 0;
    }
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
  }

  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s }; };
  const down = e => {
    try { const ac = audioCtx(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); } catch {}
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
    const used = launch(S, v.vx, v.vy);     // os eventos (som) saem no próximo quadro do loop
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
