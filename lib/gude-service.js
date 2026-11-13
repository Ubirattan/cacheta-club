// =====================================================================
// Bolinha de gude no servidor.
//  • Contra o computador: cada partida custa 1 ficha e não paga prêmio (nem no empate).
//    A partida fica guardada no banco (tabela gude_partidas) e TODA tecada é refeita aqui,
//    junto com as do computador: o navegador não consegue inventar uma vitória.
//  • Online 1 contra 1: usado pelas salas (lib/service.js). Entrada mínima de 2 fichas de cada.
//    Taxa da casa (lib/taxa.js): entrada até 10 → o ganhador leva a entrada + metade da do outro;
//    acima de 10 → a casa fica com 10% do pote; acima de 100 → 20% do pote. Empate devolve a entrada.
// =====================================================================
import { itemById } from './shop-items.js';
import { newGame, launch, simulate, snapshot, botShot, velOf, MODOS } from './gude.js';
import { GameError } from './service-error.js';
import { premioOnline } from './taxa.js';

const fail = (m, s) => { throw new GameError(m, s); };
export const BOT_COST = 1, BOT_PRIZE = 0;
export const GUDE_MIN_ENTRY = 2;
// quanto o ganhador recebe numa sala online de gude (o resto do pote fica pra casa)
export const gudeWinnerTake = (entry, jogadores = 2) => premioOnline(entry, jogadores);
export const BOTS = [['Tião', '🤠'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺']];
const LEVELS = ['facil', 'medio', 'dificil'];
const FRAME_MS = 1000 / 60;

// salas de gude: 'gude-triangulo', 'gude-bulica', 'gude-matamata'
export const isGude = m => typeof m === 'string' && m.startsWith('gude-') && !!MODOS[m.slice(5)];
export const gudeSub = m => m.slice(5);

// o que vai pro navegador (sem a lista interna de eventos)
export function gudePublic(S) {
  const { events, ...rest } = S; // eslint-disable-line no-unused-vars
  const entry = S.cfg ? S.cfg.entry : 0;
  return { ...rest, events: [], pot: entry * S.players.length, prize: gudeWinnerTake(entry, S.players.length) };
}

// teca e refaz a jogada inteira; devolve a tecada (com a mesa de antes, pra animar)
function play(S, vx, vy) {
  const pre = snapshot(S), pi = S.turn;
  const v = launch(S, vx, vy);
  if (!v) fail('Tecada inválida');
  const frames = simulate(S);
  return { pi, vx: v.vx, vy: v.vy, pre, n: S.shots, frames };
}

/* ======================= CONTRA O COMPUTADOR ======================= */
function botTurns(S, level) {
  const out = [];
  for (let k = 0; k < 40 && !S.over && S.turn === 1; k++) {
    const { ang, power } = botShot(S, level), v = velOf(ang, power);
    out.push(play(S, v.vx, v.vy));
  }
  return out;
}

async function pay(repo, uid, S) {
  const w = S.over.winner;
  // contra o computador não tem prêmio: a ficha da partida é só o custo pra jogar
  const prize = w === 0 ? BOT_PRIZE : 0;
  if (prize) await repo.adjustProfile(uid, prize, 0, 0);
  return prize;
}

export async function gudeBot(repo, user, b = {}) {
  const op = b.op;
  if (op === 'start') {
    const profile = await repo.getProfile(user.id);
    if (!profile || profile.blocked) fail('Conta bloqueada', 403);
    const mode = MODOS[b.mode] ? b.mode : 'triangulo', level = LEVELS.includes(b.level) ? b.level : 'medio';
    // partida que ficou pela metade conta como perdida
    await repo.upd('gude_partidas', { user_id: user.id, status: 'playing' }, { status: 'abandoned' });
    if ((await repo.adjustProfile(user.id, -BOT_COST, 0, 0)) == null) fail('Você está sem fichas. Compre fichas na Loja para jogar', 402);
    const bot = BOTS[Math.random() * BOTS.length | 0];
    const S = newGame({ mode, first: Number(b.first) === 1 ? 1 : 0,
      players: [{ name: profile.nickname || 'Você', avatar: profile.avatar || '😎', ...bolinha(profile) }, { name: bot[0], avatar: bot[1], bot: true }] });
    S.level = level;
    const shots = botTurns(S, level);
    let row;
    try { [row] = await repo.ins('gude_partidas', { user_id: user.id, mode, level, state: S, version: 1, status: S.over ? 'done' : 'playing' }); }
    catch (e) { await repo.adjustProfile(user.id, BOT_COST, 0, 0); throw e; } // não gravou: devolve a ficha
    const prize = S.over ? await pay(repo, user.id, S) : 0;
    return { id: row.id, version: 1, state: gudePublic(S), shots, prize, cost: BOT_COST };
  }
  if (op === 'shot') {
    const [row] = await repo.sel('gude_partidas', { id: b.id, user_id: user.id });
    if (!row) fail('Partida não encontrada', 404);
    if (row.status !== 'playing') fail('Essa partida já acabou');
    if (Number(b.version) !== row.version) fail('A mesa mudou, recarregando…', 409);
    const S = row.state;
    if (S.turn !== 0) fail('Não é a sua vez');
    const shots = [play(S, b.vx, b.vy), ...botTurns(S, S.level)];
    const saved = await repo.upd('gude_partidas', { id: row.id, version: row.version }, { state: S, version: row.version + 1, status: S.over ? 'done' : 'playing' });
    if (!saved || saved.length !== 1) fail('Jogada repetida', 409);
    const prize = S.over ? await pay(repo, user.id, S) : 0;
    return { id: row.id, version: row.version + 1, state: gudePublic(S), shots, prize };
  }
  if (op === 'state') {
    const rows = await repo.sel('gude_partidas', { id: b.id, user_id: user.id });
    if (!rows[0]) fail('Partida não encontrada', 404);
    return { id: rows[0].id, version: rows[0].version, state: gudePublic(rows[0].state), status: rows[0].status };
  }
  if (op === 'quit') {
    await repo.upd('gude_partidas', { user_id: user.id, status: 'playing' }, { status: 'abandoned' });
    return { ok: true };
  }
  fail('Pedido inválido');
}

// bolinha que o jogador comprou na loja da gude (a leiteira é a padrão)
function bolinha(p) {
  const it = itemById(p && (p.bola || (p.equipped && p.equipped.bola)));
  return it && it.slot === 'bola' && it.id !== 'bola-leiteira' ? { k: it.colors, tipo: it.tipo } : {};
}

/* ======================= ONLINE 1 CONTRA 1 ======================= */
export function gudeMatch(room, players) {
  const S = newGame({ mode: gudeSub(room.mode), first: Math.random() < .5 ? 0 : 1,
    players: players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar, ...bolinha(p) })) });
  S.cfg = { entry: room.entry, turn: room.turn_seconds };
  S.matchId = Date.now(); S.round = 1; S.result = null; S.endedAt = null;
  S.deadline = Date.now() + room.turn_seconds * 1000 + 2500;
  S.last = { t: 'start' };
  return S;
}

function endIfOver(S) {
  if (!S.over) return;
  const w = S.over.winner;
  S.result = { matchOver: true, champion: w >= 0 ? w : null, tie: w < 0, winner: w };
  S.endedAt = Date.now(); S.deadline = null;
}

export function gudeAct(S, pi, a) {
  if (a.type !== 'shot') fail('Jogada inválida');
  if (S.over) fail('A partida já acabou');
  if (S.turn !== pi) fail('Não é a sua vez');
  const shot = play(S, a.vx, a.vy);
  S.last = { t: 'shot', ...shot, settle: S.lastSettle || null };
  // o cronômetro só corre depois que a bolinha para na tela de todo mundo
  S.deadline = Date.now() + shot.frames * FRAME_MS + S.cfg.turn * 1000 + 1500;
  endIfOver(S);
}

// tempo da vez acabou: passa a vez (a bolinha fica onde está)
export function gudeTick(S, now = Date.now()) {
  if (S.over || !S.deadline || now < S.deadline + 1500) return false;
  const pi = S.turn;
  S.players[pi].timeouts = (S.players[pi].timeouts || 0) + 1;
  S.turn = 1 - pi;
  S.last = { t: 'timeout', pi, n: S.shots };
  S.deadline = now + S.cfg.turn * 1000;
  return true;
}

// saiu no meio: o outro ganha
export function gudeForfeit(S, pi) {
  if (S.players[pi].left || (S.result && S.result.matchOver)) return false;
  S.players[pi].left = true;
  S.over = { winner: 1 - pi, forfeit: true };
  S.last = { t: 'leave', pi, n: S.shots };
  endIfOver(S); S.result.forfeit = true;
  return true;
}
