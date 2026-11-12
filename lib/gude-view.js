'use client';
// Desenho e animação da mesa da gude (chão de terra, bolinhas, mira, poeira, som).
// Usado contra o computador e no online. As tecadas chegam numa fila e cada uma é
// refeita a partir da cópia da mesa (pre) com a mesma velocidade (vx, vy) do servidor.
import { W, H, LINE, TRI, MAXP, VK, FRICTION, HOLES, HOLE_R, RUA, world, step, launch, velOf, target } from './gude.js';
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

/* ---------- a rua (mata-mata), vista de cima ---------- */
const R0 = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);   // mesmo desenho sempre
function tex(g, x, y, w, h, n, cols, size = 1.6) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const r = R0() * size + .4; g.fillRect(x + R0() * w, y + R0() * h, r, r); }
}
export function paintRua(chao) {   // chao: foto do asfalto (Jd. Guaracy), repetida como textura
  const { w, h, cross, top, bot, mid, midGap, trees, poles, cars, drains } = RUA;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  // asfalto
  g.fillStyle = '#3d4146'; g.fillRect(0, 0, w, h);
  if (chao) {
    const tw = 460, th = tw * chao.height / chao.width;
    for (let y = 0, j = 0; y < h; y += th, j++) for (let x = 0, i = 0; x < w; x += tw, i++) {
      g.save(); g.translate(x + (i % 2 ? tw : 0), y + (j % 2 ? th : 0)); g.scale(i % 2 ? -1 : 1, j % 2 ? -1 : 1);   // espelha pra não ver emenda
      g.drawImage(chao, 0, 0, tw, th); g.restore();
    }
    g.fillStyle = 'rgba(40,44,50,.35)'; g.fillRect(0, 0, w, h);
  }
  tex(g, 0, 0, w, h, 60000, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.18)', 'rgba(140,140,150,.12)']);
  for (let i = 0; i < 14; i++) { const x = R0() * w, y = top + R0() * (bot - top); g.fillStyle = 'rgba(20,22,25,.35)'; g.fillRect(x, y, 60 + R0() * 140, 30 + R0() * 60); }   // remendos
  for (let i = 0; i < 10; i++) { const x = R0() * w, y = top + 40 + R0() * (bot - top - 80), r = 10 + R0() * 22; const og = g.createRadialGradient(x, y, 1, x, y, r); og.addColorStop(0, 'rgba(10,10,14,.5)'); og.addColorStop(1, 'rgba(10,10,14,0)'); g.fillStyle = og; g.beginPath(); g.ellipse(x, y, r * 1.4, r, R0() * 3, 0, 7); g.fill(); }  // óleo
  g.strokeStyle = 'rgba(15,15,18,.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) { let x = R0() * w, y = R0() * h, a = R0() * 6.3; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { a += (R0() - .5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); } g.stroke(); }
  // faixas
  const outCross = (x0, x1) => [[x0, Math.min(x1, cross[0] - 60)], [Math.max(x0, cross[1] + 60), x1]].filter(([a, b]) => b > a);
  g.fillStyle = 'rgba(240,240,235,.8)';
  for (const y of [324, 676]) for (const [a, b] of outCross(0, w)) for (let x = a + 20; x < b - 40; x += 90) g.fillRect(x, y - 3, 46, 6);
  g.fillStyle = 'rgba(250,204,21,.85)';
  for (const [a, b] of [[0, midGap[0]], [midGap[1], w]]) { g.fillRect(a, mid[0] - 9, b - a, 4); g.fillRect(a, mid[1] + 5, b - a, 4); }
  // faixas de pedestre
  g.fillStyle = 'rgba(245,245,240,.85)';
  for (const x0 of [cross[0] - 52, cross[1] + 12]) for (let y = top + 10; y < bot - 10; y += 26) if (y > mid[1] + 4 || y + 14 < mid[0] - 4 || true) g.fillRect(x0, y, 40, 14);
  for (const y0 of [top - 52, bot + 12]) for (let x = cross[0] + 12; x < cross[1] - 10; x += 26) g.fillRect(x, y0, 14, 40);
  // canteiro central
  for (const [a, b] of [[0, midGap[0]], [midGap[1], w]]) {
    g.fillStyle = '#c9c3b5'; g.fillRect(a, mid[0] - 4, b - a, mid[1] - mid[0] + 8);
    g.fillStyle = '#4f7a2c'; g.fillRect(a, mid[0], b - a, mid[1] - mid[0]);
    tex(g, a, mid[0], b - a, mid[1] - mid[0], (b - a) * 6, ['#3f6a22', '#6b9a3a', '#5a8a30', '#2f5418'], 2.2);
  }
  // calçadas (4 quarteirões)
  const blocks = [[0, 0, cross[0], top], [cross[1], 0, w - cross[1], top], [0, bot, cross[0], h - bot], [cross[1], bot, w - cross[1], h - bot]];
  for (const [x, y, bw, bh] of blocks) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x - 3, y - 3, bw + 6, bh + 6);   // sombra do meio-fio no asfalto
    g.fillStyle = '#bdb6a6'; g.fillRect(x, y, bw, bh);
    tex(g, x, y, bw, bh, bw * bh / 30, ['rgba(255,255,255,.12)', 'rgba(80,70,55,.18)'], 1.8);
    g.strokeStyle = 'rgba(90,82,68,.35)'; g.lineWidth = 1;
    for (let gx = x; gx < x + bw; gx += 44) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + bh); g.stroke(); }
    for (let gy = y; gy < y + bh; gy += 44) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + bw, gy); g.stroke(); }
    g.strokeStyle = '#e4dfd2'; g.lineWidth = 7; g.strokeRect(x + 3.5, y + 3.5, bw - 7, bh - 7);    // meio-fio
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(x + 7.5, y + 7.5, bw - 15, bh - 15);
  }
  // árvores: canteiro de terra em volta do tronco
  for (const t of trees) {
    if (t.y !== 500) { g.fillStyle = '#6b4a2b'; g.fillRect(t.x - 30, t.y - 30, 60, 60); tex(g, t.x - 30, t.y - 30, 60, 60, 400, ['#5a3c22', '#80603e'], 2); g.strokeStyle = '#8f8778'; g.lineWidth = 4; g.strokeRect(t.x - 30, t.y - 30, 60, 60); }
    const tg = g.createRadialGradient(t.x - 4, t.y - 4, 2, t.x, t.y, t.r); tg.addColorStop(0, '#8a5a32'); tg.addColorStop(1, '#4a2e17');
    g.fillStyle = tg; g.beginPath(); g.arc(t.x, t.y, t.r, 0, 7); g.fill();
  }
  // postes (com a sombra comprida)
  for (const p of poles) {
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 120, p.y + 50); g.stroke();
    g.fillStyle = '#5b6068'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); g.fillStyle = '#9aa1ab'; g.beginPath(); g.arc(p.x - 2, p.y - 2, p.r * .45, 0, 7); g.fill();
  }
  // bueiros
  for (const d of drains) {
    g.fillStyle = '#16181b'; g.beginPath(); g.arc(d.x, d.y, d.r + 5, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(d.x, d.y, d.r + 2, 0, 7); g.clip();
    g.fillStyle = '#05060a'; g.fillRect(d.x - 30, d.y - 30, 60, 60);
    g.fillStyle = '#5b5f66'; for (let k = -d.r; k <= d.r; k += 6) g.fillRect(d.x + k, d.y - d.r - 2, 2.5, d.r * 2 + 4);
    g.restore();
    g.strokeStyle = '#7d828a'; g.lineWidth = 2.5; g.beginPath(); g.arc(d.x, d.y, d.r + 3, 0, 7); g.stroke();
  }
  // carros estacionados
  const cores = [['#b91c1c', '#ef4444'], ['#1d4ed8', '#60a5fa'], ['#e5e7eb', '#ffffff'], ['#15803d', '#4ade80']];
  cars.forEach((c, i) => {
    const [d, l] = cores[i % cores.length], rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, r) : g.rect(x, y, ww, hh); };
    g.fillStyle = 'rgba(0,0,0,.4)'; rr(c.x + 6, c.y + 8, c.w, c.h, 18); g.fill();
    const cg = g.createLinearGradient(0, c.y, 0, c.y + c.h); cg.addColorStop(0, l); cg.addColorStop(.5, d); cg.addColorStop(1, l);
    g.fillStyle = cg; rr(c.x, c.y, c.w, c.h, 18); g.fill();
    g.fillStyle = 'rgba(15,23,42,.85)'; rr(c.x + c.w * .22, c.y + 8, c.w * .2, c.h - 16, 8); g.fill(); rr(c.x + c.w * .68, c.y + 10, c.w * .12, c.h - 20, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; rr(c.x + c.w * .43, c.y + 10, c.w * .24, c.h - 20, 6); g.fill();
    g.fillStyle = '#fde68a'; g.fillRect(c.x + c.w - 6, c.y + 8, 5, 14); g.fillRect(c.x + c.w - 6, c.y + c.h - 22, 5, 14);
    g.fillStyle = '#dc2626'; g.fillRect(c.x + 1, c.y + 8, 4, 12); g.fillRect(c.x + 1, c.y + c.h - 20, 4, 12);
  });
  // folhas soltas
  for (let i = 0; i < 260; i++) { const x = R0() * w, y = R0() * h; g.fillStyle = ['#a16207', '#65a30d', '#854d0e', '#ca8a04'][i % 4]; g.beginPath(); g.ellipse(x, y, 4, 2, R0() * 3, 0, 7); g.fill(); }
  return cv;
}
// copa das árvores: desenhada por cima das bolinhas (meio transparente)
export function paintCopas() {
  const { w, h, trees } = RUA, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (const t of trees) {
    const R = t.y === 500 ? 46 : 62;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(t.x + 18, t.y + 22, R, 0, 7); g.fill();
    for (let k = 0; k < 7; k++) {
      const a = k * .9 + t.x, x = t.x + Math.cos(a) * R * .45, y = t.y + Math.sin(a) * R * .45, r = R * (.55 + (k % 3) * .08);
      const cg = g.createRadialGradient(x - r * .3, y - r * .35, 2, x, y, r);
      cg.addColorStop(0, '#7cbf4a'); cg.addColorStop(.6, '#3f7d26'); cg.addColorStop(1, '#24531a');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
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
  const rua = S.mode === 'matamata', WD = world(S.mode);
  // fotos da rua: no Triângulo e no Buraco a foto é o chão; no Mata-mata o asfalto da foto cobre a rua desenhada
  const redo = () => { if (!alive) return; ground = rua ? paintRua(foto('rua-chao.jpg')) : paintGround(S.mode, foto('rua-chao.jpg')); street = null; };
  let ground = rua ? paintRua(foto('rua-chao.jpg', redo)) : paintGround(S.mode, foto('rua-chao.jpg', redo));
  if (!rua) foto('rua-fundo.jpg', redo);
  const copas = rua ? paintCopas() : null;
  let cam = null, camFree = false, pan = null;      // câmera (só na rua)
  let queue = [], final = null, aiming = null, drag = null, dust = [], fx = [], lastHit = 0, raf = 0, alive = true;
  let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
  let street = null;   // rua desenhada uma vez por tamanho de tela
  const me = () => opts.me;

  function fit() {
    const r = box.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    let s;
    if (rua) s = Math.min(r.width / 1000, r.height / 490);
    else {
      const m = Math.max(12, Math.min(r.width, r.height) * .045);   // sobra pra rua aparecer em volta
      s = Math.max(.1, Math.min((r.width - 2 * m) / W, (r.height - 2 * m) / H));
    }
    view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr, rw: r.width, rh: r.height };
    street = null;
    if (rua) placeCam(true);
  }
  fit();
  const ro = new ResizeObserver(fit); ro.observe(box);

  // câmera da rua: segue a bolinha que está andando; parada, vai pra bolinha de quem joga
  function placeCam(snap) {
    const { s, rw, rh } = view, vw = rw / s, vh = rh / s;
    let tx, ty;
    if (S.moving) { let b = S.players[S.turn].sh, best = -1; for (const p of S.players) { const v = Math.abs(p.sh.vx) + Math.abs(p.sh.vy); if (v > best) { best = v; b = p.sh; } } tx = b.x; ty = b.y; }
    else if (camFree && cam) { tx = cam.x; ty = cam.y; }
    else { const b = S.players[S.turn].sh; tx = b.x; ty = b.y; }
    const cx = v => WD.w <= vw ? WD.w / 2 : Math.max(vw / 2, Math.min(WD.w - vw / 2, v));
    const cy = v => WD.h <= vh ? WD.h / 2 : Math.max(vh / 2, Math.min(WD.h - vh / 2, v));
    tx = cx(tx); ty = cy(ty);
    if (!cam || snap) cam = { x: tx, y: ty };
    else { const k = S.moving ? .14 : .08; cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
    view.ox = rw / 2 - cam.x * s; view.oy = rh / 2 - cam.y * s;
  }

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
      if (e.type === 'bump') { clack(Math.min(1, e.force / 7), e.kind === 'poste' || e.kind === 'carro'); if (e.force > 2.5) { for (let i = 0; i < 5; i++) { const a = Math.random() * 6.3; dust.push({ x: e.x, y: e.y, vx: Math.cos(a), vy: Math.sin(a), life: 1, r: 2 + Math.random() * 2 }); } buzz(10); } }
      if (e.type === 'curb') clack(Math.min(.6, e.force / 10), false);
      if (e.type === 'bueiro') { fx.push({ x: e.x, y: e.y - 22, life: 1, t: 'BUEIRO!' }); sfx('err'); buzz(30); }
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
      if (x < 0 || x > WD.w || y < 0 || y > WD.h) break;
      c.fillStyle = `rgba(255,255,255,${(1 - i / (n + 1)) * .85 + .1})`;
      c.beginPath(); c.arc(x, y, i === n ? 4.2 : 3 - i / n * 1.4, 0, 7); c.fill();
    }
    const ex = sh.x + Math.cos(ang) * dist, ey = sh.y + Math.sin(ang) * dist;
    if (ex > 0 && ex < WD.w && ey > 0 && ey < WD.h) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(ex, ey, sh.r, 0, 7); c.stroke(); }
  }

  function draw(now) {
    const { s, ox, oy, dpr } = view;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = cv.width / dpr, ch = cv.height / dpr;
    if (rua) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, cw, ch); }
    else {
      if (!street) street = paintStreet(cw, ch, ox, oy, W * s, H * s, dpr, foto('rua-fundo.jpg'));
      c.drawImage(street, 0, 0, cw, ch);
    }
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    c.drawImage(ground, 0, 0, WD.w, WD.h);
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
    if (copas) { c.globalAlpha = .82; c.drawImage(copas, 0, 0); c.globalAlpha = 1; }
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
    if (rua) overlay(cw, ch);
  }

  // minimapa no canto + seta pra bolinha que está fora da tela
  function overlay(cw, ch) {
    const { s, ox, oy, dpr } = view;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mw = Math.min(170, cw * .22), mh = mw * WD.h / WD.w, mx = cw - mw - 8, my = 8, k = mw / WD.w;
    c.globalAlpha = .9; c.drawImage(ground, mx, my, mw, mh); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.strokeRect(mx, my, mw, mh);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; c.strokeRect(mx + (-ox / s) * k, my + (-oy / s) * k, cw / s * k, ch / s * k);
    S.players.forEach((p, i) => {
      c.fillStyle = i === me() ? '#ffffff' : i === 0 ? '#e2e8f0' : '#f59e0b';
      c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.arc(mx + p.sh.x * k, my + p.sh.y * k, 4, 0, 7); c.fill(); c.stroke();
      // seta na borda da tela
      const sx = ox + p.sh.x * s, sy = oy + p.sh.y * s, pad = 26;
      if (sx > -6 && sx < cw + 6 && sy > -6 && sy < ch + 6) return;
      const ax = Math.max(pad, Math.min(cw - pad, sx)), ay = Math.max(pad, Math.min(ch - pad, sy)), a = Math.atan2(sy - ay, sx - ax);
      const dist = Math.round(Math.hypot(sx - cw / 2, sy - ch / 2) / s / 10);
      c.save(); c.translate(ax, ay); c.rotate(a);
      c.fillStyle = i === me() ? 'rgba(255,255,255,.95)' : 'rgba(245,158,11,.95)'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.fill(); c.stroke(); c.restore();
      c.font = '700 12px Oswald, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)';
      const lbl = (i === me() ? 'você' : (S.players[i].name || '').slice(0, 8)) + ` ${dist}m`;
      c.strokeText(lbl, ax - Math.cos(a) * 20, ay - Math.sin(a) * 20 + 4); c.fillStyle = '#fff'; c.fillText(lbl, ax - Math.cos(a) * 20, ay - Math.sin(a) * 20 + 4);
    });
  }

  let movingFrames = 0, lastTurn = S.turn;
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
    if (rua) { if (S.moving || aiming || S.turn !== lastTurn) camFree = false; lastTurn = S.turn; placeCam(false); }
    draw(now);
  }

  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s }; };
  const down = e => {
    try { const ac = audioCtx(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); } catch {}
    const p = pt(e), sh = me() >= 0 ? S.players[me()].sh : null;
    if (myTurn() && sh && Math.hypot(p.x - sh.x, p.y - sh.y) < 80) { drag = p; try { cv.setPointerCapture(e.pointerId); } catch {} return; }
    // rua: arrastar fora da bolinha passeia com a câmera pela rua
    if (rua && cam && !S.moving) { pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; try { cv.setPointerCapture(e.pointerId); } catch {} }
  };
  const move = e => {
    if (drag) drag = pt(e);
    else if (pan) { cam.x = pan.cx - (e.clientX - pan.x) / view.s; cam.y = pan.cy - (e.clientY - pan.y) / view.s; camFree = true; }
  };
  const up = () => {
    pan = null;
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
