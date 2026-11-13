// Modelos de pipa (desenhos nossos, feitos em código): usados no jogo (2D e 3D) e na loja.
// Cada modelo tem um desenho (estilo), duas cores e as cores da rabiola.
// O catálogo de venda fica em lib/shop-items.js (slot 'pipa'), com o mesmo id.

export const MODELOS = {
  'pipa-classica': { estilo: 'meia',    c: ['#ef4444', '#facc15'], rab: ['#ef4444', '#facc15'] },
  'pipa-ceu':      { estilo: 'meia',    c: ['#2563eb', '#f8fafc'], rab: ['#2563eb', '#f8fafc'] },
  'pipa-listrada': { estilo: 'listras', c: ['#16a34a', '#fde047'], rab: ['#16a34a', '#fde047'] },
  'pipa-xadrez':   { estilo: 'xadrez',  c: ['#111827', '#f9fafb'], rab: ['#111827', '#ef4444'] },
  'pipa-alvo':     { estilo: 'alvo',    c: ['#f97316', '#1e3a8a'], rab: ['#f97316', '#1e3a8a'] },
  'pipa-estrela':  { estilo: 'estrela', c: ['#7c3aed', '#fde047'], rab: ['#7c3aed', '#fde047'] },
  'pipa-raio':     { estilo: 'raio',    c: ['#0f172a', '#facc15'], rab: ['#facc15', '#0f172a'] },
  'pipa-fogo':     { estilo: 'fogo',    c: ['#7f1d1d', '#f97316'], rab: ['#dc2626', '#fbbf24'] },
  'pipa-arco':     { estilo: 'arco',    c: ['#ef4444', '#3b82f6'], rab: ['#ef4444', '#22c55e'] },
  'pipa-caveira':  { estilo: 'caveira', c: ['#18181b', '#f4f4f5'], rab: ['#18181b', '#a1a1aa'] },
  'pipa-coroa':    { estilo: 'coroa',   c: ['#1c1917', '#f2c94c'], rab: ['#f2c94c', '#1c1917'] },
  'pipa-laranja':  { estilo: 'meia',    c: ['#f97316', '#111827'], rab: ['#f97316', '#111827'] },
  'pipa-cruz':     { estilo: 'cruz',    c: ['#f8fafc', '#1d4ed8'], rab: ['#1d4ed8', '#f8fafc'] },
  'pipa-diagonal': { estilo: 'diagonal', c: ['#db2777', '#fde047'], rab: ['#db2777', '#fde047'] },
  'pipa-roxa':     { estilo: 'listras', c: ['#6d28d9', '#f0abfc'], rab: ['#6d28d9', '#f0abfc'] },
  'pipa-bolinha':  { estilo: 'bolinhas', c: ['#7c2d12', '#fef3c7'], rab: ['#7c2d12', '#fef3c7'] },
  'pipa-verdeamarela': { estilo: 'losango', c: ['#16a34a', '#facc15'], rab: ['#16a34a', '#facc15'] },
  'pipa-coracao':  { estilo: 'coracao', c: ['#fce7f3', '#e11d48'], rab: ['#e11d48', '#fce7f3'] },
  'pipa-olho':     { estilo: 'olho',    c: ['#0ea5e9', '#f8fafc'], rab: ['#0ea5e9', '#0f172a'] },
  'pipa-noturna':  { estilo: 'estrela', c: ['#0f172a', '#e2e8f0'], rab: ['#0f172a', '#e2e8f0'] },
  'pipa-neon':     { estilo: 'raio',    c: ['#111827', '#22d3ee'], rab: ['#22d3ee', '#111827'] },
  'pipa-sangue':   { estilo: 'caveira', c: ['#7f1d1d', '#fee2e2'], rab: ['#7f1d1d', '#fee2e2'] },
  'pipa-ouro':     { estilo: 'diagonal', c: ['#1c1917', '#eab308'], rab: ['#eab308', '#1c1917'] },
};
export const PIPA_PADRAO = 'pipa-classica';
export const modelo = id => MODELOS[id] || MODELOS[PIPA_PADRAO];
// pipas do computador: sorteadas entre os modelos (diferentes da sua)
export function modelosBots(meu, n) {
  const ids = Object.keys(MODELOS).filter(id => id !== meu);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, n);
}

// Desenha a pipa em pé (bico pra cima), ocupando o quadrado de lado s, a partir de (x, y).
// Formato losango, com as varetas. Serve pra textura do 3D, pra tela 2D e pro ícone da loja.
export function drawPipa(g, id, s, x = 0, y = 0) {
  const M = modelo(id), [c1, c2] = M.c;
  const nose = [x + s / 2, y + s * .02], left = [x + s * .06, y + s * .4], right = [x + s * .94, y + s * .4], tail = [x + s / 2, y + s * .98];
  const path = () => { g.beginPath(); g.moveTo(...nose); g.lineTo(...right); g.lineTo(...tail); g.lineTo(...left); g.closePath(); };
  g.save();
  path(); g.clip();
  g.fillStyle = c1; g.fillRect(x, y, s, s);
  g.fillStyle = c2;
  switch (M.estilo) {
    case 'meia': g.fillRect(x + s / 2, y, s / 2, s); break;
    case 'listras': for (let k = 0; k < 7; k++) if (k % 2) g.fillRect(x, y + k * s / 7, s, s / 7); break;
    case 'xadrez': { const q = s / 6; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) g.fillRect(x + i * q, y + j * q, q, q); break; }
    case 'alvo': [.34, .24, .14, .06].forEach((r, k) => { g.fillStyle = k % 2 ? c1 : c2; g.beginPath(); g.arc(x + s / 2, y + s * .42, s * r, 0, 7); g.fill(); }); break;
    case 'estrela': star(g, x + s / 2, y + s * .42, s * .3, s * .12); break;
    case 'raio': g.beginPath(); [[.58, .05], [.3, .48], [.5, .48], [.38, .95], [.74, .38], [.52, .38], [.66, .05]].forEach(([a, b], k) => (k ? g.lineTo(x + a * s, y + b * s) : g.moveTo(x + a * s, y + b * s))); g.closePath(); g.fill(); break;
    case 'fogo': {
      const gr = g.createLinearGradient(0, y + s, 0, y); gr.addColorStop(0, '#fde047'); gr.addColorStop(.45, c2); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y + s);
      for (let k = 0; k <= 8; k++) g.lineTo(x + k * s / 8, y + s * (k % 2 ? .25 : .45) + Math.sin(k * 1.7) * s * .05);
      g.lineTo(x + s, y + s); g.closePath(); g.fill(); break;
    }
    case 'arco': ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((cor, k) => { g.fillStyle = cor; g.fillRect(x, y + k * s / 6, s, s / 6 + 1); }); break;
    case 'caveira': {
      const cx = x + s / 2, cy = y + s * .42;
      g.beginPath(); g.arc(cx, cy, s * .2, 0, 7); g.fill(); g.fillRect(cx - s * .11, cy + s * .1, s * .22, s * .14);
      g.fillStyle = c1; g.beginPath(); g.arc(cx - s * .075, cy, s * .055, 0, 7); g.arc(cx + s * .075, cy, s * .055, 0, 7); g.fill();
      g.beginPath(); g.moveTo(cx, cy + s * .05); g.lineTo(cx - s * .03, cy + s * .1); g.lineTo(cx + s * .03, cy + s * .1); g.fill();
      for (let k = -1; k <= 1; k++) g.fillRect(cx + k * s * .055 - 1, cy + s * .15, 2, s * .09);
      break;
    }
    case 'cruz': g.fillRect(x + s * .42, y, s * .16, s); g.fillRect(x, y + s * .32, s, s * .16); break;
    case 'diagonal': g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s); g.lineTo(x, y + s); g.closePath(); g.fill(); break;
    case 'bolinhas': for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(x + (i + .5 + (j % 2) * .5) * s / 6, y + (j + .5) * s / 6, s * .045, 0, 7); g.fill(); } break;
    case 'losango': g.beginPath(); g.moveTo(x + s / 2, y + s * .14); g.lineTo(x + s * .78, y + s * .42); g.lineTo(x + s / 2, y + s * .78); g.lineTo(x + s * .22, y + s * .42); g.closePath(); g.fill();
      g.fillStyle = '#1d4ed8'; g.beginPath(); g.arc(x + s / 2, y + s * .44, s * .13, 0, 7); g.fill(); break;
    case 'coracao': { const cx = x + s / 2, cy = y + s * .38, r = s * .11;
      g.beginPath(); g.arc(cx - r, cy, r, Math.PI, 0); g.arc(cx + r, cy, r, Math.PI, 0); g.lineTo(cx, cy + s * .26); g.closePath(); g.fill(); break; }
    case 'olho': { const cx = x + s / 2, cy = y + s * .42;
      g.beginPath(); g.ellipse(cx, cy, s * .3, s * .15, 0, 0, 7); g.fill();
      g.fillStyle = '#0f172a'; g.beginPath(); g.arc(cx, cy, s * .1, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * .03, cy - s * .03, s * .03, 0, 7); g.fill(); break; }
    case 'coroa': {
      const gr = g.createLinearGradient(x, y, x + s, y + s); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(.5, c2); gr.addColorStop(1, '#a8740f');
      g.fillStyle = gr; const b = y + s * .52, t = y + s * .26;
      g.beginPath(); g.moveTo(x + s * .26, b); g.lineTo(x + s * .26, t + s * .06); g.lineTo(x + s * .38, t + s * .16); g.lineTo(x + s * .5, t); g.lineTo(x + s * .62, t + s * .16); g.lineTo(x + s * .74, t + s * .06); g.lineTo(x + s * .74, b); g.closePath(); g.fill();
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x + s * .5, y + s * .44, s * .035, 0, 7); g.fill();
      break;
    }
  }
  // brilho do papel de seda
  const sh = g.createLinearGradient(x, y, x + s, y + s); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
  g.fillStyle = sh; g.fillRect(x, y, s, s);
  g.restore();
  // varetas e contorno
  g.save(); g.lineCap = 'round';
  g.strokeStyle = 'rgba(70,45,20,.85)'; g.lineWidth = Math.max(1, s * .022);
  g.beginPath(); g.moveTo(...nose); g.lineTo(...tail); g.moveTo(...left); g.quadraticCurveTo(x + s / 2, y + s * .3, ...right); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = Math.max(1, s * .014); path(); g.stroke();
  g.restore();
}
function star(g, cx, cy, R, r) {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, d = k % 2 ? r : R; k ? g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d) : g.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  g.closePath(); g.fill();
}
