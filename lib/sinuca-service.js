// =====================================================================
// Sinuca ONLINE (1 contra 1) no servidor — usado pelas salas (lib/service.js), igual à gude.
//  • Salas: 'sinuca-bola8', 'sinuca-lisa', 'sinuca-bolinho'. Entrada mínima de 2 fichas.
//  • Prêmio e taxa da casa: lib/taxa.js (até 10: metade da entrada do outro; acima de 10: 10% do
//    pote; acima de 100: 20%).
//  • Toda tacada é feita AQUI: o navegador manda bola escolhida, ângulo, força (e onde pôs a branca,
//    se estava com a bola na mão). O servidor calcula a velocidade, roda a física até as bolas pararem
//    e guarda o resultado. Os dois celulares recebem a mesa de antes + a velocidade e refazem a
//    jogada igualzinho (mesma física), depois encaixam na mesa final do servidor.
//  • Bola lisa: cada um arruma as suas 5 bolas no seu lado ao mesmo tempo (ação 'monta');
//    quando os dois confirmam (ou o tempo acaba), começa.
// =====================================================================
import { newSinuca, tacar, rolaTudo, escolhe, colocaBranca, arrumaBola, grupoDe, MODOS, W, H } from './sinuca.js';
import { GameError } from './service-error.js';
import { premioOnline } from './taxa.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const SINUCA_MIN_ENTRY = 2;
export const isSinuca = m => typeof m === 'string' && m.startsWith('sinuca-') && MODOS.some(([k]) => k === m.slice(7));
export const sinucaSub = m => m.slice(7);

const snap = S => ({ balls: S.balls.map(b => ({ n: b.n, x: b.x, y: b.y, in: b.in })), sel: S.sel });

export function sinucaPublic(S) {
  const { events, ...rest } = S; // eslint-disable-line no-unused-vars
  const entry = S.cfg ? S.cfg.entry : 0;
  return { ...rest, events: [], pot: entry * S.players.length, prize: premioOnline(entry, S.players.length) };
}

export function sinucaMatch(room, players) {
  const modo = sinucaSub(room.mode);
  const S = newSinuca({ modo, names: players.map(p => p.nickname) });
  S.game = 'sinuca'; S.mode = modo;
  S.players = players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar }));
  S.cfg = { entry: room.entry, turn: room.turn_seconds };
  S.matchId = Date.now(); S.round = 1; S.result = null; S.endedAt = null; S.over = null; S.shots = 0;
  S.turn = Math.random() < .5 ? 0 : 1; S.comeca = S.turn;
  if (modo === 'lisa') {   // o 2º jogador arruma as amarelas do lado dele (direita)
    S.montaOk = [false, false];
    S.deadline = Date.now() + Math.max(40, room.turn_seconds * 2) * 1000;
  } else S.deadline = Date.now() + room.turn_seconds * 1000 + 2500;
  S.events = []; S.last = { t: 'start' };
  return S;
}

function endIfOver(S) {
  if (S.phase !== 'over') return;
  const w = S.winner;
  S.over = { winner: w };
  S.result = { matchOver: true, champion: w, tie: false, winner: w };
  S.endedAt = Date.now(); S.deadline = null;
}
function comecaJogo(S) {
  S.phase = 'aim';
  S.sel = S.balls.findIndex(b => !b.in && grupoDe(b.n) === S.grupos[S.turn]);
  S.last = { t: 'comecou', n: S.shots };
  S.deadline = Date.now() + S.cfg.turn * 1000 + 1500;
}

export function sinucaAct(S, pi, a) {
  if (S.phase === 'over' || S.over) fail('A partida já acabou');
  if (a.type === 'monta') {
    if (S.phase !== 'monta') fail('O jogo já começou');
    if (S.montaOk[pi]) fail('Você já arrumou as suas bolas');
    const pos = Array.isArray(a.pos) ? a.pos : [];
    const minhas = S.balls.map((b, i) => i).filter(i => grupoDe(S.balls[i].n) === S.grupos[pi]);
    if (pos.length !== minhas.length) fail('Arrume as 5 bolas');
    const antes = minhas.map(i => [S.balls[i].x, S.balls[i].y]);
    for (let k = 0; k < minhas.length; k++) {
      const [x, y] = pos[k].map(Number);
      if (!arrumaBola(S, minhas[k], x, y, pi)) {   // lugar inválido: volta tudo como estava
        minhas.forEach((i, j) => { S.balls[i].x = antes[j][0]; S.balls[i].y = antes[j][1]; });
        fail('Bola fora do seu lado da mesa');
      }
    }
    S.montaOk[pi] = true; S.last = { t: 'monta', pi, n: S.shots };
    if (S.montaOk[0] && S.montaOk[1]) comecaJogo(S);
    return;
  }
  if (a.type !== 'shot') fail('Jogada inválida');
  if (S.phase !== 'aim') fail('Espere as bolas pararem');
  if (S.turn !== pi) fail('Não é a sua vez');
  if (S.modo === 'lisa' && a.sel != null && !escolhe(S, Number(a.sel))) fail('Essa bola não é sua');
  if (S.naMao && Array.isArray(a.place)) {
    const [x, y] = a.place.map(Number);
    if (!colocaBranca(S, x, y)) fail('Não dá pra colocar a branca aí');
  }
  const pre = snap(S);
  if (!tacar(S, Number(a.ang), Number(a.forca))) fail('Tacada inválida');
  const c = S.balls[S.sel], vx = c.vx, vy = c.vy;
  S.events = [];
  const frames = rolaTudo(S);
  S.shots++;
  S.last = { t: 'shot', pi, n: S.shots, pre, sel: pre.sel, vx, vy, frames };
  S.events = [];
  // o cronômetro só corre depois que as bolas param na tela de todo mundo
  S.deadline = Date.now() + frames * 1000 / 60 + S.cfg.turn * 1000 + 1500;
  endIfOver(S);
}

// tempo acabou: na arrumação, começa com as bolas como estão; no jogo, passa a vez
export function sinucaTick(S, now = Date.now()) {
  if (S.over || !S.deadline || now < S.deadline + 1500) return false;
  if (S.phase === 'monta') { S.montaOk = [true, true]; comecaJogo(S); return true; }
  const pi = S.turn;
  S.players[pi].timeouts = (S.players[pi].timeouts || 0) + 1;
  S.turn = 1 - pi;
  if (S.modo === 'lisa') S.sel = S.balls.findIndex(b => !b.in && grupoDe(b.n) === S.grupos[S.turn]);
  S.last = { t: 'timeout', pi, n: S.shots };
  S.deadline = now + S.cfg.turn * 1000;
  return true;
}

// saiu no meio: o outro ganha
export function sinucaForfeit(S, pi) {
  if (S.players[pi].left || (S.result && S.result.matchOver)) return false;
  S.players[pi].left = true;
  S.phase = 'over'; S.winner = 1 - pi;
  S.last = { t: 'leave', pi, n: S.shots };
  endIfOver(S); S.result.forfeit = true;
  return true;
}
void W; void H;
