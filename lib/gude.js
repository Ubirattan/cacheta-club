// BOLINHA DE GUDE — motor (física, regras e computador), sem DOM.
// Roda igual no navegador e no servidor: o servidor confere toda tecada.
//
// A física só usa + − × ÷ e raiz quadrada, que dão o mesmo resultado em qualquer
// celular. Por isso o servidor manda só a velocidade da tecada (vx, vy) e cada
// aparelho refaz a jogada sozinho, quadro a quadro, chegando no mesmo lugar.
//
// Modos:
//  • Triângulo: 10 bolinhas no triângulo. Bolinha que sai é de quem tecou e ele joga de novo.
//    Tecador parado dentro do triângulo volta pra linha e perde a vez. Ganha quem tirar mais.
//  • Buraco (id interno 'bulica'): 3 buraquinhos. Acerte na ordem 1-2-3-2-1 (acertou, joga de novo).
//    Bolinha do outro parada no buraco atrapalha: dá pra tirar ela de lá com uma tecada.
//    Fez o caminho, vira MATADOR: aí é só acertar a bolinha do adversário pra ganhar.
//  • Mata-mata: só os dois tecadores. Acertou a bolinha do outro, ganha 1 ponto. Faz 3 e ganha.

export const W = 920, H = 450;                         // mundo (horizontal)
export const LINE = 130;                               // linha de tiro (vertical, à esquerda)
export const TRI = [[400, 225], [650, 82], [650, 368]]; // triângulo riscado no chão
export const CX = (TRI[0][0] + TRI[1][0] + TRI[2][0]) / 3, CY = 225;
export const MAXP = 150, VK = .12, FRICTION = .972;    // força máxima do arrasto, velocidade = força * VK
export const MAXV = MAXP * VK;
export const HOLES = [[330, 225], [540, 225], [750, 225]]; // búlicas
export const HOLE_R = 15, CAPTURE_V = 3.2;
export const BUL_SEQ = [0, 1, 2, 1, 0];                // ida e volta
export const MATA_PTS = 3;                             // mata-mata: quem fizer 3 ganha
export const MAX_SHOTS = 160;                          // trava de segurança: partida não fica infinita
const R_BALL = 11, R_SH = 14.5;

export const MODOS = {
  triangulo: { name: 'Triângulo', icon: '🔺', desc: 'Tire as bolinhas do triângulo' },
  bulica:    { name: 'Buraco',    icon: '🕳️', desc: 'Buraquinhos 1-2-3-2-1 e depois mate' },
  matamata:  { name: 'Mata-mata', icon: '🎯', desc: 'Acerte a bolinha do outro: 3 pontos' },
};
export const NIVEIS = [['facil', 'Fácil'], ['medio', 'Esperto'], ['dificil', 'Difícil']];

export const KINDS = [
  ['#2563eb', '#93c5fd', '#0b2a6b'], ['#dc2626', '#fca5a5', '#5c0a0a'], ['#16a34a', '#86efac', '#0a3d1c'],
  ['#f59e0b', '#fde68a', '#6b3d02'], ['#9333ea', '#d8b4fe', '#3b0b63'], ['#0891b2', '#a5f3fc', '#073b4a'],
  ['#db2777', '#fbcfe8', '#5e0b30'], ['#ea580c', '#fed7aa', '#5a1f04'], ['#65a30d', '#d9f99d', '#233b05'],
  ['#0d9488', '#99f6e4', '#063b36'],
];
const SH = [[['#f8fafc', '#cbd5e1', '#64748b'], 'leiteira'], [['#1f2937', '#f59e0b', '#030712'], 'olhopreto']];
export function homes(mode) {
  return mode === 'matamata' ? [[170, CY], [W - 170, CY]] : [[LINE, 165], [LINE, 285]];
}
export const HOME = homes('triangulo');               // compatibilidade

const len = (x, y) => Math.sqrt(x * x + y * y);

export function inTri(x, y) {
  const s = (a, b) => (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  const d1 = s(TRI[0], TRI[1]), d2 = s(TRI[1], TRI[2]), d3 = s(TRI[2], TRI[0]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
export function holeAt(b) {
  for (let i = 0; i < HOLES.length; i++) if (len(b.x - HOLES[i][0], b.y - HOLES[i][1]) < 1) return i;
  return -1;
}
const mk = (x, y, r, k, type) => ({ x, y, vx: 0, vy: 0, r, k, type, rot: Math.round(Math.random() * 600) / 100, out: false });

// players: [{ name, uid?, avatar? }, ...] (sempre 2)
export function newGame(opts = {}, legacyFirst) {
  if (Array.isArray(opts)) opts = { players: opts.map(name => ({ name })), first: legacyFirst || 0 };
  const mode = MODOS[opts.mode] ? opts.mode : 'triangulo';
  const players = opts.players || [{ name: 'Você' }, { name: 'Computador' }];
  const hm = homes(mode), balls = [];
  if (mode === 'triangulo') {
    let i = 0;   // 10 bolinhas em triângulo, apontando pra linha, espaçadas: a primeira tecada não espalha tudo
    for (let col = 0; col < 4; col++) for (let row = 0; row <= col; row++) {
      const x = 465 + col * 38, y = CY + (row - col / 2) * 38;
      balls.push(mk(x + Math.round((Math.random() - .5) * 30) / 10, y + Math.round((Math.random() - .5) * 30) / 10, R_BALL, KINDS[i++], 'olho'));
    }
  }
  return {
    game: 'gude', mode, balls,
    players: players.map((p, i) => ({ ...p, score: 0, step: 0, sh: mk(hm[i][0], hm[i][1], R_SH, SH[i][0], SH[i][1]) })),
    turn: opts.first || 0, moving: false, over: null, shots: 0, hitOpp: false, events: [],
  };
}

export const left = S => S.balls.filter(b => !b.out).length;
const bodies = S => [S.players[0].sh, S.players[1].sh, ...S.balls.filter(b => !b.out)];
// o que falta pra cada um, pra mostrar no placar
export function target(S, pi) {
  const p = S.players[pi];
  if (S.mode !== 'bulica') return null;
  return p.step >= BUL_SEQ.length ? 'matador' : BUL_SEQ[p.step];
}

// ângulo + força do arrasto → velocidade (é isso que vai pro servidor)
export function velOf(ang, power) {
  const p = Math.max(0, Math.min(MAXP, power)) * VK;
  return { vx: Math.round(Math.cos(ang) * p * 1e6) / 1e6, vy: Math.round(Math.sin(ang) * p * 1e6) / 1e6 };
}
// teca a bolinha de quem está na vez com a velocidade (vx, vy)
export function launch(S, vx, vy) {
  if (S.moving || S.over) return false;
  vx = Number(vx); vy = Number(vy);
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return false;
  const sp = len(vx, vy);
  // folga pequena: a velocidade já cortada uma vez não é cortada de novo (o replay fica idêntico)
  if (sp > MAXV * 1.0001) { vx = vx / sp * MAXV; vy = vy / sp * MAXV; }
  const sh = S.players[S.turn].sh;
  sh.vx = vx; sh.vy = vy; sh.skip = holeAt(sh);
  S.moving = true; S.shots++; S.hitOpp = false;
  S.events.push({ type: 'shoot', pi: S.turn });
  return { vx, vy };
}
export function shoot(S, ang, power) { const v = velOf(ang, power); return !!launch(S, v.vx, v.vy); }

// um quadro de física (60 por segundo). Quando tudo para, resolve a jogada.
export function step(S) {
  const A = bodies(S); let any = false;
  for (const b of A) {
    const sp = len(b.vx, b.vy);
    b.x += b.vx; b.y += b.vy; b.rot += sp / b.r;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (sp < .05) { b.vx = 0; b.vy = 0; } else any = true;
    if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * .5; }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * .5; }
    if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * .5; }
    if (b.y > H - b.r) { b.y = H - b.r; b.vy = -b.vy * .5; }
  }
  if (S.mode === 'bulica') for (const p of S.players) {
    const b = p.sh; if (b.vx === 0 && b.vy === 0) continue;
    for (let i = 0; i < HOLES.length; i++) {
      const dx = HOLES[i][0] - b.x, dy = HOLES[i][1] - b.y, d = len(dx, dy);
      if (b.skip === i) { if (d > HOLE_R + 2) b.skip = -1; continue; }
      if (d >= HOLE_R) continue;
      if (len(b.vx, b.vy) < CAPTURE_V) {           // caiu na búlica
        b.x = HOLES[i][0]; b.y = HOLES[i][1]; b.vx = 0; b.vy = 0;
        S.events.push({ type: 'hole', i, x: b.x, y: b.y });
      } else if (d > .5) { b.vx += dx / d * .22; b.vy += dy / d * .22; } // passou raspando: a borda puxa
      break;
    }
  }
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j], dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy), m = a.r + b.r;
    if (d >= m || d === 0) continue;
    const nx = dx / d, ny = dy / d, ov = (m - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
    const ma = a.r * a.r, mb = b.r * b.r, rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rv <= 0) continue;
    const imp = 2 * rv / (ma + mb) * .93;
    a.vx -= imp * mb * nx; a.vy -= imp * mb * ny; b.vx += imp * ma * nx; b.vy += imp * ma * ny;
    if (i === 0 && j === 1 && S.moving) S.hitOpp = true;   // os dois tecadores se encostaram
    if (rv > .6) S.events.push({ type: 'hit', x: a.x + nx * a.r, y: a.y + ny * a.r, force: rv, sh: i === 0 && j === 1 });
  }
  if (S.moving && !any) { S.moving = false; settle(S); }
}

function finishByScore(S, limit) {
  const [a, b] = S.players.map(p => S.mode === 'bulica' ? p.step : p.score);
  S.over = { winner: a > b ? 0 : b > a ? 1 : -1, limit: !!limit };
}

function settle(S) {
  const pi = S.turn, me = S.players[pi], hm = homes(S.mode);
  const ev = { type: 'settle', pi, mode: S.mode, got: [], stuck: false, hit: S.hitOpp, again: false, over: null };
  if (S.mode === 'triangulo') {
    for (const b of S.balls) if (!b.out && !inTri(b.x, b.y)) { b.out = true; me.score++; ev.got.push({ x: b.x, y: b.y }); }
    if (inTri(me.sh.x, me.sh.y)) { ev.stuck = true; me.sh.x = hm[pi][0]; me.sh.y = hm[pi][1]; }
    if (!left(S)) finishByScore(S);
    else if (ev.got.length && !ev.stuck) ev.again = true;
  } else if (S.mode === 'bulica') {
    const tg = target(S, pi);
    if (tg === 'matador') {
      if (S.hitOpp) { ev.kill = true; S.over = { winner: pi }; }
    } else {
      if (holeAt(me.sh) === tg) { me.step++; ev.hole = tg; ev.again = true; if (me.step >= BUL_SEQ.length) ev.matador = true; }
    }
    me.score = me.step;
  } else {   // mata-mata
    if (S.hitOpp) {
      me.score++; ev.kill = true;
      if (me.score >= MATA_PTS) S.over = { winner: pi };
      else S.players.forEach((p, i) => { p.sh.x = hm[i][0]; p.sh.y = hm[i][1]; p.sh.vx = 0; p.sh.vy = 0; });
    }
  }
  if (!S.over && S.shots >= MAX_SHOTS) finishByScore(S, true);
  if (!S.over) {
    if (S.mode === 'matamata' && ev.kill) S.turn = 1 - pi;        // quem levou o ponto começa
    else if (!ev.again) S.turn = 1 - pi;
  }
  ev.again = S.turn === pi && !S.over; ev.over = S.over;
  S.events.push(ev);
  S.lastSettle = { ...ev, got: ev.got.length };
}

// roda a tecada inteira de uma vez (no servidor). Devolve quantos quadros durou.
export function simulate(S, max = 8000) {
  let n = 0;
  while (S.moving && n < max) { step(S); n++; }
  if (S.moving) { for (const b of bodies(S)) { b.vx = 0; b.vy = 0; } step(S); }
  S.events.length = 0;
  return n;
}

// cópia da mesa sem o que não precisa (pra mandar e refazer a jogada)
export function snapshot(S) {
  const { events, last, lastSettle, ...rest } = S; // eslint-disable-line no-unused-vars
  return JSON.parse(JSON.stringify({ ...rest, events: [] }));
}

/* ---------------- computador ---------------- */
const ERR = { facil: .2, medio: .1, dificil: .05 };          // triângulo (mira na bola fantasma)
const ERR2 = { facil: .66, medio: .33, dificil: .18 };       // búlica e mata-mata (mira direta, mais difícil)
const rnd = () => Math.random() - .5;
// velocidade pra parar a uns `d` pixels de distância
const stopV = d => Math.max(2, Math.min(MAXV, d * (1 - FRICTION)));

export function botShot(S, level = 'medio') {
  const pi = S.turn, sh = S.players[pi].sh, opp = S.players[1 - pi].sh;
  const err = (S.mode === 'triangulo' ? ERR : ERR2)[level] ?? .1;
  const aimAt = (x, y, v) => ({ ang: Math.atan2(y - sh.y, x - sh.x) + rnd() * err, power: v * (1 + rnd() * err) / VK });
  if (S.mode === 'bulica') {
    const tg = target(S, pi);
    if (tg === 'matador') { const d = len(opp.x - sh.x, opp.y - sh.y); return aimAt(opp.x, opp.y, stopV(d + 60)); }
    const [hx, hy] = HOLES[tg], d = len(hx - sh.x, hy - sh.y);
    return aimAt(hx, hy, stopV(d + 12));
  }
  if (S.mode === 'matamata') {
    const d = len(opp.x - sh.x, opp.y - sh.y);
    return aimAt(opp.x, opp.y, stopV(d + 70));
  }
  // triângulo: escolhe uma bolinha perto da borda e mira pra empurrar ela pra fora (bola fantasma)
  const live = S.balls.filter(b => !b.out);
  let best = null, bs = -1e9;
  const noise = level === 'dificil' ? 6 : 25;
  for (const b of live) {
    let dx = b.x - CX, dy = b.y - CY; const dl = len(dx, dy) || 1; dx /= dl; dy /= dl;
    const gx = b.x - dx * (b.r + sh.r), gy = b.y - dy * (b.r + sh.r);
    const ad = len(gx - sh.x, gy - sh.y) || 1, cut = ((gx - sh.x) * dx + (gy - sh.y) * dy) / ad;
    const s = dl * .6 - ad * .2 + cut * 70 + Math.random() * noise;
    if (s > bs) { bs = s; best = { gx, gy, ad }; }
  }
  if (!best) return { ang: 0, power: MAXP / 2 };
  const ang = Math.atan2(best.gy - sh.y, best.gx - sh.x) + rnd() * err;
  const v = Math.max(3, Math.min(MAXV, 3 + best.ad * (1 - FRICTION) + Math.random() * 2));
  return { ang, power: v / VK };
}
