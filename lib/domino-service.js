// =====================================================================
// Dominó ONLINE no servidor: sala 'domino-duplas' (4 jogadores: 0 e 2 contra 1 e 3).
//  • Motor: lib/domino.js (o mesmo do contra o computador). As pedras de cada um ficam escondidas
//    (tabela hands); o estado público só mostra quantas pedras cada um tem. No fim da mão, todas aparecem.
//  • Entrada mínima 2 fichas; prêmio de cada um da dupla vencedora: lib/taxa.js (premioPorVencedor).
//  • Tempo: a vez de cada um tem prazo; se acabar, o servidor joga por ele. Quem não tem pedra passa sozinho.
// =====================================================================
import { novaPartida, agir, seguir, jogadaBot, jogaveis, dupla } from './domino.js';
import { GameError } from './service-error.js';
import { premioPorVencedor } from './taxa.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const DOMINO_MIN_ENTRY = 2;
export const DOMINO_LUGARES = { 'domino-duplas': 4 };
export const isDomino = m => !!DOMINO_LUGARES[m];
const PASSA_MS = 1300, MAO_MS = 4500;

export function dominoPublic(M) {
  const winners = M.result && M.result.matchOver ? M.result.winners : null;
  const aberto = M.fase !== 'jogo';
  return {
    game: 'domino', matchId: M.matchId, round: M.mao, n: 4, cfg: M.cfg, deadline: M.deadline, nextAt: M.nextAt || null,
    players: M.players.map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar, count: p.mao.length, left: !!p.left, ...(aberto ? { mao: p.mao } : {}) })),
    placar: M.placar, linha: M.linha, pontas: M.pontas, vez: M.vez, fase: M.fase, obrigaSena: !!M.obrigaSena,
    resultado: M.resultado || null, over: M.over, last: M.last, result: M.result,
    prize: premioPorVencedor(M.cfg.entry || 0, 4, 2), winners,
  };
}

export function dominoMatch(room, players) {
  const M = novaPartida(players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar })));
  M.game = 'domino';
  M.cfg = { entry: room.entry, turn: room.turn_seconds };
  M.matchId = Date.now(); M.round = 1; M.result = null; M.endedAt = null;
  M.seq = 0; M.last = { t: 'deal', n: 0 };
  prazo(M);
  return M;
}

function prazo(M, now = Date.now()) {
  if (M.fase === 'mao') { M.nextAt = now + MAO_MS; M.deadline = null; return; }
  if (M.fase === 'fim') { M.nextAt = null; M.deadline = null; return; }
  if (!jogaveis(M, M.vez).length) { M.nextAt = now + PASSA_MS; M.deadline = null; return; }   // sem pedra: passa sozinho
  M.nextAt = null; M.deadline = now + M.cfg.turn * 1000 + 1500;
}
function fimDaPartida(M) {
  if (M.fase !== 'fim' || (M.result && M.result.matchOver)) return;
  const t = M.over.dupla, winners = [0, 1, 2, 3].filter(i => dupla(i) === t);
  M.result = { matchOver: true, champion: winners[0], winners, team: t };
  M.endedAt = Date.now(); M.deadline = null; M.nextAt = null;
}
function aplica(M, pi, mv, auto = false) {
  const r = agir(M, pi, mv);
  if (!r.ok) fail(r.err);
  const ev = r.ev;
  M.seq = (M.seq || 0) + 1;
  M.last = { t: ev.type, n: M.seq, pi, auto, pedra: ev.pedra || null, lado: ev.lado || null };
  if (ev.type === 'mao') Object.assign(M.last, { tipo: ev.tipo, dupla: ev.dupla, pts: ev.pts, somas: ev.somas || null, pi: ev.pi ?? null });
  prazo(M); fimDaPartida(M);
}

export function dominoAct(M, pi, a) {
  if (M.fase === 'fim') fail('A partida já acabou');
  if (M.fase !== 'jogo') fail('Espere a próxima mão');
  if (a.type === 'jogar') return aplica(M, pi, { type: 'jogar', id: Number(a.id), lado: a.lado === 'R' ? 'R' : 'L' });
  if (a.type === 'passar') return aplica(M, pi, { type: 'passar' });
  fail('Jogada inválida');
}

// passa o tempo: próxima mão, passe automático e jogada por quem deixou o tempo acabar
export function dominoTick(M, now = Date.now()) {
  if (M.fase === 'fim') return false;
  if (M.fase === 'mao') {
    if (!M.nextAt || now < M.nextAt) return false;
    seguir(M); M.seq = (M.seq || 0) + 1; M.last = { t: 'deal', n: M.seq }; prazo(M, now); return true;
  }
  if (M.nextAt && now >= M.nextAt && !jogaveis(M, M.vez).length) { aplica(M, M.vez, { type: 'passar' }); return true; }
  if (!M.deadline || now < M.deadline + 1500) return false;
  const pi = M.vez;
  M.players[pi].timeouts = (M.players[pi].timeouts || 0) + 1;
  aplica(M, pi, jogadaBot(M, pi, 'medio'), true);
  return true;
}

// saiu no meio: a dupla dele perde
export function dominoForfeit(M, pi) {
  if (M.players[pi].left || (M.result && M.result.matchOver)) return false;
  M.players[pi].left = true;
  M.over = { dupla: 1 - dupla(pi), forfeit: true }; M.fase = 'fim';
  M.seq = (M.seq || 0) + 1; M.last = { t: 'leave', pi, n: M.seq };
  fimDaPartida(M); M.result.forfeit = true;
  return true;
}
