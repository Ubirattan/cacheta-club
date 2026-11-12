// BOLINHA DE GUDE — modo Triângulo. Física e computador, sem DOM (dá pra testar e, no futuro, rodar no servidor).
//
// Regras: cada jogador tem a sua bolinha (o "tecador"). Na sua vez você teca da onde sua bolinha parou.
// Bolinha que sai do triângulo é de quem tecou. Tirou alguma: joga de novo. Não tirou: passa a vez.
// Se o seu tecador parar dentro do triângulo, ele volta pra linha e você perde a vez.
// Acabaram as bolinhas do triângulo: ganha quem tirou mais.

export const W = 920, H = 450;                         // mundo (horizontal)
export const LINE = 130;                               // linha de tiro (vertical, à esquerda)
export const TRI = [[400, 225], [650, 82], [650, 368]]; // triângulo riscado no chão
export const CX = (TRI[0][0] + TRI[1][0] + TRI[2][0]) / 3, CY = 225;
export const MAXP = 150, VK = .12, FRICTION = .972;    // força máxima do arrasto, velocidade = força * VK
const R_BALL = 11, R_SH = 14.5;

export const KINDS = [
  ['#2563eb', '#93c5fd', '#0b2a6b'], ['#dc2626', '#fca5a5', '#5c0a0a'], ['#16a34a', '#86efac', '#0a3d1c'],
  ['#f59e0b', '#fde68a', '#6b3d02'], ['#9333ea', '#d8b4fe', '#3b0b63'], ['#0891b2', '#a5f3fc', '#073b4a'],
  ['#db2777', '#fbcfe8', '#5e0b30'], ['#ea580c', '#fed7aa', '#5a1f04'], ['#65a30d', '#d9f99d', '#233b05'],
  ['#0d9488', '#99f6e4', '#063b36'],
];
export const HOME = [[LINE, 165], [LINE, 285]];        // onde cada tecador começa

export function inTri(x, y) {
  const s = (a, b) => (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  const d1 = s(TRI[0], TRI[1]), d2 = s(TRI[1], TRI[2]), d3 = s(TRI[2], TRI[0]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const mk = (x, y, r, k, type) => ({ x, y, vx: 0, vy: 0, r, k, type, rot: Math.random() * 6, out: false });

export function newGame(names = ['Você', 'Computador'], first = 0) {
  const balls = [];
  // 10 bolinhas em triângulo, apontando pra linha
  let i = 0;
  for (let col = 0; col < 4; col++) for (let row = 0; row <= col; row++) {
    const x = 465 + col * 38, y = CY + (row - col / 2) * 38;   // espaçadas: a primeira tecada não espalha tudo
    balls.push(mk(x + (Math.random() - .5) * 3, y + (Math.random() - .5) * 3, R_BALL, KINDS[i++], 'olho'));
  }
  return {
    balls,
    players: [
      { name: names[0], score: 0, sh: mk(HOME[0][0], HOME[0][1], R_SH, ['#f8fafc', '#cbd5e1', '#64748b'], 'leiteira') },
      { name: names[1], score: 0, sh: mk(HOME[1][0], HOME[1][1], R_SH, ['#1f2937', '#f59e0b', '#030712'], 'olhopreto') },
    ],
    turn: first, moving: false, over: null, shots: 0, events: [],
  };
}

export const left = S => S.balls.filter(b => !b.out).length;
const bodies = S => [S.players[0].sh, S.players[1].sh, ...S.balls.filter(b => !b.out)];

// teca a bolinha de quem está na vez: ang em radianos, power de 0 a MAXP
export function shoot(S, ang, power) {
  if (S.moving || S.over) return false;
  const p = Math.max(0, Math.min(MAXP, power)), sh = S.players[S.turn].sh;
  sh.vx = Math.cos(ang) * p * VK; sh.vy = Math.sin(ang) * p * VK;
  S.moving = true; S.shots++;
  S.events.push({ type: 'shoot', pi: S.turn });
  return true;
}

// um quadro de física (60 por segundo). Quando tudo para, resolve a jogada.
export function step(S) {
  const A = bodies(S); let any = false;
  for (const b of A) {
    const sp = Math.hypot(b.vx, b.vy);
    b.x += b.vx; b.y += b.vy; b.rot += sp / b.r;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (sp < .05) { b.vx = 0; b.vy = 0; } else any = true;
    if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * .5; }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * .5; }
    if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * .5; }
    if (b.y > H - b.r) { b.y = H - b.r; b.vy = -b.vy * .5; }
  }
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d >= m || d === 0) continue;
    const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const ma = a.r * a.r, mb = b.r * b.r, rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rv <= 0) continue;
    const imp = 2 * rv / (ma + mb) * .93;
    a.vx -= imp * mb * nx; a.vy -= imp * mb * ny; b.vx += imp * ma * nx; b.vy += imp * ma * ny;
    if (rv > .6) S.events.push({ type: 'hit', x: a.x + nx * a.r, y: a.y + ny * a.r, force: rv });
  }
  if (S.moving && !any) { S.moving = false; settle(S); }
}

function settle(S) {
  const pi = S.turn, me = S.players[pi], got = [];
  for (const b of S.balls) if (!b.out && !inTri(b.x, b.y)) { b.out = true; me.score++; got.push(b); }
  let stuck = false;
  if (inTri(me.sh.x, me.sh.y)) { stuck = true; me.sh.x = HOME[pi][0]; me.sh.y = HOME[pi][1]; }
  if (!left(S)) {
    const [a, b] = S.players.map(p => p.score);
    S.over = { winner: a > b ? 0 : b > a ? 1 : -1 };
  } else if (!got.length || stuck) S.turn = 1 - pi;
  S.events.push({ type: 'settle', pi, got, stuck, again: S.turn === pi && !S.over, over: S.over });
}

// computador: escolhe uma bolinha perto da borda e mira pra empurrar ela pra fora (bola fantasma)
export function botShot(S, level = 'medio') {
  const sh = S.players[S.turn].sh, live = S.balls.filter(b => !b.out);
  let best = null, bs = -1e9;
  for (const b of live) {
    let dx = b.x - CX, dy = b.y - CY; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const gx = b.x - dx * (b.r + sh.r), gy = b.y - dy * (b.r + sh.r);
    const ad = Math.hypot(gx - sh.x, gy - sh.y) || 1, cut = ((gx - sh.x) * dx + (gy - sh.y) * dy) / ad;
    const s = dl * .6 - ad * .2 + cut * 70 + Math.random() * 25;
    if (s > bs) { bs = s; best = { gx, gy, ad }; }
  }
  if (!best) return { ang: 0, power: MAXP / 2 };
  const err = level === 'facil' ? .2 : .1;
  const ang = Math.atan2(best.gy - sh.y, best.gx - sh.x) + (Math.random() - .5) * err;
  const v = Math.max(3, Math.min(MAXP * VK, 3 + best.ad * (1 - FRICTION) + Math.random() * 2));
  return { ang, power: v / VK };
}
