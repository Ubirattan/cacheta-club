// =====================================================================
// Truco ONLINE no servidor — salas 'truco-1x1' (2 jogadores) e 'truco-duplas' (4: 0 e 2 contra 1 e 3).
//  • Motor: lib/truco.js (o mesmo do contra o computador). As cartas de cada um ficam escondidas
//    (tabela hands); o estado público só mostra quantas cartas cada um tem.
//  • Entrada mínima 2 fichas; taxa da casa e prêmio: lib/taxa.js (premioPorVencedor).
//  • Tempo: a vez de cada um tem prazo; se acabar, o servidor joga por ele (jogada do computador).
//    Depois de cada rodada/mão o servidor espera um pouco e segue sozinho (tick).
// =====================================================================
import { newMatch, act as tAct, needs, botMove, teamOf } from './truco.js';
import { GameError } from './service-error.js';
import { premioPorVencedor } from './taxa.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const TRUCO_MIN_ENTRY = 2;
export const TRUCO_LUGARES = { 'truco-1x1': 2, 'truco-duplas': 4 };
export const isTruco = m => !!TRUCO_LUGARES[m];
const VAZA_MS = 1600, MAO_MS = 2800;

export function trucoPublic(M) {
  const winners = M.result && M.result.matchOver ? M.result.winners : null;
  return {
    game: 'truco', matchId: M.matchId, round: M.handNo, n: M.n, cfg: M.cfg, deadline: M.deadline, nextAt: M.nextAt || null,
    players: M.players.map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar, count: p.hand.length, left: !!p.left })),
    score: M.score, dealer: M.dealer, vira: M.vira, value: M.value, raisedBy: M.raisedBy, pending: M.pending,
    vazas: M.vazas, table: M.table, vazaWinner: M.vazaWinner, starter: M.starter, turn: M.turn, phase: M.phase,
    onze: M.onze, ferro: M.ferro, handResult: M.handRes || null, over: M.over, last: M.last, result: M.result,
    prize: premioPorVencedor(M.cfg.entry || 0, M.n, M.n === 4 ? 2 : 1), winners,
  };
}

export function trucoMatch(room, players) {
  const M = newMatch(players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar })));
  M.game = 'truco';
  M.cfg = { entry: room.entry, turn: room.turn_seconds };
  M.matchId = Date.now(); M.round = 1; M.result = null; M.endedAt = null; M.handRes = null;
  M.last = { t: 'deal', n: 0 }; M.seq = 0;
  prazo(M);
  return M;
}

function prazo(M, now = Date.now()) {
  if (M.phase === 'vaza') { M.nextAt = now + VAZA_MS; M.deadline = null; return; }
  if (M.phase === 'hand') { M.nextAt = now + MAO_MS; M.deadline = null; return; }
  M.nextAt = null;
  M.deadline = M.phase === 'over' ? null : now + M.cfg.turn * 1000 + 1500;
}
function fimDaPartida(M) {
  if (M.phase !== 'over' || (M.result && M.result.matchOver)) return;
  const t = M.over.team, winners = M.players.map((p, i) => i).filter(i => teamOf(i) === t);
  M.result = { matchOver: true, champion: winners[0], winners, team: t };
  M.endedAt = Date.now(); M.deadline = null; M.nextAt = null;
}
function aplica(M, pi, a, auto = false) {
  const r = tAct(M, pi, a);
  if (!r.ok) fail(r.err);
  const ev = r.ev;
  if (ev.type === 'hand') M.handRes = { team: ev.team, pts: ev.pts, why: ev.why };
  if (ev.type === 'deal') M.handRes = null;
  M.seq = (M.seq || 0) + 1;
  M.last = { t: ev.type, n: M.seq, pi, auto, card: ev.card || null, value: ev.value || null, raise: !!ev.raise, vaza: ev.vazaEv ? ev.vazaEv.vaza : ev.vaza, jogar: ev.jogar };
  prazo(M); fimDaPartida(M);
}

export function trucoAct(M, pi, a) {
  if (M.phase === 'over') fail('A partida já acabou');
  const tipos = { play: { type: 'play', id: Number(a.id) }, truco: { type: 'truco' }, aceitar: { type: 'aceitar' }, correr: { type: 'correr' }, aumentar: { type: 'aumentar' }, onze: { type: 'onze', jogar: !!a.jogar } };
  const mv = tipos[a.type]; if (!mv) fail('Jogada inválida');
  if (M.phase === 'onze') {   // nas duplas, qualquer um do time que está com 11 decide
    const nd = needs(M); if (a.type !== 'onze' || teamOf(pi) !== nd.team) fail('Não é hora de jogar');
  }
  aplica(M, pi, mv);
}

// passa o tempo: segue depois da rodada/mão e joga por quem deixou o tempo acabar
export function trucoTick(M, now = Date.now()) {
  if (M.phase === 'over') return false;
  if ((M.phase === 'vaza' || M.phase === 'hand') && M.nextAt && now >= M.nextAt) { aplica(M, 0, { type: 'next' }); return true; }
  if (!M.deadline || now < M.deadline + 1500) return false;
  const nd = needs(M);
  const pi = nd.kind === 'onze' ? M.players.findIndex((p, i) => teamOf(i) === nd.team) : nd.pi;
  if (pi == null || pi < 0) return false;
  M.players[pi].timeouts = (M.players[pi].timeouts || 0) + 1;
  aplica(M, pi, botMove(M, pi, 'facil'), true);
  return true;
}

// saiu no meio: o time dele perde
export function trucoForfeit(M, pi) {
  if (M.players[pi].left || (M.result && M.result.matchOver)) return false;
  M.players[pi].left = true;
  M.over = { team: 1 - teamOf(pi), forfeit: true }; M.phase = 'over';
  M.seq = (M.seq || 0) + 1; M.last = { t: 'leave', pi, n: M.seq };
  fimDaPartida(M); M.result.forfeit = true;
  return true;
}
