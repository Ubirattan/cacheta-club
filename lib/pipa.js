// PIPA — batalha de cortar (motor: física, linhas, corte e computador), sem DOM.
//
// Como empina:
//  • Você (input.ctl): tocar no lado esquerdo/direito da tela leva a pipa pra esquerda/direita;
//    arrastar o dedo pra cima/baixo sobe/desce. Botões: PUXAR (estica a linha, sobe, corta forte) e
//    DESCARREGAR (solta linha, a pipa vai pro fundo, corta forte). Pipa cortada cai devagar: quem encostar
//    a linha nela APARA, e ela fica presa pela rabiola na linha.
//    Descarregando, a pipa vai pro fundo do céu (k.dep 0 = perto, 1 = bem longe); mexendo, ela volta.
//    Mexendo ou descarregando, a sua linha corta forte. Parada, ela fica no vento e desce devagar.
//  • Computador: segurando = PUXA pra onde o bico aponta; soltando = DÁ LINHA (gira e o vento leva).
// Batalha: quando as linhas se cruzam, as duas vão se gastando. Quem está puxando corta muito
// mais rápido. Linha zerou = pipa cortada. A borda de baixo da tela é parede: a pipa não cai por ali.
// Várias pipas no céu (você + 1 a 3 do computador): todo mundo corta todo mundo e
// a rodada é de quem ficar por último no céu. Se a sua cair, a rodada acaba na hora
// (ganha quem estava com mais linha). Quem ganhar 2 rodadas primeiro leva a partida.

export const W = 960, H = 540;
export const GROUND = 452;                      // altura das lajes (abaixo disso a pipa caiu)
// de onde sai a linha de cada um (a mão do bonequinho, em cima da laje): você embaixo no meio,
// o computador um de cada lado e o 4º lá no fundo (MAO_FUNDO = quão longe ele está, 0 a 1)
export const MAOS = { voce: [480, 418], esquerda: [190, 410], direita: [770, 410], fundo: [620, 392] };
export const MAO_FUNDO = .8;
export const HANDS = [MAOS.voce, MAOS.direita];   // 1 contra 1
export const MAX_PIPAS = 4;
export function handsFor(n) {
  n = Math.max(2, Math.min(MAX_PIPAS, n | 0));
  const ordem = n === 2 ? [MAOS.voce, MAOS.direita] : [MAOS.voce, MAOS.esquerda, MAOS.direita, MAOS.fundo];
  return ordem.slice(0, n).map(h => [...h]);
}
export const LMIN = 110, LMAX = 780;
export const PULL_V = 5.4, SPIN = .078, DIR_V = 4.4;
export const LINE_HP = 100, ROUNDS_TO_WIN = 2, ROUND_FRAMES = 60 * 60;   // rodada de até 1 minuto
export const NIVEIS = [['facil', 'Fácil'], ['medio', 'Esperto'], ['dificil', 'Difícil']];

const len = (x, y) => Math.sqrt(x * x + y * y);

function kite(G, i) {
  const [hx] = G.hands[i], dir = hx < W / 2 ? 1 : -1;
  const x0 = i === 0 ? W / 2 - 110 : hx < W / 2 ? hx + 150 : hx - 150;
  return { x: x0, y: 250 - (G.n > 2 ? (i % 2) * 40 : 0), a: -Math.PI / 2, vx: 0, vy: 0, L: 320, dep: .1, depT: .1, pull: false, hp: LINE_HP, cut: false, fell: false, spin: dir, by: null };
}

// pipas = quantas no céu (2 a 4), contando a sua
export function newPipa({ level = 'medio', names, pipas = 2 } = {}) {
  const n = Math.max(2, Math.min(MAX_PIPAS, pipas | 0));
  const G = { level, n, hands: handsFor(n), names: names || ['Você', ...Array.from({ length: n - 1 }, (_, i) => 'Computador ' + (i + 1))],
    handDep: Array.from({ length: n }, (_, i) => (i === 3 ? MAO_FUNDO : 0)), t: 0, wind: 1, round: 1, score: Array(n).fill(0), cortou: Array(n).fill(0), aparou: Array(n).fill(0), phase: 'ready', phaseT: 0, over: null, cross: null, crosses: [], events: [], ai: {} };
  resetRound(G);
  return G;
}
function resetRound(G) {
  G.k = Array.from({ length: G.n }, (_, i) => kite(G, i));
  G.phase = 'ready'; G.phaseT = 90; G.hold = 0; G.espera = false; G.cross = null; G.crosses = []; G.lastLoser = null; G.roundT = 0; G.roundWinner = null;
}
export const alive = G => G.k.map((k, i) => (k.cut ? -1 : i)).filter(i => i >= 0);

// curva da linha: da mão até a pipa, com barriga (menos barriga quando está puxando)
export function linePts(G, i, n = 14) {
  const k = G.k[i], [hx, hy] = G.hands[i];
  if (k.cut) return [];
  const d = len(k.x - hx, k.y - hy), slack = Math.max(0, k.L - d);
  // a sua linha fica bem esticada; a do computador faz mais barriga
  const sag = i === 0 && !k.solta ? 3 + Math.min(14, slack * .1) + d * .012 : (k.pull ? 8 : 26) + Math.min(90, slack * .5) + d * .05;
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
// onde as linhas de a e b se cruzam (ou null)
export function crossPair(G, a, b, LA = linePts(G, a), LB = linePts(G, b)) {
  for (let i = 1; i < LA.length; i++) for (let j = 1; j < LB.length; j++) {
    const p = segX(LA[i - 1], LA[i], LB[j - 1], LB[j]);
    if (p && p[1] < GROUND - 4) return p;
  }
  return null;
}
// todos os cruzamentos do céu: [{ a, b, p }]
export function crossings(G) {
  const L = G.k.map((_, i) => linePts(G, i)), out = [];
  for (let a = 0; a < G.n; a++) for (let b = a + 1; b < G.n; b++) {
    if (!L[a].length || !L[b].length) continue;
    const p = crossPair(G, a, b, L[a], L[b]); if (p) out.push({ a, b, p });
  }
  return out;
}
// primeiro cruzamento (ou null)
export function crossing(G) { const c = crossings(G); return c.length ? c[0].p : null; }
// cruzamentos que envolvem a pipa i
export const crossOf = (G, i) => G.crosses.filter(c => c.a === i || c.b === i);

const borda = ([[ya, xa], [yb, xb]], y) => (Math.abs(yb - ya) < 1e-6 ? xa : xa + (xb - xa) * (y - ya) / (yb - ya));
function moveKite(G, i) {
  const k = G.k[i], [hx, hy] = G.hands[i];
  if (k.cut && k.presa) {                        // aparada: presa pela rabiola na linha de quem aparou, balançando
    const P = k.presa, dono = G.k[P.by];
    if (dono.cut) { k.presa = null; k.vy = .3; return; }   // a linha de quem aparou foi cortada: cai de novo
    const L = linePts(G, P.by, 22), q = L[Math.min(P.j, L.length - 1)];
    P.ax = q[0]; P.ay = q[1];
    const bal = Math.sin(G.t / 22 + P.j) * .35 + G.wind * .25;
    k.a = Math.PI / 2 + bal; k.x = q[0] + Math.sin(bal) * 34; k.y = q[1] + Math.cos(bal) * 34;
    k.dep = (G.handDep[P.by] || 0) * (1 - P.j / 22) + dono.dep * (P.j / 22);
    return;
  }
  if (k.cut) {                                   // cortada (tomou relo): cai devagar, balançando no vento, dá tempo de aparar
    k.a += .09 * k.spin + Math.sin(G.t / 14 + i) * .04;
    k.vx += (G.wind * 1.1 + Math.sin(G.t / 40 + i * 2) * .6 - k.vx) * .03; k.vy = Math.min(.75, k.vy + .02);
    k.x += k.vx; k.y += k.vy;
    return;
  }
  const ctl = i === 0 && G.ctl;
  if (ctl) {                                     // você: controle direto (lado da tela = esquerda/direita, arrastar = sobe/desce)
    const mexe = !!(ctl.x || ctl.y);
    let tx = ctl.x * DIR_V + G.wind * .5, ty = ctl.y * DIR_V + (mexe ? 0 : .3);
    if (ctl.solta) {                             // DESCARREGAR (botão): a pipa vai pro fundo (longe), a linha corre
      tx = G.wind * 1.4 + ctl.x * DIR_V * .5; ty = .12 + ctl.y * DIR_V * .5;
      k.dep = Math.min(1, k.dep + .012);
    } else if (ctl.puxa) {                       // PUXAR (botão): a linha estica, a pipa sobe e vem pra perto
      ty -= 2.6; k.dep = Math.max(0, k.dep - .012);
    }
    k.vx += (tx - k.vx) * .12; k.vy += (ty - k.vy) * .12;
    k.pull = !!ctl.puxa && !ctl.solta; k.solta = !!ctl.solta;
    // bico pra onde a pipa está indo (descendo = bico pra baixo); parada no vento, bico pra cima
    const vel = Math.hypot(k.vx, k.vy);
    const want = vel > 1.2 ? Math.atan2(k.vy, k.vx) : -Math.PI / 2 + Math.max(-.9, Math.min(.9, k.vx * .17)) + Math.sin(G.t * .07) * .12;
    k.a += angDiff(want, k.a) * (vel > 1.2 ? .2 : .1);
  } else if (k.pull) {
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
  k.L = k.solta ? Math.min(LMAX, Math.max(k.L, d) + 2.5) : k.pull ? d : Math.min(LMAX, Math.max(k.L, d) + .35);
  // embaixo da tela é parede também: a pipa encosta e fica (não perde mais por cair no telhado)
  if (k.y > GROUND - 12) { k.y = GROUND - 12; if (k.vy > 0) k.vy = -k.vy * .3; }
  const V = G.vis || { x0: 12, x1: W - 12, y0: 14 };   // paredes = bordas da tela (a tela 3D informa)
  const x0 = V.xl ? borda(V.xl, k.y) : V.x0, x1 = V.xr ? borda(V.xr, k.y) : V.x1;   // na câmera 3D a borda é inclinada
  if (k.x < x0) { k.x = x0; k.vx = Math.abs(k.vx) * .5; }
  if (k.x > x1) { k.x = x1; k.vx = -Math.abs(k.vx) * .5; }
  if (k.y < V.y0) { k.y = V.y0; k.vy = Math.abs(k.vy) * .5; }
}

// APARAR: pipa cortada caindo que encosta na sua linha fica com você
const distSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
  return len(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function aparar(G) {
  const Ls = [];
  for (let i = 0; i < G.n; i++) {
    const k = G.k[i];
    if (!k.cut || k.fell || k.presa || k.y > GROUND - 6 || k.y < 0) continue;
    for (let by = 0; by < G.n; by++) {
      if (by === i || G.k[by].cut) continue;
      const L = Ls[by] || (Ls[by] = linePts(G, by, 22));
      for (let j = 2; j < L.length - 1; j++) if (distSeg([k.x, k.y], L[j - 1], L[j]) < 14) {
        k.presa = { by, j }; k.aparada = true; G.aparou[by]++;
        G.events.push({ type: 'aparou', loser: i, by, x: k.x, y: k.y });
        break;
      }
      if (k.presa) break;
    }
  }
}

// pipa i perdeu (cortada por 'by', caiu no telhado ou acabou o tempo)
function lose(G, i, why, by = null) {
  const k = G.k[i]; k.cut = true; k.hp = Math.max(0, Math.min(k.hp, why === 'tempo' ? k.hp : 0)); k.by = by;
  if (why === 'corte') { k.vy = -1; if (by != null) G.cortou[by]++; } if (why === 'caiu') k.fell = true;
  G.events.push({ type: why, loser: i, winner: by, x: k.x, y: k.y });
}
// quem está melhor no céu: mais linha; empatou, a mais alta
const best = (G, list) => list.slice().sort((a, b) => (Math.abs(G.k[a].hp - G.k[b].hp) >= 1 ? G.k[b].hp - G.k[a].hp : G.k[a].y - G.k[b].y))[0];
// a rodada acaba quando só sobra uma pipa, ou quando a sua cai (aí ganha a que estiver melhor)
function checkRound(G, why) {
  const up = alive(G);
  if (up.length > 1 && !G.k[0].cut) return false;
  const winner = up.length ? best(G, up) : (G.k.findIndex(k => k.by != null) >= 0 ? G.k.find(k => k.by != null).by : 0);
  for (const i of up) if (i !== winner) { G.k[i].cut = true; G.k[i].vy = -1; }
  G.score[winner]++; G.roundWinner = winner;
  G.phase = 'cut'; G.phaseT = 170; G.lastLoser = up.length === 2 || G.n === 2 ? G.k.findIndex((k, i) => i !== winner) : null;
  G.events.push({ type: 'rodada', winner, why });
  if (G.score[winner] >= ROUNDS_TO_WIN) G.over = { winner };
  return true;
}

// um quadro (60 por segundo). input: { pull: segurando o dedo? } — só manda no jogador 0.
// O jogador 1 é sempre o computador; nos testes, input.ai0 faz o computador jogar pelos dois.
export function stepPipa(G, input = {}) {
  G.t++;
  // vento muda de lado devagar (justo pros dois lados)
  G.wind = Math.sin(G.t / 260 + G.round * 2) * .9 + Math.sin(G.t / 61) * .2;
  if (G.phase === 'ready') {                     // pipas subindo no começo da rodada
    for (const k of G.k) { k.pull = false; k.solta = false; k.a = -Math.PI / 2; k.vx = 0; k.vy = 0; }
    if (--G.phaseT <= 0) { G.phase = 'play'; G.events.push({ type: 'go' }); }
    return;
  }
  if (G.phase === 'cut') {
    G.ctl = !G.k[0].cut && !input.ai0 && input.ctl ? input.ctl : null;
    for (let i = 0; i < G.n; i++) { const k = G.k[i]; if (!k.cut && !(i === 0 && G.ctl)) { k.pull = false; k.solta = false; } moveKite(G, i); }
    aparar(G);
    for (const k of G.k) if (k.cut && !k.presa && k.y > GROUND - 6) k.fell = true;
    const caindo = G.k.some(k => k.cut && !k.presa && !k.fell && k.y < GROUND - 6 && k.y > -50);
    G.espera = caindo && G.hold < 600;           // ainda tem pipa no ar pra aparar
    if (G.espera) G.hold++;
    else if (--G.phaseT <= 0 && !G.over) { G.round++; resetRound(G); }
    return;
  }
  for (let i = 0; i < G.n; i++) {
    const k = G.k[i]; if (k.cut) { moveKite(G, i); continue; }
    G.ctl = i === 0 && !input.ai0 && input.ctl ? input.ctl : null;
    if (!G.ctl) k.pull = i === 0 ? (input.ai0 ? aiPull(G, 0, input.ai0) : !!input.pull) : aiPull(G, i, G.level);
    if (i > 0) {                                  // computador também vai e volta no fundo do céu
      if (G.t % 200 === (i * 53) % 200) k.depT = Math.random() * .75;
      k.dep += (k.depT - k.dep) * .008;
    }
    moveKite(G, i);
  }
  aparar(G);
  for (const k of G.k) if (k.cut && !k.presa && k.y > GROUND - 6) k.fell = true;
  // linhas cruzadas: as duas se gastam; quem puxa corta bem mais
  const before = new Set(G.crosses.map(c => c.a + ':' + c.b));
  G.crosses = crossings(G);
  for (const c of G.crosses) if (!before.has(c.a + ':' + c.b)) G.events.push({ type: 'cruzou', a: c.a, b: c.b, x: c.p[0], y: c.p[1] });
  G.cross = G.crosses.length ? G.crosses[0].p : null;
  const hit = G.k.map(() => null);
  for (const { a, b } of G.crosses) {
    const A = G.k[a], B = G.k[b];
    const fa = A.pull || A.solta, fb = B.pull || B.solta;   // puxando ou descarregando corta forte
    A.hp -= fb ? (fa ? .5 : .8) : .15;
    B.hp -= fa ? (fb ? .5 : .8) : .15;
    if (A.hp <= 0 && (hit[a] == null || fb)) hit[a] = b;
    if (B.hp <= 0 && (hit[b] == null || fa)) hit[b] = a;
  }
  // linha zerou: cortada (se as duas zeraram juntas, perde a que tinha menos)
  const zer = hit.map((by, i) => (by != null ? i : -1)).filter(i => i >= 0).sort((x, y) => G.k[x].hp - G.k[y].hp);
  for (const i of zer) {
    if (G.k[i].cut) continue;
    const by = hit[i];
    if (alive(G).length <= 1) break;
    if (G.k[by].cut && G.k[by].hp > G.k[i].hp) continue;
    lose(G, i, 'corte', by);
  }
  if (zer.length) { G.crosses = G.crosses.filter(c => !G.k[c.a].cut && !G.k[c.b].cut); G.cross = G.crosses.length ? G.crosses[0].p : null; if (checkRound(G, 'corte')) return; }
  // acabou o tempo da rodada: ganha quem tem mais linha; se empatar, quem está com a pipa mais alta
  if (++G.roundT >= ROUND_FRAMES) {
    const up = alive(G), w = best(G, up);
    for (const i of up) if (i !== w) lose(G, i, 'tempo', w);
    checkRound(G, 'tempo');
  }
}

/* ---------------- computador ---------------- */
const AI = {
  facil:   { every: 9,  tol: .45, aggro: .5,  side: 100 },
  medio:   { every: 6,  tol: .38, aggro: .75, side: 110 },
  dificil: { every: 3,  tol: .26, aggro: .97, side: 125 },
};
function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

// adversário que o computador i está caçando: o mais perto (com uma queda por caçar você)
function alvo(G, i) {
  const st = G.ai[i];
  if (st.alvo != null && !G.k[st.alvo].cut && G.t < st.troca) return st.alvo;
  const me = G.k[i]; let bestI = -1, bestD = 1e9;
  for (let j = 0; j < G.n; j++) {
    if (j === i || G.k[j].cut) continue;
    const d = len(G.k[j].x - me.x, G.k[j].y - me.y) * (j === 0 ? 1.05 : 1) * (.85 + Math.random() * .3);
    if (d < bestD) { bestD = d; bestI = j; }
  }
  st.alvo = bestI; st.troca = G.t + 240 + (Math.random() * 240 | 0);
  return bestI;
}

function aiPull(G, i, level) {
  const cfg = AI[level] || AI.medio, me = G.k[i];
  const st = G.ai[i] || (G.ai[i] = { next: 0, burst: 0 });
  const t = alvo(G, i); if (t < 0) return false;
  const op = G.k[t];
  if (crossOf(G, i).length) {                                        // cruzou: puxa pra cortar
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
    const L = linePts(G, t), P = L[Math.round(L.length * .62)] || [op.x, op.y], [hx, hy] = G.hands[t];
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
