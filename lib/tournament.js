// =====================================================================
// Torneios: inscrição, sorteio das mesas, avanço automático por rodada
// e prêmio para o campeão. Cada mesa do torneio é uma sala privada comum;
// quem vence a mesa passa para a próxima rodada.
// =====================================================================
import { GameError, maybeStart, leaveAllRooms, tick, getSettings } from './service.js';
import { MODES, TURN_SECONDS } from './modes.js';

const fail = (m, s) => { throw new GameError(m, s); };
const code = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// divide n jogadores em mesas de no máximo `size`, o mais iguais possível
export function splitTables(list, size) {
  const n = list.length, k = Math.ceil(n / size), out = [];
  let i = 0;
  for (let t = 0; t < k; t++) { const len = Math.floor(n / k) + (t < n % k ? 1 : 0); out.push(list.slice(i, i + len)); i += len; }
  return out;
}

async function getT(repo, id) {
  const [t] = await repo.sel('tournaments', { id });
  if (!t) fail('Torneio não encontrado', 404);
  return t;
}

export async function createTournament(repo, admin, b) {
  const st = await getSettings(repo);
  const name = String(b.name || '').trim().slice(0, 40); if (name.length < 3) fail('Dê um nome ao torneio');
  const mode = MODES[b.mode] && st.modes_enabled.includes(b.mode) ? b.mode : fail('Modalidade inválida');
  const size = Number(b.tableSize); if (!(size >= 2 && size <= 9)) fail('Mesa de 2 a 9 jogadores');
  const maxp = Number(b.maxPlayers || 36); if (!(maxp >= 2 && maxp <= 500)) fail('Máximo de inscritos inválido');
  const entry = Math.max(0, Math.floor(Number(b.entry || 0)));
  const prize = Math.max(0, Math.floor(Number(b.prize || 0)));
  const points = [3, 5, 7, 10].includes(Number(b.points)) ? Number(b.points) : 3;
  const turn = TURN_SECONDS.includes(Number(b.turnSeconds)) ? Number(b.turnSeconds) : 30;
  const startsAt = b.startsAt ? new Date(b.startsAt) : null;
  if (startsAt && isNaN(startsAt)) fail('Data de início inválida');
  const [t] = await repo.ins('tournaments', { name, mode, table_size: size, max_players: maxp, entry, prize, points, turn_seconds: turn, starts_at: startsAt ? startsAt.toISOString() : null, created_by: admin.id });
  return t;
}

export async function joinTournament(repo, user, id) {
  const t = await getT(repo, id);
  if (t.status !== 'open') fail('As inscrições desse torneio já fecharam');
  const ps = await repo.sel('tournament_players', { tournament_id: id });
  if (ps.some(p => p.user_id === user.id)) return { ok: true };
  if (ps.length >= t.max_players) fail('Torneio lotado');
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) fail('Conta bloqueada', 403);
  if (t.entry > 0 && (await repo.adjustProfile(user.id, -t.entry, 0, 0)) == null) fail('Você não tem fichas para a inscrição');
  try {
    await repo.ins('tournament_players', { tournament_id: id, user_id: user.id, nickname: profile.nickname, avatar: profile.avatar });
  } catch (e) { if (t.entry > 0) await repo.adjustProfile(user.id, t.entry, 0, 0); throw e; }
  return { ok: true };
}

export async function leaveTournament(repo, user, id) {
  const t = await getT(repo, id);
  if (t.status !== 'open') fail('O torneio já começou: para sair, saia da sua mesa');
  const ps = await repo.sel('tournament_players', { tournament_id: id, user_id: user.id });
  if (!ps.length) return { ok: true };
  await repo.del('tournament_players', { tournament_id: id, user_id: user.id });
  if (t.entry > 0) await repo.adjustProfile(user.id, t.entry, 0, 0);
  return { ok: true };
}

export async function cancelTournament(repo, id) {
  const t = await getT(repo, id);
  if (!['open', 'running'].includes(t.status)) fail('Esse torneio já terminou');
  const rows = await repo.upd('tournaments', { id, status: t.status }, { status: 'canceled' });
  if (!rows.length) return { ok: true };
  for (const p of await repo.sel('tournament_players', { tournament_id: id })) if (t.entry > 0) await repo.adjustProfile(p.user_id, t.entry, 0, 0);
  return { ok: true };
}

export async function startTournament(repo, id) {
  const t = await getT(repo, id);
  if (t.status !== 'open') fail('Esse torneio não está com inscrições abertas');
  const ps = await repo.sel('tournament_players', { tournament_id: id });
  if (ps.length < 2) { await cancelTournament(repo, id); return { canceled: true }; }
  const rows = await repo.upd('tournaments', { id, status: 'open' }, { status: 'running', round: 1 });
  if (!rows.length) return { ok: true }; // outro pedido já começou
  await createRoundTables(repo, { ...t, status: 'running', round: 1 }, 1, ps.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar })));
  return { ok: true };
}

async function createRoundTables(repo, t, round, plist) {
  const groups = splitTables(shuffle(plist.slice()), t.table_size);
  let n = 0;
  for (const g of groups) {
    n++;
    let room = null;
    for (let i = 0; i < 5 && !room; i++) {
      room = await repo.createRoom({ code: code(), name: `${t.name} · R${round} · Mesa ${n}`, mode: t.mode, max_players: Math.max(2, g.length), points: t.points, entry: 0, turn_seconds: t.turn_seconds, is_private: true, status: 'waiting', host: g[0].uid, tournament_id: t.id });
    }
    await repo.ins('tournament_tables', { tournament_id: t.id, round, room_id: room.id, players: g });
    if (g.length === 1) { // sobrou sozinho: passa direto (bye)
      await repo.updateRoom(room.id, { status: 'closed' });
      await tableDone(repo, room.id, g[0]);
      continue;
    }
    for (let s = 0; s < g.length; s++) {
      await leaveAllRooms(repo, { id: g[s].uid }, room.id);
      await repo.addRoomPlayer({ room_id: room.id, user_id: g[s].uid, seat: s, ready: true, nickname: g[s].name, avatar: g[s].avatar });
    }
    await maybeStart(repo, room.id);
  }
}

// chamado quando uma mesa do torneio termina
export async function tableDone(repo, roomId, winner) {
  const [tt] = await repo.sel('tournament_tables', { room_id: roomId });
  if (!tt || tt.done) return;
  await repo.upd('tournament_tables', { tournament_id: tt.tournament_id, room_id: roomId }, { done: true, winner: winner ? winner.uid : null, winner_name: winner ? winner.name : null });
  for (const p of tt.players) {
    const won = winner && p.uid === winner.uid;
    await repo.upd('tournament_players', { tournament_id: tt.tournament_id, user_id: p.uid }, won ? { round_reached: tt.round } : { status: 'out', round_reached: tt.round });
  }
  await checkRound(repo, tt.tournament_id);
}

async function checkRound(repo, id) {
  const t = await getT(repo, id);
  if (t.status !== 'running') return;
  const tables = await repo.sel('tournament_tables', { tournament_id: id, round: t.round });
  if (!tables.length || tables.some(x => !x.done)) return;
  // trava: só um pedido avança a rodada
  const moved = await repo.upd('tournaments', { id, round: t.round, status: 'running' }, { round: t.round + 1 });
  if (!moved.length) return;
  const winners = [];
  for (const x of tables) if (x.winner) { const p = x.players.find(q => q.uid === x.winner); if (p && !winners.some(w => w.uid === p.uid)) winners.push(p); }
  if (winners.length >= 2) return createRoundTables(repo, { ...t, round: t.round + 1 }, t.round + 1, winners);
  const champ = winners[0] || null;
  const count = (await repo.sel('tournament_players', { tournament_id: id })).length;
  const pot = t.entry * count + t.prize;
  if (champ) {
    await repo.adjustProfile(champ.uid, pot, 0, 0, 50 + 5 * count);
    await repo.upd('tournament_players', { tournament_id: id, user_id: champ.uid }, { status: 'champion' });
  }
  await repo.upd('tournaments', { id }, { status: 'finished', round: t.round, champion: champ ? champ.uid : null, champion_name: champ ? champ.name : null });
}

// chamado de tempos em tempos pelas telas: começa torneios na hora marcada
// e "empurra" as mesas em andamento (cronômetro) mesmo se ninguém da mesa estiver olhando
export async function tournamentsTick(repo) {
  const now = Date.now();
  for (const t of await repo.sel('tournaments', { status: 'open' })) {
    if (t.starts_at && new Date(t.starts_at).getTime() <= now) { try { await startTournament(repo, t.id); } catch (e) { console.error(e); } }
  }
  for (const t of await repo.sel('tournaments', { status: 'running' })) {
    for (const x of await repo.sel('tournament_tables', { tournament_id: t.id, round: t.round })) {
      if (!x.done) { try { await tick(repo, null, x.room_id); } catch {} }
    }
  }
  return { ok: true };
}
