// SINUCA — motor sem DOM: mesa, física das bolas, regras das 3 modalidades e computador.
//
// MODALIDADES (S.modo):
//  • 'bola8' — lisas (1 a 7) x listradas (9 a 15). Quem encaçapar primeiro depois da saída fica com
//    aquele grupo. Encaçapou bola sua: joga de novo. Falta (branca na caçapa, não encostar em nada,
//    bater primeiro na bola do outro): o outro joga com a BOLA NA MÃO. A 8 é a última: matou a 8
//    depois de limpar as suas = ganhou; antes da hora (ou com falta) = perdeu.
//  • 'lisa' — sem a bola branca: 5 vermelhas (você) x 5 amarelas (computador). Na sua vez você escolhe
//    uma bola SUA e taca ela. Encaçapou bola sua (e nenhuma do outro): joga de novo. Quem matar as
//    5 primeiro ganha (bola do outro que cai conta pra ele).
//  • 'bolinho' — 5 jogos com 3 bolas cada (as 15 bolas, de 3 em 3). Quem matar a última das 3 ganha
//    o jogo. Se cegar (não encostar em nenhuma bola) ou a branca cair, perde o jogo na hora.
//    Encaçapou uma (sem ser a última): joga de novo. Ganha a partida quem fizer 3 jogos primeiro.

export const W = 1000, H = 500;            // área de jogo (dentro das tabelas)
export const R = 11;                       // raio da bola
export const POCKET_R = 25;                // boca da caçapa
export const POCKETS = [[0, 0], [W / 2, -6], [W, 0], [0, H], [W / 2, H + 6], [W, H]];
export const MAX_V = 30;                   // força máxima da tacada (pixels por quadro)
export const NIVEIS = [['facil', 'Fácil'], ['medio', 'Esperto'], ['dificil', 'Difícil']];
export const MODOS = [['bola8', '🎱 Bola 8'], ['lisa', '🔴 Bola lisa'], ['bolinho', '🎯 Bolinho']];
export const BOLINHO_JOGOS = 5, BOLINHO_VENCE = 3;
const FRIC = .985, STOP = .04, SUB = 4;

// grupo de cada bola: bola8 → 'lisas' | 'listradas' | 8 ; lisa → 'verm' (101-105) | 'amar' (201-205)
export const grupoDe = n => (n === 0 ? null : n === 8 ? 8 : n < 8 ? 'lisas' : n < 16 ? 'listradas' : n < 200 ? 'verm' : 'amar');
const len = (x, y) => Math.sqrt(x * x + y * y);
const bolaNova = (n, x, y) => ({ n, x, y, vx: 0, vy: 0, in: false });

function triangulo(nums, x0 = W * .72) {
  const out = [], dx = R * 2 * .87 + .4; let k = 0;
  for (let i = 0; k < nums.length; i++) for (let j = 0; j <= i && k < nums.length; j++, k++)
    out.push(bolaNova(nums[k], x0 + i * dx, H / 2 + (j - i / 2) * (R * 2 + .4)));
  return out;
}

export function newSinuca({ level = 'medio', names = ['Você', 'Computador'], modo = 'bola8' } = {}) {
  const S = { modo, level, names, turn: 0, grupos: [null, null], phase: 'aim', naMao: false, saida: true,
    winner: null, shot: null, t: 0, events: [], sel: 0, jogo: 0, placar: [0, 0], comeca: 0 };
  if (modo === 'lisa') {
    S.grupos = ['verm', 'amar'];
    S.balls = [bolaNova(101, W * .25, H * .32), bolaNova(201, W * .25, H * .68),
      ...triangulo([102, 202, 103, 203, 104, 204, 105, 205])];
    S.sel = 0;
  } else if (modo === 'bolinho') rackBolinho(S);
  else S.balls = [bolaNova(0, W * .25, H / 2), ...triangulo([1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 15, 7])];
  return S;
}
function rackBolinho(S) {
  const k = S.jogo;
  S.balls = [bolaNova(0, W * .25, H / 2), ...triangulo([k * 3 + 1, k * 3 + 2, k * 3 + 3])];
  S.sel = 0; S.saida = true;
}

export const branca = S => S.balls[S.sel];   // a bola que vai ser tacada (na bola lisa, a escolhida)
export const restantes = (S, g) => S.balls.filter(b => !b.in && grupoDe(b.n) === g).length;
export function alvos(S, p) {
  if (S.modo === 'bolinho') return S.balls.filter(b => !b.in && b.n !== 0);
  if (S.modo === 'lisa') return S.balls.filter((b, i) => !b.in && grupoDe(b.n) === S.grupos[p] && i !== S.sel);
  const g = S.grupos[p];
  if (!g) return S.balls.filter(b => !b.in && b.n !== 0 && b.n !== 8);
  if (restantes(S, g) === 0) return S.balls.filter(b => !b.in && b.n === 8);
  return S.balls.filter(b => !b.in && grupoDe(b.n) === g);
}
export function podeEscolher(S, i) { const b = S.balls[i]; return S.modo === 'lisa' && b && !b.in && grupoDe(b.n) === S.grupos[S.turn]; }
export function escolhe(S, i) { if (S.phase !== 'aim' || !podeEscolher(S, i)) return false; S.sel = i; return true; }

export function podeColocar(S, x, y) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  return S.balls.every((b, i) => b.in || i === S.sel || len(b.x - x, b.y - y) > R * 2 + 1);
}
export function colocaBranca(S, x, y) {
  if (!S.naMao || !podeColocar(S, x, y)) return false;
  const c = branca(S); c.x = x; c.y = y; c.in = false; c.vx = c.vy = 0; return true;
}

export function tacar(S, ang, forca) {
  if (S.phase !== 'aim') return false;
  const c = branca(S); if (!c || c.in) return false;
  const v = Math.max(.05, Math.min(1, forca)) * MAX_V;
  c.vx = Math.cos(ang) * v; c.vy = Math.sin(ang) * v;
  S.phase = 'rolling'; S.naMao = false;
  S.shot = { primeira: null, caiu: [], forca, taco: c };
  S.events.push({ type: 'taco', forca });
  return true;
}

function noBuraco(b) { for (const [px, py] of POCKETS) if (len(b.x - px, b.y - py) < POCKET_R) return true; return false; }
const pertoDeBuraco = (x, y) => POCKETS.some(([px, py]) => len(x - px, y - py) < POCKET_R + R * 1.6);

export function stepSinuca(S) {
  S.t++;
  if (S.phase !== 'rolling') return;
  const bs = S.balls, taco = S.shot && S.shot.taco;
  for (let s = 0; s < SUB; s++) {
    for (const b of bs) { if (b.in) continue; b.x += b.vx / SUB; b.y += b.vy / SUB; }
    for (const b of bs) {
      if (b.in) continue;
      if (noBuraco(b)) { cai(S, b); continue; }
      if (pertoDeBuraco(b.x, b.y)) continue;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * .78; tabela(S, b); }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * .78; tabela(S, b); }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * .78; tabela(S, b); }
      if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * .78; tabela(S, b); }
    }
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
        if (S.shot && S.shot.primeira == null && (a === taco || b === taco)) S.shot.primeira = a === taco ? b.n : a.n;
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
function tabela(S, b) { if (len(b.vx, b.vy) > 1.5) S.events.push({ type: 'tabela' }); }
function cai(S, b) { b.in = true; b.vx = b.vy = 0; if (S.shot) S.shot.caiu.push(b.n); S.events.push({ type: 'caiu', n: b.n }); }

function fimDaTacada(S) {
  if (S.modo === 'lisa') return fimLisa(S);
  if (S.modo === 'bolinho') return fimBolinho(S);
  const p = S.turn, o = 1 - p, sh = S.shot || { primeira: null, caiu: [] };
  const meu = S.grupos[p];
  const tinhaQue8 = !!meu && restantes(S, meu) === 0 && !sh.caiu.some(n => grupoDe(n) === meu);
  let falta = null;
  if (sh.caiu.includes(0)) falta = 'A branca caiu';
  else if (sh.primeira == null) falta = 'Não encostou em nenhuma bola';
  else if (meu) {
    const g1 = grupoDe(sh.primeira);
    const devia8 = restantes(S, meu) + sh.caiu.filter(n => grupoDe(n) === meu).length === 0;
    if (devia8 ? g1 !== 8 : g1 !== meu) falta = devia8 ? 'Tinha que bater primeiro na 8' : 'Bateu primeiro na bola do outro';
  } else if (sh.primeira === 8 && !S.saida) falta = 'Bateu primeiro na 8';
  if (sh.caiu.includes(8)) {
    const valeu = !falta && meu && (tinhaQue8 || restantes(S, meu) === 0);
    return fim(S, valeu ? p : o, valeu ? 'matou a 8' : 'a 8 caiu antes da hora');
  }
  if (!meu && !falta) {
    const n = sh.caiu.find(x => x !== 0 && x !== 8);
    if (n != null) { S.grupos[p] = grupoDe(n); S.grupos[o] = S.grupos[p] === 'lisas' ? 'listradas' : 'lisas'; S.events.push({ type: 'grupos', p, g: S.grupos[p] }); }
  }
  const g = S.grupos[p];
  const acertou = sh.caiu.some(n => n !== 0 && n !== 8 && (!g || grupoDe(n) === g));
  if (falta) {
    const c = branca(S);
    if (c.in) { c.in = false; c.x = W * .25; c.y = H / 2; if (!podeColocar(S, c.x, c.y)) acharLugar(S, c); }
    S.turn = o; S.naMao = true;
    S.events.push({ type: 'falta', p, motivo: falta });
  } else if (!acertou) { S.turn = o; S.events.push({ type: 'vez', p: o }); }
  else S.events.push({ type: 'boa', p });
  S.saida = false; S.phase = 'aim'; S.shot = null;
}

function fimLisa(S) {
  const p = S.turn, o = 1 - p, sh = S.shot || { caiu: [] }, meu = S.grupos[p];
  const minhas = sh.caiu.filter(n => grupoDe(n) === meu).length, dele = sh.caiu.length - minhas;
  if (restantes(S, meu) === 0) return fim(S, p, 'matou as 5');
  if (restantes(S, S.grupos[o]) === 0) return fim(S, o, 'as 5 dele caíram');
  if (sh.primeira == null) { S.turn = o; S.events.push({ type: 'falta', p, motivo: 'Não encostou em nenhuma bola', semMao: true }); }
  else if (minhas > 0 && dele === 0) S.events.push({ type: 'boa', p });
  else { S.turn = o; S.events.push({ type: 'vez', p: o }); }
  if (!podeEscolher(S, S.sel)) S.sel = S.balls.findIndex(b => !b.in && grupoDe(b.n) === S.grupos[S.turn]);
  S.saida = false; S.phase = 'aim'; S.shot = null;
}

function fimBolinho(S) {
  const p = S.turn, o = 1 - p, sh = S.shot || { primeira: null, caiu: [] };
  const sobrou = S.balls.filter(b => !b.in && b.n !== 0).length;
  let ganhou = null, why = '';
  if (sh.caiu.includes(0)) { ganhou = o; why = 'a branca caiu'; }
  else if (sh.primeira == null) { ganhou = o; why = 'cegou'; }
  else if (sobrou === 0) { ganhou = p; why = 'matou a última'; }
  if (ganhou == null) {
    if (sh.caiu.length) S.events.push({ type: 'boa', p });
    else { S.turn = o; S.events.push({ type: 'vez', p: o }); }
    S.saida = false; S.phase = 'aim'; S.shot = null;
    return;
  }
  S.placar[ganhou]++;
  S.events.push({ type: 'jogo', winner: ganhou, loser: ganhou === p ? o : p, why, jogo: S.jogo + 1 });
  if (S.placar[ganhou] >= BOLINHO_VENCE || S.jogo + 1 >= BOLINHO_JOGOS) {
    const w = S.placar[0] === S.placar[1] ? ganhou : S.placar[0] > S.placar[1] ? 0 : 1;
    return fim(S, w, `${S.placar[w]} x ${S.placar[1 - w]} no bolinho`);
  }
  S.jogo++; S.comeca = 1 - S.comeca; S.turn = S.comeca; rackBolinho(S);
  S.phase = 'aim'; S.shot = null;
}

function acharLugar(S, c) {
  for (let r = 0; r < 400; r += 6) for (let a = 0; a < 6.3; a += .4) {
    const x = W * .25 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
    if (podeColocar(S, x, y)) { c.x = x; c.y = y; return; }
  }
}
function fim(S, w, why) { S.phase = 'over'; S.winner = w; S.shot = null; S.events.push({ type: 'fim', winner: w, why }); }

/* ---------------- mira (linha de ajuda e computador) ---------------- */
export function primeiraBola(S, ang) {
  const c = branca(S), dx = Math.cos(ang), dy = Math.sin(ang);
  let best = null, bt = 1e9;
  for (const b of S.balls) {
    if (b.in || b === c) continue;
    const fx = b.x - c.x, fy = b.y - c.y, t = fx * dx + fy * dy; if (t <= 0) continue;
    const perp2 = fx * fx + fy * fy - t * t, r2 = (R * 2) ** 2; if (perp2 > r2) continue;
    const tt = t - Math.sqrt(r2 - perp2);
    if (tt < bt) { bt = tt; best = b; }
  }
  return best ? { b: best, gx: c.x + dx * bt, gy: c.y + dy * bt, t: bt } : null;
}
export function ateTabela(S, ang) {
  const c = branca(S), dx = Math.cos(ang), dy = Math.sin(ang); let t = 1e9;
  if (dx > 0) t = Math.min(t, (W - R - c.x) / dx); if (dx < 0) t = Math.min(t, (R - c.x) / dx);
  if (dy > 0) t = Math.min(t, (H - R - c.y) / dy); if (dy < 0) t = Math.min(t, (R - c.y) / dy);
  return { x: c.x + dx * t, y: c.y + dy * t };
}
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
export function melhorJogada(S, p = S.turn) {
  const c = branca(S); let best = null;
  for (const b of alvos(S, p)) for (const [px, py] of POCKETS) {
    const tx = px - b.x, ty = py - b.y, td = len(tx, ty); if (td < 1) continue;
    const gx = b.x - tx / td * R * 2, gy = b.y - ty / td * R * 2;
    const ax = gx - c.x, ay = gy - c.y, ad = len(ax, ay); if (ad < 1) continue;
    const corte = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (ad * td))));
    if (corte > 1.35) continue;
    if (!livre(S, c.x, c.y, gx, gy, [c, b]) || !livre(S, b.x, b.y, px, py, [b])) continue;
    const nota = Math.cos(corte) * 2 - (ad + td) / 900;
    if (!best || nota > best.nota) best = { ang: Math.atan2(ay, ax), forca: Math.min(1, .25 + (ad + td * 1.4) / 1500 / Math.max(.3, Math.cos(corte))), nota, sel: S.sel };
  }
  return best;
}
export function jogadaComputador(S) {
  const cfg = AI[S.level] || AI.medio;
  let j = null;
  if (S.modo === 'lisa') {   // escolhe também qual bola dele vai tacar
    S.balls.forEach((b, i) => {
      if (b.in || grupoDe(b.n) !== S.grupos[S.turn]) return;
      const o = S.sel; S.sel = i; const t = melhorJogada(S); S.sel = o;
      if (t && (!j || t.nota > j.nota)) j = t;
    });
    S.sel = j ? j.sel : (podeEscolher(S, S.sel) ? S.sel : S.balls.findIndex(b => !b.in && grupoDe(b.n) === S.grupos[S.turn]));
  } else j = melhorJogada(S);
  const c = branca(S);
  if (!j) {
    const al = alvos(S, S.turn), b = al[(Math.random() * al.length) | 0] || S.balls.find(x => !x.in && x !== c);
    j = { ang: Math.atan2(b.y - c.y, b.x - c.x), forca: .45 };
  }
  if (S.saida && S.modo === 'bola8') j = { ang: Math.atan2(H / 2 - c.y + (Math.random() - .5) * 8, W * .72 - c.x), forca: .95 };
  return { sel: S.sel, ang: j.ang + (Math.random() - .5) * 2 * cfg.erro, forca: Math.max(.15, Math.min(1, j.forca * (1 + (Math.random() - .5) * cfg.forca))) };
}
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
