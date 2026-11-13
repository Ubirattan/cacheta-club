// =====================================================================
// Pipa ONLINE 1 contra 1 no servidor (sala 'pipa-1x1'), valendo fichas com a taxa da casa (lib/taxa.js).
//
// Como fica justo sem o servidor rodar a física:
//  • O servidor sorteia a SEMENTE da partida. Os dois celulares rodam a mesma física (lib/pipa.js,
//    com matemática determinística: lib/detmath.js) e trocam só os TOQUES de cada um (lockstep).
//    Com a mesma semente e os mesmos toques, os dois chegam exatamente no mesmo resultado.
//  • No fim, cada celular manda o resultado (quem ganhou + um resumo da partida).
//      - os dois iguais → paga o ganhador (menos a parte da casa);
//      - diferentes (alguém mexeu no jogo) → ninguém ganha: cada um recebe a entrada de volta;
//      - só um mandou (o outro sumiu) → depois de 45 s vale o que chegou;
//      - ninguém mandou em 15 min → devolve a entrada dos dois.
//  • Quem sai no meio perde.
// =====================================================================
import { GameError } from './service-error.js';
import { premioOnline } from './taxa.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const PIPA_MIN_ENTRY = 2;
export const isPipa = m => m === 'pipa-1x1';
const ESPERA_OUTRO = 45000, MAX_PARTIDA = 15 * 60000;

export function pipaPublic(M) {
  const entry = M.cfg ? M.cfg.entry : 0;
  return { ...M, prize: premioOnline(entry, M.players.length), pot: entry * M.players.length };
}

export function pipaMatch(room, players) {
  const now = Date.now();
  return {
    game: 'pipa', matchId: now, round: 1, seed: (Math.random() * 2 ** 31) | 0,
    players: players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar, pipa: (p.equipped && p.equipped.pipa) || null })),
    cfg: { entry: room.entry, turn: room.turn_seconds }, startAt: now + 5000,
    reports: [null, null], firstReportAt: null, deadline: now + MAX_PARTIDA, over: null, result: null, last: { t: 'start' },
  };
}

function fecha(M, winner, why) {
  const tie = winner == null;
  M.over = { winner: tie ? -1 : winner, why };
  M.result = { matchOver: true, champion: tie ? null : winner, tie, winner: tie ? -1 : winner, why };
  M.endedAt = Date.now(); M.deadline = null;
  M.last = { t: 'fim', why };
}

export function pipaAct(M, pi, a) {
  if (M.over) fail('A partida já acabou');
  if (a.type !== 'resultado') fail('Jogada inválida');
  const w = Number(a.winner);
  if (!(w === 0 || w === 1)) fail('Resultado inválido');
  if (M.reports[pi]) return;   // já mandou
  M.reports[pi] = { winner: w, hash: String(a.hash || '').slice(0, 200), at: Date.now() };
  if (!M.firstReportAt) M.firstReportAt = Date.now();
  M.last = { t: 'resultado', pi };
  const [r0, r1] = M.reports;
  if (r0 && r1) {
    if (r0.winner === r1.winner && r0.hash === r1.hash) fecha(M, r0.winner, 'ok');
    else fecha(M, null, 'diferente');   // os celulares não bateram: devolve a entrada
  }
}

// o outro não mandou o resultado (sumiu) ou a partida passou do tempo
export function pipaTick(M, now = Date.now()) {
  if (M.over) return false;
  const um = M.reports.find(Boolean);
  if (um && M.firstReportAt && now > M.firstReportAt + ESPERA_OUTRO) { fecha(M, um.winner, 'so-um'); return true; }
  if (!um && M.deadline && now > M.deadline) { fecha(M, null, 'tempo'); return true; }
  return false;
}

export function pipaForfeit(M, pi) {
  if (M.over || M.players[pi].left) return false;
  M.players[pi].left = true;
  fecha(M, 1 - pi, 'saiu'); M.result.forfeit = true;
  return true;
}
