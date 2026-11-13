// SINUCA (bola 8) — motor sem DOM: mesa, física das bolas, regras e computador.
//
// Regras (bola 8 simplificada, de bar):
//  • Lisas (1 a 7) x listradas (9 a 15). Quem encaçapar primeiro depois da saída fica com aquele grupo.
//  • Encaçapou bola do seu grupo (ou qualquer uma, antes de definir) e não fez falta: joga de novo.
//  • Falta: branca na caçapa, não encostar em bola nenhuma, ou bater primeiro numa bola que não é sua
//    (ou na 8 antes da hora). Falta = o outro joga com a BOLA NA MÃO (coloca a branca onde quiser).
//  • A 8 é a última: matou a 8 depois de limpar o seu grupo (sem falta) = ganhou.
//    Matou a 8 antes da hora (ou fazendo falta) = perdeu.

export const W = 1000, H = 500;            // área de jogo (dentro das tabelas)
export const R = 11;                       // raio da bola
export const POCKET_R = 25;                // boca da caçapa
export const POCKETS = [[0, 0], [W / 2, -6], [W, 0], [0, H], [W / 2, H + 6], [W, H]];
export const MAX_V = 30;                   // força máxima da tacada (pixels por quadro)
export const NIVEIS = [['facil', 'Fácil'], ['medio', 'Esperto'], ['dificil', 'Difícil']];
const FRIC = .985, STOP = .04, SUB = 4;

export const grupoDe = n => (n === 0 ? null : n === 8 ? 8 : n < 8 ? 'lisas' : 'listradas');
const len = (x, y) => Math.sqrt(x * x + y * y);

export function newSinuca({ level = 'medio', names = ['Você', 'Computador'] } = {}) {
  const balls = [{ n: 0, x: W * .25, y: H / 2, vx: 0, vy: 0, in: false }];
  // triângulo: 8 no meio, uma lisa e uma listrada nos cantos de trás
  const ordem = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 15, 7];
  const fila = [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 15, 7]];
  void ordem;
  const x0 = W * .72, dx = R * 2 * .87 + .4;
  fila.forEach((linha, i) => linha.forEach((n, j) => balls.push({ n, x: x0 + i * dx, y: H / 2 + (j - (linha.length - 1) / 2) * (R * 2 + .4), vx: 0, vy: 0, in: false })));
  return {
    level, names, balls, turn: 0, grupos: [null, null], phase: 'aim',  // aim | rolling | over
    naMao: false, saida: true, winner: null, msg: '', shot: null, t: 0, events: [],
  };
}

export const branca = S => S.balls[0];
export const naMesa = S => S.balls.filter(b => !b.in);
export const restantes = (S, g) => S.balls.filter(b => !b.in && grupoDe(b.n) === g).length;
// bolas que o jogador p pode mirar agora
export function alvos(S, p) {
  const g = S.grupos[p];
  if (!g) return S.balls.filter(b => !b.in && b.n !== 0 && b.n !== 8);
  if (restantes(S, g) === 0) return S.balls.filter(b => !b.in && b.n === 8);
  return S.balls.filter(b => !b.in && grupoDe(b.n) === g);
}

// lugar livre pra branca (bola na mão)
export function podeColocar(S, x, y) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  return S.balls.every(b => b.in || b.n === 0 || len(b.x - x, b.y - y) > R * 2 + 1);
}
export function colocaBranca(S, x, y) {
  if (!S.naMao || !podeColocar(S, x, y)) return false;
  const c = branca(S); c.x = x; c.y = y; c.in = false; c.vx = c.vy = 0; return true;
}

// tacada: ângulo (rad) e força 0..1
export function tacar(S, ang, forca) {
  if (S.phase !== 'aim') return false;
  const c = branca(S); if (c.in) return false;
  const v = Math.max(.05, Math.min(1, forca)) * MAX_V;
  c.vx = Math.cos(ang) * v; c.vy = Math.sin(ang) * v;
  S.phase = 'rolling'; S.naMao = false;
  S.shot = { primeira: null, caiu: [], tabela: 0, forca };
  S.events.push({ type: 'taco', forca });
  return true;
}

function noBuraco(b) {
  for (const [px, py] of POCKETS) if (len(b.x - px, b.y - py) < POCKET_R) return true;
  return false;
}
const pertoDeBuraco = (x, y) => POCKETS.some(([px, py]) => len(x - px, y - py) < POCKET_R + R * 1.6);

// um quadro de física (60 por segundo)
export function stepSinuca(S) {
  S.t++;
  if (S.phase !== 'rolling') return;
  const bs = S.balls;
  for (let s = 0; s < SUB; s++) {
    for (const b of bs) { if (b.in) continue; b.x += b.vx / SUB; b.y += b.vy / SUB; }
    // tabelas (menos na boca das caçapas)
    for (const b of bs) {
      if (b.in) continue;
      if (noBuraco(b)) { cai(S, b); continue; }
      if (pertoDeBuraco(b.x, b.y)) continue;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * .78; tabela(S, b); }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * .78; tabela(S, b); }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * .78; tabela(S, b); }
      if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * .78; tabela(S, b); }
    }
    // bolas batendo
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (a.in) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (b.in) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy);
        if (d >= R * 2 || d === 0) continue;
        const nx = dx / d, ny = dy / d, over = R * 2 - d;
        a.x -= nx * over / 2; a.y -= ny * over / 2; b.x += nx * over / 2; b.y += ny * over / 2;
        const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rv <= 0) continue;
        const imp = rv * .97;
        a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
        if (S.shot && S.shot.primeira == null && (a.n === 0 || b.n === 0)) S.shot.primeira = a.n === 0 ? b.n : a.n;
        S.events.push({ type: 'bate', v: rv });
      }
    }
  }
  let parado = true;
  for (const b of bs) {
    if (b.in) continue;
    b.vx *= FRIC; b.vy *= FRIC;
    const v = len(b.vx, b.vy);
    if (v < STOP) { b.vx = b.vy = 0; } else { parado = false; if (v < .25) { b.vx *= .9; b.vy *= .9; } }
  }
  if (parado) fimDaTacada(S);
}
function tabela(S, b) { if (S.shot) S.shot.tabela++; if (len(b.vx, b.vy) > 1.5) S.events.push({ type: 'tabela' }); }
function cai(S, b) {
  b.in = true; b.vx = b.vy = 0;
  if (S.shot) S.shot.caiu.push(b.n);
  S.events.push({ type: 'caiu', n: b.n });
}

function fimDaTacada(S) {
  const p = S.turn, o = 1 - p, sh = S.shot || { primeira: null, caiu: [] };
  const meu = S.grupos[p];
  const tinhaQue8 = !!meu && restantes(S, meu) === 0 && !sh.caiu.some(n => grupoDe(n) === meu);
  // falta?
  let falta = null;
  if (sh.caiu.includes(0)) falta = 'A branca caiu';
  else if (sh.primeira == null) falta = 'Não encostou em nenhuma bola';
  else if (meu) {
    const g1 = grupoDe(sh.primeira);
    const devia8 = restantes(S, meu) + sh.caiu.filter(n => grupoDe(n) === meu).length === 0;
    if (devia8 ? g1 !== 8 : g1 !== meu) falta = devia8 ? 'Tinha que bater primeiro na 8' : 'Bateu primeiro na bola do outro';
  } else if (sh.primeira === 8 && !S.saida) falta = 'Bateu primeiro na 8';
  // a 8 caiu?
  if (sh.caiu.includes(8)) {
    const valeu = !falta && meu && (tinhaQue8 || restantes(S, meu) === 0);
    return fim(S, valeu ? p : o, valeu ? 'matou a 8' : 'a 8 caiu antes da hora');
  }
  // define os grupos (primeira bola que caiu, sem falta)
  if (!meu && !falta) {
    const n = sh.caiu.find(x => x !== 0 && x !== 8);
    if (n != null) { S.grupos[p] = grupoDe(n); S.grupos[o] = S.grupos[p] === 'lisas' ? 'listradas' : 'lisas'; S.events.push({ type: 'grupos', p, g: S.grupos[p] }); }
  }
  const g = S.grupos[p];
  const acertou = sh.caiu.some(n => n !== 0 && n !== 8 && (!g || grupoDe(n) === g));
  if (falta) {
    const c = branca(S);
    if (c.in) { c.in = false; c.x = W * .25; c.y = H / 2; if (!podeColocar(S, c.x, c.y)) acharLugar(S, c); }
    S.turn = o; S.naMao = true; S.msg = falta;
    S.events.push({ type: 'falta', p, motivo: falta });
  } else if (!acertou) {
    S.turn = o; S.msg = '';
    S.events.push({ type: 'vez', p: o });
  } else {
    S.msg = ''; S.events.push({ type: 'boa', p });
  }
  S.saida = false; S.phase = 'aim'; S.shot = null;
}
function acharLugar(S, c) {
  for (let r = 0; r < 400; r += 6) for (let a = 0; a < 6.3; a += .4) {
    const x = W * .25 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
    if (podeColocar(S, x, y)) { c.x = x; c.y = y; return; }
  }
}
function fim(S, w, why) {
  S.phase = 'over'; S.winner = w; S.shot = null;
  S.events.push({ type: 'fim', winner: w, why });
}

/* ---------------- mira (pra linha de ajuda e pro computador) ---------------- */
// primeira bola que a branca vai acertar indo no ângulo ang: { b, gx, gy } (gx,gy = onde a branca encosta)
export function primeiraBola(S, ang, ignorar = null) {
  const c = branca(S), dx = Math.cos(ang), dy = Math.sin(ang);
  let best = null, bt = 1e9;
  for (const b of S.balls) {
    if (b.in || b.n === 0 || b === ignorar) continue;
    const fx = b.x - c.x, fy = b.y - c.y, t = fx * dx + fy * dy; if (t <= 0) continue;
    const perp2 = fx * fx + fy * fy - t * t, r2 = (R * 2) ** 2; if (perp2 > r2) continue;
    const tt = t - Math.sqrt(r2 - perp2);
    if (tt < bt) { bt = tt; best = b; }
  }
  if (!best) return null;
  return { b: best, gx: c.x + dx * bt, gy: c.y + dy * bt, t: bt };
}
// até onde a branca vai antes de bater na tabela (sem bola no caminho)
export function ateTabela(S, ang) {
  const c = branca(S), dx = Math.cos(ang), dy = Math.sin(ang); let t = 1e9;
  if (dx > 0) t = Math.min(t, (W - R - c.x) / dx); if (dx < 0) t = Math.min(t, (R - c.x) / dx);
  if (dy > 0) t = Math.min(t, (H - R - c.y) / dy); if (dy < 0) t = Math.min(t, (R - c.y) / dy);
  return { x: c.x + dx * t, y: c.y + dy * t };
}
// caminho livre de (ax,ay) até (bx,by) pra uma bola, ignorando algumas
function livre(S, ax, ay, bx, by, ign) {
  const dx = bx - ax, dy = by - ay, L = len(dx, dy) || 1, ux = dx / L, uy = dy / L;
  for (const b of S.balls) {
    if (b.in || ign.includes(b)) continue;
    const fx = b.x - ax, fy = b.y - ay, t = fx * ux + fy * uy; if (t < 0 || t > L) continue;
    if (Math.abs(fx * uy - fy * ux) < R * 2 - .5) return false;
  }
  return true;
}

/* ---------------- computador ---------------- */
const AI = { facil: { erro: .055, forca: .2 }, medio: { erro: .025, forca: .1 }, dificil: { erro: .008, forca: .05 } };
// melhor jogada: { ang, forca, nota } (tenta cada bola dele em cada caçapa)
export function melhorJogada(S, p = S.turn) {
  const c = branca(S); let best = null;
  for (const b of alvos(S, p)) for (const [px, py] of POCKETS) {
    const tx = px - b.x, ty = py - b.y, td = len(tx, ty); if (td < 1) continue;
    const gx = b.x - tx / td * R * 2, gy = b.y - ty / td * R * 2;         // onde a branca tem que encostar
    const ax = gx - c.x, ay = gy - c.y, ad = len(ax, ay); if (ad < 1) continue;
    const corte = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (ad * td))));
    if (corte > 1.35) continue;                                              // corte fino demais
    if (!livre(S, c.x, c.y, gx, gy, [c, b]) || !livre(S, b.x, b.y, px, py, [b])) continue;
    const meio = py !== 0 && py !== H ? 0 : 1, nota = Math.cos(corte) * 2 - (ad + td) / 900 - (meio ? 0 : .25) * Math.sin(corte);
    if (!best || nota > best.nota) best = { ang: Math.atan2(ay, ax), forca: Math.min(1, .25 + (ad + td * 1.4) / 1500 / Math.max(.3, Math.cos(corte))), nota, b };
  }
  return best;
}
export function jogadaComputador(S) {
  const cfg = AI[S.level] || AI.medio, c = branca(S);
  let j = melhorJogada(S);
  if (!j) {   // sem jogada limpa: bate numa bola dele com força média
    const al = alvos(S, S.turn); const b = al[(Math.random() * al.length) | 0] || S.balls.find(x => !x.in && x.n);
    j = { ang: Math.atan2(b.y - c.y, b.x - c.x), forca: .45 };
  }
  if (S.saida) j = { ang: Math.atan2(H / 2 - c.y + (Math.random() - .5) * 8, W * .72 - c.x), forca: .95 };
  return { ang: j.ang + (Math.random() - .5) * 2 * cfg.erro, forca: Math.max(.15, Math.min(1, j.forca * (1 + (Math.random() - .5) * cfg.forca))) };
}
// bola na mão do computador: procura o lugar que dá a jogada mais fácil
export function computadorColoca(S) {
  const c = branca(S); let best = null;
  for (let k = 0; k < 60; k++) {
    const x = R + Math.random() * (W - 2 * R), y = R + Math.random() * (H - 2 * R);
    if (!podeColocar(S, x, y)) continue;
    const ox = c.x, oy = c.y; c.x = x; c.y = y;
    const j = melhorJogada(S); c.x = ox; c.y = oy;
    if (j && (!best || j.nota > best.nota)) best = { x, y, nota: j.nota };
  }
  if (best) colocaBranca(S, best.x, best.y);
  return !!best;
}
