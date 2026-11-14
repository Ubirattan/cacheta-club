// =====================================================================
// BINGO ONLINE no servidor: sala 'bingo' de 2 a 10 jogadores; o dono escolhe quantos e o valor da cartela (5 a 200).
//  • Antes de começar, cada um escolhe de 1 a 3 cartelas entre 6 opções (pode trocar as opções).
//  • Começa quando todos que sentaram (2 ou mais) estão prontos com cartela; cada cartela custa o valor da sala.
//  • O servidor sorteia uma bola a cada 4,5 s (a ordem fica escondida). Quem completa a cartela inteira ganha
//    na hora (o site confere sozinho, mesmo se o cliente não marcou). Empate na mesma bola: divide por cartela.
//  • Pote = soma das cartelas; a casa fica com 10% (pote até 100) ou 20% (acima de 100): lib/bingo.js.
// =====================================================================
import { GameError } from './service-error.js';
import { novaCartela, embaralharBolas, cheia, premioBingo, MAX_CARTELAS, OPCOES, BOLA_MS, BINGO_MIN, BINGO_MAX } from './bingo.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const isBingo = m => m === 'bingo';
export { BINGO_MIN, BINGO_MAX };
const INICIO_MS = 4000;

// ---------- antes de começar: escolha das cartelas ----------
export function bingoEspera(room) { return { game: 'bingo', fase: 'espera', cfg: { entry: room.entry }, escolhas: {}, matchId: null }; }
function opcoesDe(W, uid) {
  if (!W.escolhas[uid]) W.escolhas[uid] = { opcoes: Array.from({ length: OPCOES }, () => novaCartela()), minhas: [] };
  return W.escolhas[uid];
}
export function bingoEscolha(W, uid, a) {
  if (W.fase !== 'espera') fail('A partida já começou');
  const e = opcoesDe(W, uid);
  if (a.type === 'cartelas') return;
  if (a.type === 'escolher') {
    const id = String(a.id || '');
    if (!e.opcoes.some(c => c.id === id)) fail('Cartela inválida');
    if (e.minhas.includes(id)) e.minhas = e.minhas.filter(x => x !== id);
    else { if (e.minhas.length >= MAX_CARTELAS) fail(`No máximo ${MAX_CARTELAS} cartelas por jogo`); e.minhas.push(id); }
    return;
  }
  if (a.type === 'trocar') { e.opcoes = e.opcoes.map(c => e.minhas.includes(c.id) ? c : novaCartela()); return; }
  fail('Jogada inválida');
}
export const qtdCartelas = (W, uid) => (W && W.fase === 'espera' && W.escolhas[uid] ? W.escolhas[uid].minhas.length : 0);

// ---------- partida ----------
export function bingoMatch(room, players, W) {
  const M = {
    game: 'bingo', fase: 'jogo', matchId: Date.now(), round: 1, cfg: { entry: room.entry },
    ordem: embaralharBolas(), saiu: [],
    players: players.map(p => {
      const e = W.escolhas[p.user_id];
      return { uid: p.user_id, name: p.nickname, avatar: p.avatar, cartelas: e.opcoes.filter(c => e.minhas.includes(c.id)) };
    }),
    result: null, last: { t: 'inicio', n: 0 }, seq: 0,
  };
  M.pote = room.entry * M.players.reduce((t, p) => t + p.cartelas.length, 0);
  M.premio = premioBingo(M.pote);
  M.nextAt = Date.now() + INICIO_MS; M.deadline = null;
  return M;
}

export function bingoPublic(M) {
  if (M.fase === 'espera') return { game: 'bingo', fase: 'espera', cfg: M.cfg, escolhas: M.escolhas, matchId: M.matchId };
  return {
    game: 'bingo', fase: M.fase, matchId: M.matchId, round: M.round, cfg: M.cfg, saiu: M.saiu, nextAt: M.nextAt, deadline: null,
    players: M.players.map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar, cartelas: p.cartelas, left: !!p.left })),
    pote: M.pote, premio: M.premio, last: M.last, result: M.result,
  };
}

// sorteia a próxima bola e confere as cartelas
export function bingoTick(M, now = Date.now()) {
  if (M.fase !== 'jogo' || !M.nextAt || now < M.nextAt) return false;
  const bola = M.ordem[M.saiu.length];
  M.saiu.push(bola);
  M.seq = (M.seq || 0) + 1; M.last = { t: 'bola', n: M.seq, bola };
  const s = new Set(M.saiu), ganhas = [];
  M.players.forEach((p, pi) => { if (!p.left) p.cartelas.forEach(c => { if (cheia(c, s)) ganhas.push({ pi, id: c.id }); }); });
  if (ganhas.length || M.saiu.length >= 75) {
    const cada = Math.floor(M.premio / Math.max(1, ganhas.length) * 100) / 100;
    const pagamentos = {};
    for (const g of ganhas) pagamentos[g.pi] = Math.round(((pagamentos[g.pi] || 0) + cada) * 100) / 100;
    const winners = Object.keys(pagamentos).map(Number);
    M.fase = 'fim'; M.nextAt = null; M.endedAt = now;
    M.result = { matchOver: true, winners, champion: winners[0] ?? null, pagamentos, cartelas: ganhas, bola };
    M.last = { t: 'bingo', n: M.seq, bola, ganhas };
    return true;
  }
  M.nextAt = now + BOLA_MS;
  return true;
}

// quem sai no meio perde as cartelas; se ninguém sobrar, acaba sem vencedor (a casa devolve nada: ninguém pra receber)
export function bingoForfeit(M, pi) {
  if (M.fase !== 'jogo' || M.players[pi].left) return false;
  M.players[pi].left = true;
  M.seq = (M.seq || 0) + 1; M.last = { t: 'leave', pi, n: M.seq };
  if (M.players.every(p => p.left)) { M.fase = 'fim'; M.nextAt = null; M.result = { matchOver: true, winners: [], champion: null, pagamentos: {}, cartelas: [] }; return true; }
  return true;
}
