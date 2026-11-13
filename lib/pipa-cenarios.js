// Cenários, linhas e cor da mão do jogo da pipa (tudo desenhado em código, sem foto).
// Usado no 3D (lib/pipa-view3d.js) e nas miniaturas do menu (app/pipa/page.js).

export const CENARIOS = [
  { id: 'bairro', nome: 'Bairro',       ceu: ['#1f5fae', '#5d9fe0', '#a9d3f3', '#f6d9ae'], astro: 'sol' },
  { id: 'tarde',  nome: 'Pôr do sol',   ceu: ['#27286a', '#8a4fa0', '#f0756a', '#ffc46b'], astro: 'solbaixo', nuvem: 0xffc9b8 },
  { id: 'noite',  nome: 'Noite',        ceu: ['#02040c', '#0a1838', '#1d2c55', '#3a3f66'], astro: 'lua', noite: true },
  { id: 'praia',  nome: 'Praia',        ceu: ['#1a6fc4', '#4fb0ea', '#9fdcf7', '#e9f6fb'], astro: 'sol' },
  { id: 'morro',  nome: 'Morro',        ceu: ['#2766b0', '#6aa8e2', '#b8dcf3', '#f3e3c2'], astro: 'sol' },
  { id: 'campo',  nome: 'Campinho',     ceu: ['#2d74c4', '#6fb1e8', '#bfe2f7', '#eaf3d9'], astro: 'sol' },
];
export const CENARIO_PADRAO = 'bairro';
export const cenario = id => CENARIOS.find(c => c.id === id) || CENARIOS[0];

// linha (só a cor da sua linha no céu)
export const LINHAS = [
  { id: 'chilena', nome: 'Chilena', cor: '#f5f5f4' },
  { id: 'preta',   nome: 'Linha 10', cor: '#111827' },
  { id: 'ouro',    nome: 'Dourada', cor: '#f2c94c' },
  { id: 'verm',    nome: 'Vermelha', cor: '#ef4444' },
  { id: 'azul',    nome: 'Azul',    cor: '#3b82f6' },
  { id: 'neon',    nome: 'Neon',    cor: '#4ade80' },
];
export const linha = id => LINHAS.find(l => l.id === id) || LINHAS[0];

// cor da pele das mãos
export const PELES = ['#f1c7a3', '#d9a066', '#a8693f', '#6b3f22'];

const PASSO = [0, .5, .82, 1];
export function pintaCeu(g, w, h, cen) {
  const s = g.createLinearGradient(0, 0, 0, h);
  cen.ceu.forEach((c, i) => s.addColorStop(PASSO[i], c));
  g.fillStyle = s; g.fillRect(0, 0, w, h);
}

const rnd = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function postesEFios(g, w, h, r, cor, topo) {
  const postes = []; for (let x = 90; x < w; x += 300 + r() * 120) postes.push(x);
  g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = 6;
  postes.forEach(x => { g.beginPath(); g.moveTo(x, h); g.lineTo(x, topo - 4); g.stroke(); g.fillRect(x - 18, topo, 36, 5); });
  g.lineWidth = 1.6;
  for (const dy of [0, 8]) for (let j = 1; j < postes.length; j++) {
    const a = postes[j - 1], b = postes[j], y = topo + dy;
    g.beginPath(); g.moveTo(a, y); g.quadraticCurveTo((a + b) / 2, y + 22, b, y); g.stroke();
  }
}

function casas(g, w, h, r, cores, noite, linhas = [[h * .55, 70, .55], [h * .72, 95, 1]]) {
  for (const [base, alt, fade] of linhas) {
    let x = -20;
    while (x < w + 20) {
      const cw = 60 + r() * 110, ch = 30 + r() * alt, top = base - ch;
      g.globalAlpha = fade;
      g.fillStyle = cores[(r() * cores.length) | 0]; g.fillRect(x, top, cw, h - top);
      g.fillStyle = noite ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.12)'; g.fillRect(x + cw - 6, top, 6, h - top);
      g.fillStyle = noite ? '#1a1d2b' : 'rgba(90,80,70,.55)'; g.fillRect(x - 2, top - 4, cw + 4, 5);
      for (let wy = top + 12; wy < base - 10; wy += 26) for (let wx = x + 10; wx < x + cw - 18; wx += 30) {
        if (r() < .35) continue;
        const aceso = noite && r() < .55;
        g.fillStyle = aceso ? '#ffd98a' : noite ? '#141826' : 'rgba(40,50,60,.55)'; g.fillRect(wx, wy, 12, 12);
      }
      if (r() < .55) { const cx = x + 10 + r() * (cw - 40); g.fillStyle = noite ? '#2a4a7a' : '#2f6fb0'; g.fillRect(cx, top - 16, 24, 13); g.fillStyle = noite ? '#335a90' : '#4b8bd0'; g.fillRect(cx - 2, top - 19, 28, 4); }
      if (r() < .35) { const ax = x + 8 + r() * (cw - 16); g.strokeStyle = noite ? '#111' : '#444'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, top - 4); g.lineTo(ax, top - 30); g.moveTo(ax - 8, top - 24); g.lineTo(ax + 8, top - 24); g.stroke(); }
      x += cw + (r() < .2 ? 6 : 0);
    }
  }
  g.globalAlpha = 1;
}

function coqueiro(g, x, base, alt, cor) {
  g.strokeStyle = cor; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + 18, base - alt * .5, x + 10, base - alt); g.stroke();
  g.lineWidth = 5;
  for (const a of [-2.7, -2.2, -1.6, -1, -.45]) {
    g.beginPath(); g.moveTo(x + 10, base - alt);
    g.quadraticCurveTo(x + 10 + Math.cos(a) * 30, base - alt + Math.sin(a) * 30 - 6, x + 10 + Math.cos(a) * 55, base - alt + Math.sin(a) * 18 + 18); g.stroke();
  }
}
function arvore(g, x, base, r, cor) {
  g.fillStyle = '#5b3b22'; g.fillRect(x - 4, base - r * 1.1, 8, r * 1.1);
  g.fillStyle = cor; [[0, -r * 1.4, r], [-r * .6, -r * 1.05, r * .75], [r * .6, -r * 1.05, r * .75]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(x + dx, base + dy, rr, 0, 7); g.fill(); });
}

// horizonte do cenário: faixa 2048 x 256, a parte de baixo toda preenchida
export function pintaHorizonte(g, w, h, id) {
  const cen = cenario(id), r = rnd(11), noite = !!cen.noite;
  if (id === 'praia') {
    g.globalAlpha = .55; casas(g, w * .45, h, r, ['#c7d2dc', '#e5e7eb', '#aab8c6', '#dbe4ee'], false, [[h * .5, 140, 1]]); g.globalAlpha = 1;
    const mar = g.createLinearGradient(0, h * .5, 0, h * .76); mar.addColorStop(0, '#2d82c4'); mar.addColorStop(1, '#5fc0de');
    g.fillStyle = mar; g.fillRect(0, h * .5, w, h * .26);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    for (let k = 0; k < 60; k++) { const x = r() * w, y = h * .55 + r() * h * .2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 30, y); g.stroke(); }
    g.fillStyle = '#f4f4f5'; g.beginPath(); g.moveTo(w * .7, h * .5); g.lineTo(w * .7 + 30, h * .5); g.lineTo(w * .7 + 26, h * .52); g.lineTo(w * .7 + 4, h * .52); g.fill();
    g.fillRect(w * .7 + 14, h * .5 - 22, 2, 22); g.beginPath(); g.moveTo(w * .7 + 16, h * .5 - 22); g.lineTo(w * .7 + 30, h * .5 - 4); g.lineTo(w * .7 + 16, h * .5 - 4); g.fill();
    g.fillStyle = '#ead7a4'; g.fillRect(0, h * .76, w, h * .24);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, h * .755, w, 4);
    for (let x = 60; x < w; x += 180 + r() * 220) coqueiro(g, x, h, 110 + r() * 70, '#2f4a2a');
    return;
  }
  if (id === 'morro') {
    for (const [base, cor, amp, fase] of [[h * .2, '#5d8a5a', 50, 0], [h * .38, '#4f7a4c', 40, 2]]) {
      g.fillStyle = cor; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, base + Math.sin(x / 260 + fase) * amp + Math.sin(x / 90) * 8);
      g.lineTo(w, h); g.fill();
      const cores = ['#d9784a', '#c2410c', '#e8b04a', '#5b8fb9', '#d8d2c4', '#b45309', '#e07a8a', '#a3a3a3', '#f5f5f4'];
      for (let i = 0; i < 520; i++) {
        const x = r() * w, top = base + Math.sin(x / 260 + fase) * amp + Math.sin(x / 90) * 8, y = top + 6 + r() * (h - top);
        const cw = 10 + r() * 16, ch = 8 + r() * 10;
        g.fillStyle = cores[(r() * cores.length) | 0]; g.fillRect(x, y, cw, ch);
        g.fillStyle = 'rgba(0,0,0,.35)'; if (r() < .6) g.fillRect(x + 3, y + 3, 3, 3);
        if (r() < .08) { g.fillStyle = '#2f6fb0'; g.fillRect(x + 2, y - 5, 7, 5); }
      }
    }
    postesEFios(g, w, h, r, '#3a3530', h * .55);
    return;
  }
  if (id === 'campo') {
    g.fillStyle = '#7fa6b8'; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, h * .42 + Math.sin(x / 300) * 22 + Math.sin(x / 110) * 6); g.lineTo(w, h); g.fill();
    for (let x = 20; x < w; x += 40 + r() * 70) arvore(g, x, h * .66, 16 + r() * 14, ['#3f7a3a', '#4b8a40', '#356b33'][(r() * 3) | 0]);
    g.fillStyle = '#5fa04a'; g.fillRect(0, h * .66, w, h * .34);
    g.fillStyle = 'rgba(255,255,255,.1)'; for (let x = 0; x < w; x += 120) g.fillRect(x, h * .66, 60, h * .34);
    g.strokeStyle = 'rgba(60,60,60,.6)'; g.lineWidth = 1;   // alambrado
    for (let x = 0; x < w; x += 12) { g.beginPath(); g.moveTo(x, h * .6); g.lineTo(x + 12, h * .66); g.moveTo(x + 12, h * .6); g.lineTo(x, h * .66); g.stroke(); }
    g.strokeStyle = '#f8fafc'; g.lineWidth = 5;   // trave
    for (const x of [w * .3, w * .78]) { g.beginPath(); g.moveTo(x, h * .8); g.lineTo(x, h * .62); g.lineTo(x + 90, h * .62); g.lineTo(x + 90, h * .8); g.stroke(); }
    postesEFios(g, w, h, r, '#3a3530', h * .3);
    return;
  }
  // bairro (dia, tarde, noite)
  const cores = noite ? ['#2a2f45', '#2f3550', '#262b3f', '#34324a', '#2b3348']
    : ['#c98f6b', '#e3d3b8', '#b5654a', '#d9b98c', '#9fb7c9', '#e8c97a', '#c7c0b4', '#a8735a'];
  casas(g, w, h, r, cores, noite);
  postesEFios(g, w, h, r, noite ? '#0b0d16' : '#3a3530', h * .2);
  if (noite) { g.fillStyle = 'rgba(8,14,40,.35)'; g.fillRect(0, 0, w, h); }
  if (id === 'tarde') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,110,60,.22)'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
}

// miniatura / fundo do menu: céu + astro + horizonte embaixo
export function pintaPreview(g, w, h, id) {
  const cen = cenario(id);
  pintaCeu(g, w, h, cen);
  if (cen.astro === 'lua') {
    const r = rnd(5); g.fillStyle = '#fff';
    for (let i = 0; i < w * h / 900; i++) { g.globalAlpha = .3 + r() * .6; g.fillRect(r() * w, r() * h * .7, 1.3, 1.3); }
    g.globalAlpha = 1; g.fillStyle = '#f1f0e4'; g.beginPath(); g.arc(w * .2, h * .22, h * .07, 0, 7); g.fill();
  } else {
    const sx = w * .78, sy = cen.astro === 'solbaixo' ? h * .55 : h * .2, sr = h * (cen.astro === 'solbaixo' ? .12 : .07);
    const gl = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.5); gl.addColorStop(0, 'rgba(255,250,230,.9)'); gl.addColorStop(1, 'rgba(255,250,230,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h);
    g.fillStyle = cen.astro === 'solbaixo' ? '#ffb347' : '#fffbe8'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  }
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  pintaHorizonte(c.getContext('2d'), 2048, 256, id);
  const hh = h * .42, sw = Math.min(2048, 256 * w / hh);   // um pedaço do horizonte, sem esticar
  g.drawImage(c, 0, 0, sw, 256, 0, h - hh, w, hh);
}
