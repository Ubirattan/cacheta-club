// PIPA — batalha de cortar (motor: física, linhas, corte e computador), sem DOM.
//
// Como empina:
//  • Segurando = PUXA: a pipa dá um tiro pra onde o bico está apontando e recolhe um pouco de linha.
//  • Soltando = DÁ LINHA: a pipa fica girando, o vento leva e ela vai descendo devagar.
// Batalha: quando as linhas se cruzam, as duas vão se gastando. Quem está puxando corta muito
// mais rápido. Linha zerou = pipa cortada. Pipa que encosta nos telhados cai.
// Melhor de 3 rodadas.

export const W = 960, H = 540;
export const GROUND = 452;                      // altura das lajes (abaixo disso a pipa caiu)
export const HANDS = [[150, 418], [810, 418]];  // mão de cada jogador (em cima da laje)
export const LMIN = 170, LMAX = 760;
export const PULL_V = 5.4, SPIN = .078;
export const LINE_HP = 100, ROUNDS_TO_WIN = 2, ROUND_FRAMES = 60 * 60;   // rodada de até 1 minuto
export const NIVEIS = [['facil', 'Fácil'], ['medio', 'Esperto'], ['dificil', 'Difícil']];

const len = (x, y) => Math.sqrt(x * x + y * y);

function kite(i) {
  const [hx] = HANDS[i];
  return { x: hx + (i ? -110 : 110), y: 250, a: -Math.PI / 2, vx: 0, vy: 0, L: 320, pull: false, hp: LINE_HP, cut: false, fell: false, spin: i ? -1 : 1 };
}

export function newPipa({ level = 'medio', names = ['Você', 'Computador'] } = {}) {
  const G = { level, names, t: 0, wind: 1, round: 1, score: [0, 0], phase: 'ready', phaseT: 0, over: null, cross: null, events: [], ai: { next: 0, pull: false } };
  resetRound(G);
  return G;
}
function resetRound(G) {
  G.k = [kite(0), kite(1)];
  G.phase = 'ready'; G.phaseT = 90; G.cross = null; G.lastLoser = null; G.roundT = 0;
}

// curva da linha: da mão até a pipa, com barriga (menos barriga quando está puxando)
export function linePts(G, i, n = 14) {
  const k = G.k[i], [hx, hy] = HANDS[i];
  if (k.cut) return [];
  const d = len(k.x - hx, k.y - hy), slack = Math.max(0, k.L - d);
  const sag = (k.pull ? 8 : 26) + Math.min(90, slack * .5) + d * .05;
  const cx = (hx + k.x) / 2, cy = (hy + k.y) / 2 + sag;
  const out = [];
  for (let j = 0; j <= n; j++) {
    const t = j / n, u = 1 - t;
    out.push([u * u * hx + 2 * u * t * cx + t * t * k.x, u * u * hy + 2 * u * t * cy + t * t * k.y]);
  }
  return out;
}
function segX(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const qp = [c[0] - a[0], c[1] - a[1]], t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}
// onde as duas linhas se cruzam (ou null)
export function crossing(G) {
  const A = linePts(G, 0), B = linePts(G, 1);
  for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) {
    const p = segX(A[i - 1], A[i], B[j - 1], B[j]);
    if (p && p[1] < GROUND - 4) return p;
  }
  return null;
}

function moveKite(G, i) {
  const k = G.k[i], [hx, hy] = HANDS[i];
  if (k.cut) {                                   // cortada: cai rodopiando com o vento
    k.a += .22 * k.spin; k.vx += (G.wind * 1.6 - k.vx) * .03; k.vy = Math.min(3.2, k.vy + .05);
    k.x += k.vx; k.y += k.vy;
    return;
  }
  if (k.pull) {
    k.vx += (Math.cos(k.a) * PULL_V - k.vx) * .16; k.vy += (Math.sin(k.a) * PULL_V - k.vy) * .16;
    k.a += Math.sin(G.t * .35 + i) * .012;       // treme um pouquinho
  } else {
    k.a += SPIN * k.spin;
    k.vx += (G.wind - k.vx) * .06; k.vy += (.4 - k.vy) * .09;
  }
  k.x += k.vx; k.y += k.vy;
  let dx = k.x - hx, dy = k.y - hy, d = len(dx, dy);
  if (d < LMIN) {                                            // muito perto da mão: a linha empurra pra longe
    const nx = dx / (d || 1), ny = dy / (d || 1); k.x = hx + nx * LMIN; k.y = hy + ny * LMIN; d = LMIN;
    const inn = k.vx * nx + k.vy * ny; if (inn < 0) { k.vx -= inn * nx; k.vy -= inn * ny; }
  }
  if (d > LMAX) {                                            // acabou a linha do carretel: segura a pipa
    const nx = dx / d, ny = dy / d;
    k.x = hx + nx * LMAX; k.y = hy + ny * LMAX; d = LMAX;
    const out = k.vx * nx + k.vy * ny; if (out > 0) { k.vx -= out * nx; k.vy -= out * ny; }
  }
  // puxando, a linha fica esticada; dando linha, ela vai fazendo barriga
  k.L = k.pull ? d : Math.min(LMAX, Math.max(k.L, d) + .35);
  if (k.x < 12) { k.x = 12; k.vx = Math.abs(k.vx) * .5; }
  if (k.x > W - 12) { k.x = W - 12; k.vx = -Math.abs(k.vx) * .5; }
  if (k.y < 14) { k.y = 14; k.vy = Math.abs(k.vy) * .5; }
}

function endRound(G, winner, why) {
  G.score[winner]++;
  G.phase = 'cut'; G.phaseT = 170; G.lastLoser = 1 - winner;
  G.events.push({ type: why, winner, loser: 1 - winner, x: G.k[1 - winner].x, y: G.k[1 - winner].y });
  if (G.score[winner] >= ROUNDS_TO_WIN) G.over = { winner };
}

// um quadro (60 por segundo). input: { pull: segurando o dedo? } — só manda no jogador 0.
// O jogador 1 é sempre o computador; nos testes, input.ai0 faz o computador jogar pelos dois.
export function stepPipa(G, input = {}) {
  G.t++;
  // vento muda de lado devagar (justo pros dois lados)
  G.wind = Math.sin(G.t / 260 + G.round * 2) * .9 + Math.sin(G.t / 61) * .2;
  if (G.phase === 'ready') {                     // pipas subindo no começo da rodada
    for (const k of G.k) { k.pull = false; k.a = -Math.PI / 2; k.vx = 0; k.vy = 0; }
    if (--G.phaseT <= 0) { G.phase = 'play'; G.events.push({ type: 'go' }); }
    return;
  }
  if (G.phase === 'cut') {
    for (let i = 0; i < 2; i++) { const k = G.k[i]; if (!k.cut) k.pull = false; moveKite(G, i); }
    if (--G.phaseT <= 0 && !G.over) { G.round++; resetRound(G); }
    return;
  }
  G.k[0].pull = input.ai0 ? aiPull(G, 0, input.ai0) : !!input.pull;
  G.k[1].pull = aiPull(G, 1, G.level);
  for (let i = 0; i < 2; i++) moveKite(G, i);
  // linhas cruzadas: as duas se gastam; quem puxa corta bem mais
  const p = crossing(G);
  if (p && !G.cross) G.events.push({ type: 'cruzou', x: p[0], y: p[1] });
  G.cross = p;
  if (p) {
    const [a, b] = G.k;
    a.hp -= b.pull ? (a.pull ? .5 : .8) : .15;
    b.hp -= a.pull ? (b.pull ? .5 : .8) : .15;
    if (a.hp <= 0 || b.hp <= 0) {
      const loser = a.hp <= b.hp ? 0 : 1;
      G.k[loser].cut = true; G.k[loser].hp = 0; G.k[loser].vy = -1;
      endRound(G, 1 - loser, 'corte');
      return;
    }
  }
  for (let i = 0; i < 2; i++) if (G.k[i].y > GROUND - 8) { G.k[i].cut = true; G.k[i].fell = true; endRound(G, 1 - i, 'caiu'); return; }
  // acabou o tempo da rodada: ganha quem tem mais linha; se empatar, quem está com a pipa mais alta
  if (++G.roundT >= ROUND_FRAMES) {
    const [a, b] = G.k;
    const w = Math.abs(a.hp - b.hp) >= 1 ? (a.hp > b.hp ? 0 : 1) : (a.y <= b.y ? 0 : 1);
    G.k[1 - w].cut = true; endRound(G, w, 'tempo');
  }
}

/* ---------------- computador ---------------- */
const AI = {
  facil:   { every: 9,  tol: .45, aggro: .5,  side: 100 },
  medio:   { every: 6,  tol: .38, aggro: .75, side: 110 },
  dificil: { every: 3,  tol: .26, aggro: .97, side: 125 },
};
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function aiPull(G, i, level) {
  const cfg = AI[level] || AI.medio, me = G.k[i], op = G.k[1 - i];
  const st = G.ai[i] || (G.ai[i] = { next: 0, burst: 0 });
  if (G.cross) {                                                     // cruzou: puxa pra cortar
    if (G.t >= st.next) { st.next = G.t + cfg.every; st.cx = Math.random() < cfg.aggro; }
    if (me.y > GROUND - 230 && Math.sin(me.a) > .3) return false;       // mas não mergulha no telhado
    return st.cx;
  }
  if (st.burst > 0) {                                                // no meio de uma puxada
    if (me.y > GROUND - 230 && Math.sin(me.a) > .3) st.burst = 0;      // descendo perto do telhado: para
    else { st.burst--; return true; }
  }
  if (G.t < st.next) return false;
  st.next = G.t + cfg.every;
  let tx, ty;
  const low = me.y > GROUND - 150 || (me.y > GROUND - 220 && me.vy > 2.5);
  if (low) { tx = me.x + (i ? -40 : 40); ty = 60; }                 // perto do telhado: sobe!
  else {
    // passa pro outro lado da linha do adversário, perto da pipa dele, pra cruzar as linhas
    const L = linePts(G, 1 - i), P = L[Math.round(L.length * .62)] || [op.x, op.y], [hx, hy] = HANDS[1 - i];
    let dx = op.x - hx, dy = op.y - hy; const dl = len(dx, dy) || 1; dx /= dl; dy /= dl;
    const nx = -dy, ny = dx, side = Math.sign((me.x - P[0]) * nx + (me.y - P[1]) * ny) || 1;
    tx = P[0] - side * nx * cfg.side; ty = P[1] - side * ny * cfg.side;
    tx = Math.max(60, Math.min(W - 60, tx)); ty = Math.max(50, Math.min(GROUND - 215, ty));
  }
  const want = Math.atan2(ty - me.y, tx - me.x), diff = Math.abs(angDiff(me.a, want)), dist = len(tx - me.x, ty - me.y);
  const tol = low ? Math.max(cfg.tol, .6) : cfg.tol;               // pra subir, qualquer bico pra cima serve
  if (me.y > GROUND - 230 && Math.sin(me.a) > .3) return false;       // nunca mergulha perto do telhado
  if (diff < tol) { st.burst = Math.max(6, Math.min(50, Math.round(dist / PULL_V))); return true; }
  return false;
}
