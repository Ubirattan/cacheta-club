// =====================================================================
// Regras do servidor: salas, início automático, jogadas, cronômetro.
// Toda jogada é validada aqui com o motor (Engine.act). O navegador só
// manda a intenção ("comprar do monte", "descartar carta X").
// `repo` é a camada do banco (lib/repo-supabase.js); nos testes, um banco em memória.
// =====================================================================
import { Engine, AI } from './engine.js';
import { MODES, ENTRIES, POINTS, TURN_SECONDS } from './modes.js';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { GameError } from './service-error.js';
import { isGude, gudeMatch, gudeAct, gudeTick, gudeForfeit, gudePublic, GUDE_MIN_ENTRY, gudeWinnerTake } from './gude-service.js';
export { GameError };

export async function getSettings(repo) {
  const out = { daily_bonus: 0, ads_enabled: false, modes_enabled: ['cacheta', 'dez', 'pifpaf'], max_entry: 200, motd: '', ads: [] };
  try { for (const r of await repo.sel('app_settings')) out[r.key] = r.value; } catch {}
  return out;
}
export const isVip = p => !!(p && p.vip_until && new Date(p.vip_until).getTime() > Date.now());

const fail = (m, s) => { throw new GameError(m, s); };

const NEXT_ROUND_MS = 7000;   // tempo mostrando o resultado antes da próxima rodada
const DEAL_MS = 2500;         // folga para a animação de distribuir

export function hashPass(p) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(p, salt, 32).toString('hex');
}
export function checkPass(p, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = scryptSync(String(p), salt, 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

/* ---------------- estado público (o que todos podem ver) ---------------- */
export function project(M) {
  if (M.game === 'gude') return gudePublic(M);
  const top = M.desc[M.desc.length - 1] || null;
  return {
    matchId: M.matchId, round: M.round,
    cfg: { hand: M.cfg.hand, coringa: M.cfg.coringa, limpaDobro: M.cfg.limpaDobro, turn: M.cfg.turn, entry: M.cfg.entry, correr: !!M.cfg.correr, deck: M.cfg.deck },
    players: M.players.map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar, fichas: p.fichas, count: p.hand.length, queimado: !!p.queimado, left: !!p.left, out: !!p.out,
      // na hora de decidir, os outros só veem se você já decidiu; a escolha aparece quando todos decidem
      dec: M.phase === 'decide' ? (p.dec ? 'ok' : null) : (p.dec || null) })),
    vira: M.vira, cor: M.cor, monte: M.monte.length, descTop: top, descCount: M.desc.length,
    turn: M.turn, phase: M.phase, taken: M.taken, over: M.over,
    result: M.result || null, deadline: M.deadline || null, endedAt: M.endedAt || null,
    nextRoundAt: M.over && M.result && !M.result.matchOver ? (M.endedAt + NEXT_ROUND_MS) : null,
    last: M.last || null, pot: (M.cfg.entry || 0) * M.players.length,
  };
}
const handsOf = M => M.players.map(p => ({ uid: p.uid, cards: p.hand || [] }));

async function save(repo, roomId, M, prevVersion) {
  M.at = Date.now(); // última atividade da mesa (usada para fechar mesas abandonadas)
  return repo.saveGame(roomId, M, prevVersion, project(M), handsOf(M));
}
function setDeadline(M, extra = 0) { M.deadline = Date.now() + M.cfg.turn * 1000 + extra; }

/* ---------------- salas ---------------- */
export async function createRoom(repo, user, b) {
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) fail('Conta bloqueada', 403);
  const st = await getSettings(repo);
  const gude = isGude(b.mode);   // bolinha de gude: sempre 1 contra 1
  const mode = gude || (MODES[b.mode] && st.modes_enabled.includes(b.mode)) ? b.mode : fail('Modalidade indisponível no momento');
  const max = gude ? 2 : Number(b.maxPlayers); if (!(max >= 2 && max <= 9)) fail('A sala deve ter de 2 a 9 jogadores');
  const points = gude ? 1 : Number(b.points); if (!gude && !POINTS.includes(points)) fail('Pontos inválidos');
  const entry = Number(b.entry || 0); if (!ENTRIES.includes(entry) || entry > st.max_entry) fail('Entrada inválida');
  if (gude && entry < GUDE_MIN_ENTRY) fail(`Na gude a entrada mínima é ${GUDE_MIN_ENTRY} fichas`);
  const vipOnly = !!b.vipOnly; if (vipOnly && !isVip(profile)) fail('Só jogadores VIP podem criar salas VIP');
  const turn = Number(b.turnSeconds || 30); if (!TURN_SECONDS.includes(turn)) fail('Tempo por jogada inválido');
  const isPrivate = !!b.isPrivate;
  const pass = String(b.password || '');
  if (isPrivate && pass.length < 3) fail('A senha precisa ter pelo menos 3 caracteres');
  if (profile.coins < entry) fail('Você não tem fichas para essa entrada');
  if (profile.coins <= 0) fail('Você está sem fichas. Compre fichas na Loja para jogar');
  const name = String(b.name || '').trim().slice(0, 30) || `Mesa de ${profile.nickname}`;
  await leaveAllRooms(repo, user);
  let room = null;
  for (let i = 0; i < 5 && !room; i++) {
    room = await repo.createRoom({ code: newCode(), name, mode, max_players: max, points, entry, turn_seconds: turn, is_private: isPrivate, vip_only: vipOnly, status: 'waiting', host: user.id });
  }
  if (!room) fail('Não foi possível criar a sala, tente de novo', 500);
  if (isPrivate) await repo.setRoomSecret(room.id, hashPass(pass));
  await repo.addRoomPlayer({ room_id: room.id, user_id: user.id, seat: 0, ready: false, nickname: profile.nickname, avatar: profile.avatar });
  return { id: room.id, code: room.code };
}

export async function joinRoom(repo, user, roomRef, password) {
  const room = roomRef.code ? await repo.getRoomByCode(String(roomRef.code).toUpperCase()) : await repo.getRoom(roomRef.id);
  if (!room) fail('Sala não encontrada', 404);
  const players = await repo.listRoomPlayers(room.id);
  if (players.some(p => p.user_id === user.id)) return { id: room.id, code: room.code };
  if (room.tournament_id) fail('Essa mesa é de torneio: só os jogadores sorteados sentam nela');
  if (room.status !== 'waiting') fail('Essa sala já está jogando. Espere a partida acabar.');
  if (players.length >= room.max_players) fail('Sala cheia');
  if (room.is_private) {
    const secret = await repo.getRoomSecret(room.id);
    if (!checkPass(password || '', secret)) fail('Senha errada', 403);
  }
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) fail('Conta bloqueada', 403);
  if (profile.coins < room.entry) fail('Você não tem fichas para a entrada dessa sala');
  if (!room.tournament_id && profile.coins <= 0) fail('Você está sem fichas. Compre fichas na Loja para jogar');
  if (room.vip_only && !isVip(profile)) fail('Sala exclusiva para VIP 👑');
  await leaveAllRooms(repo, user, room.id);
  for (let tries = 0; tries < 4; tries++) {
    const cur = await repo.listRoomPlayers(room.id);
    if (cur.length >= room.max_players) fail('Sala cheia');
    const used = new Set(cur.map(p => p.seat));
    let seat = 0; while (used.has(seat)) seat++;
    const ok = await repo.addRoomPlayer({ room_id: room.id, user_id: user.id, seat, ready: false, nickname: profile.nickname, avatar: profile.avatar });
    if (ok) return { id: room.id, code: room.code };
  }
  fail('Não deu pra sentar agora, tente de novo', 409);
}

export async function leaveAllRooms(repo, user, exceptId) {
  const mine = await repo.roomsOfUser(user.id);
  for (const rid of mine) if (rid !== exceptId) await leaveRoom(repo, user, rid);
}

export async function leaveRoom(repo, user, roomId) {
  const room = await repo.getRoom(roomId);
  if (!room) return { ok: true };
  const players = await repo.listRoomPlayers(roomId);
  if (!players.some(p => p.user_id === user.id)) return { ok: true };
  if (room.status === 'playing') await forfeit(repo, room, user.id);
  await repo.removeRoomPlayer(roomId, user.id);
  const rest = players.filter(p => p.user_id !== user.id);
  if (!rest.length) { await repo.deleteRoom(roomId); return { ok: true }; }
  if (room.host === user.id) await repo.updateRoom(roomId, { host: rest.sort((a, b) => a.seat - b.seat)[0].user_id });
  if ((await repo.getRoom(roomId))?.status === 'waiting') await maybeStart(repo, roomId);
  return { ok: true };
}

// quem sai no meio da partida perde (zera os pontos)
async function forfeit(repo, room, uid) {
  for (let t = 0; t < 4; t++) {
    const g = await repo.getGame(room.id); if (!g) return;
    const M = g.state; const pi = M.players.findIndex(p => p.uid === uid);
    if (pi < 0 || M.players[pi].left) return;
    if (M.game === 'gude') {
      if (!gudeForfeit(M, pi)) return;
      if (await save(repo, room.id, M, g.version)) { await finishMatch(repo, room.id, M); return; }
      continue;
    }
    const p = M.players[pi];
    p.fichas = 0; p.left = true; p.hand = [];
    M.last = { pi, t: 'leave' };
    const alive = Engine.alive(M);
    let finished = false;
    if (alive.length <= 1 && !(M.result && M.result.matchOver)) {
      M.over = true; M.phase = 'end'; M.endedAt = Date.now();
      M.result = { ...(M.result || {}), forfeit: true, matchOver: true, champion: alive.length ? M.players.indexOf(alive[0]) : null };
      finished = true;
    } else if (!M.over && M.turn === pi) {
      M.turn = Engine.nextIdx(M, pi); M.phase = 'draw'; M.taken = null; setDeadline(M);
    }
    if (await save(repo, room.id, M, g.version)) { if (finished) await finishMatch(repo, room.id, M); return; }
  }
}

export async function setReady(repo, user, roomId, ready) {
  const room = await repo.getRoom(roomId); if (!room) fail('Sala não encontrada', 404);
  if (room.status !== 'waiting') fail('A partida já começou');
  const players = await repo.listRoomPlayers(roomId);
  if (!players.some(p => p.user_id === user.id)) fail('Você não está nessa sala', 403);
  if (ready) {
    const profile = await repo.getProfile(user.id);
    if (profile.coins < room.entry) fail('Você não tem fichas para a entrada dessa sala');
    if (!room.tournament_id && profile.coins <= 0) fail('Você está sem fichas. Compre fichas na Loja para jogar');
  }
  await repo.updateRoomPlayer(roomId, user.id, { ready: !!ready });
  return maybeStart(repo, roomId);
}

// começa sozinho quando há 2+ jogadores e todos estão prontos
export async function maybeStart(repo, roomId) {
  const room = await repo.getRoom(roomId);
  const players = (await repo.listRoomPlayers(roomId)).sort((a, b) => a.seat - b.seat);
  if (!room || room.status !== 'waiting' || players.length < 2 || !players.every(p => p.ready)) return { started: false };
  // conferir fichas antes de travar a sala
  for (const p of players) {
    const pr = await repo.getProfile(p.user_id);
    if (!pr || pr.coins < room.entry) { await repo.updateRoomPlayer(roomId, p.user_id, { ready: false }); return { started: false }; }
  }
  if (!(await repo.transitionRoom(roomId, 'waiting', 'playing'))) return { started: false }; // outro pedido já começou
  const charged = [];
  for (const p of players) {
    if (room.entry > 0) {
      const ok = await repo.adjustProfile(p.user_id, -room.entry, 0, 0);
      if (ok == null) { // devolve quem já pagou e cancela
        for (const c of charged) await repo.adjustProfile(c, room.entry, 0, 0);
        await repo.updateRoom(roomId, { status: 'waiting' });
        await repo.updateRoomPlayer(roomId, p.user_id, { ready: false });
        return { started: false };
      }
      charged.push(p.user_id);
    }
  }
  if (isGude(room.mode)) {
    const G = gudeMatch(room, players);
    const prevG = await repo.getGame(roomId);
    await save(repo, roomId, G, prevG ? prevG.version : null);
    return { started: true };
  }
  const mode = MODES[room.mode];
  const M = Engine.newMatch({ ...mode.cfg, maxJ: 99, aceHigh: true, limpaDobro: true, fichas: room.points },
    players.map(p => ({ uid: p.user_id, name: p.nickname, avatar: p.avatar, human: true })));
  M.cfg.turn = room.turn_seconds; M.cfg.entry = room.entry;
  M.matchId = Date.now();
  Engine.startRound(M); setDeadline(M, DEAL_MS); M.last = { t: 'deal' };
  const prev = await repo.getGame(roomId);
  await save(repo, roomId, M, prev ? prev.version : null);
  return { started: true };
}

/* ---------------- jogadas ---------------- */
function afterEvent(M, ev, pi) {
  if (ev.type === 'draw') M.last = { pi, t: 'draw', from: ev.from, card: ev.from === 'desc' ? ev.card : null };
  else if (ev.type === 'discard') { M.last = { pi, t: 'discard', card: ev.card }; setDeadline(M); }
  else if (ev.type === 'bateuErrado') { M.last = { pi, t: 'bateuErrado', card: ev.card, fora: !!ev.fora }; if (!ev.fora) setDeadline(M); }
  else if (ev.type === 'bater') { M.last = { pi, t: 'bater', card: ev.card }; M.endedAt = Date.now(); }
  else if (ev.type === 'empate') { M.last = { t: 'empate' }; M.endedAt = Date.now(); }
  else if (ev.type === 'decidido') { M.last = { t: 'decidido' }; setDeadline(M); }
  else if (ev.type === 'semJogo') { M.last = { t: 'semJogo' }; M.endedAt = Date.now(); }
}

export async function act(repo, user, roomId, action) {
  if (!action || !['draw', 'discard', 'bater', 'baterDesc', 'decide', 'shot'].includes(action.type)) fail('Jogada inválida');
  const a = action.type === 'draw' ? { type: 'draw', from: action.from === 'desc' ? 'desc' : 'monte' }
    : action.type === 'baterDesc' ? { type: 'baterDesc' }
    : action.type === 'decide' ? { type: 'decide', go: !!action.go, desistir: !!action.desistir }
    : { type: action.type, cardId: Number(action.cardId) };
  for (let t = 0; t < 4; t++) {
    const g = await repo.getGame(roomId); if (!g) fail('Nenhuma partida nessa sala', 404);
    const M = g.state; const pi = M.players.findIndex(p => p.uid === user.id);
    if (pi < 0) fail('Você não está nessa partida', 403);
    if (M.game === 'gude') {
      gudeAct(M, pi, { type: action.type, vx: Number(action.vx), vy: Number(action.vy) });
      if (await save(repo, roomId, M, g.version)) {
        if (M.result && M.result.matchOver) await finishMatch(repo, roomId, M);
        return { ok: true, version: (g.version || 0) + 1, state: project(M) };
      }
      continue;
    }
    if (M.game === 'gude' || a.type === 'shot') fail('Jogada inválida');
    const r = Engine.act(M, pi, a);
    if (!r.ok) fail(r.err);
    afterEvent(M, r.ev, pi);
    if (await save(repo, roomId, M, g.version)) {
      if (M.result && M.result.matchOver) await finishMatch(repo, roomId, M);
      // devolve a mesa e a mão já atualizadas: o navegador mostra na hora, sem esperar o tempo real
      return { ok: true, event: r.ev.type, version: (g.version || 0) + 1, state: project(M), hand: M.players[pi].hand };
    }
  }
  fail('Mesa ocupada, tente de novo', 409);
}

// chamado pelos navegadores a cada 2 s: estoura o cronômetro e abre a próxima rodada
export async function tick(repo, user, roomId) {
  for (let t = 0; t < 4; t++) {
    const g = await repo.getGame(roomId); if (!g) return { changed: false };
    const M = g.state;
    if (user && !M.players.some(p => p.uid === user.id)) fail('Você não está nessa partida', 403);
    const now = Date.now();
    if (M.game === 'gude') {
      if (!gudeTick(M, now)) return { changed: false };
      if (await save(repo, roomId, M, g.version)) return { changed: true };
      continue;
    }
    if (M.over) {
      if (!M.result || M.result.matchOver || now < M.endedAt + NEXT_ROUND_MS) return { changed: false };
      Engine.startRound(M); setDeadline(M, DEAL_MS); M.last = { t: 'deal' }; M.endedAt = null;
    } else {
      if (!M.deadline || now < M.deadline + 1500) return { changed: false };
      if (M.phase === 'decide') { // tempo de decidir acabou: quem não decidiu corre (com 1 ponto, joga)
        let r = null;
        for (let k = 0; k < M.players.length && M.phase === 'decide'; k++) {
          const q = M.players[k]; if (q.fichas <= 0 || q.dec) continue;
          q.timeouts = (q.timeouts || 0) + 1;
          r = Engine.act(M, k, { type: 'decide', go: q.fichas <= 1 });
        }
        if (r && r.ok) afterEvent(M, r.ev, -1);
        if (await save(repo, roomId, M, g.version)) {
          if (M.result && M.result.matchOver) await finishMatch(repo, roomId, M);
          return { changed: true };
        }
        continue;
      }
      const pi = M.turn, p = M.players[pi];
      p.timeouts = (p.timeouts || 0) + 1;
      if (M.phase === 'draw') {
        const r = Engine.act(M, pi, { type: 'draw', from: 'monte' });
        if (r.ok && r.ev.type === 'empate') afterEvent(M, r.ev, pi);
      }
      if (!M.over && M.phase === 'discard') {
        let a = AI.chooseEnd(M, pi, 'medio');
        let r = Engine.act(M, pi, a);
        if (!r.ok) { // por segurança: descarta a última carta que não seja a pega do descarte
          const c = [...p.hand].reverse().find(c => c.id !== M.taken);
          r = Engine.act(M, pi, { type: 'discard', cardId: c.id });
        }
        if (r.ok) afterEvent(M, r.ev, pi);
      }
      if (M.last && M.last.pi === pi) M.last.timeout = true;
    }
    if (await save(repo, roomId, M, g.version)) {
      if (M.result && M.result.matchOver) await finishMatch(repo, roomId, M);
      return { changed: true };
    }
  }
  return { changed: false };
}

// fim da partida: pote para o campeão, histórico, ranking; sala volta a esperar
async function finishMatch(repo, roomId, M) {
  const room = await repo.getRoom(roomId);
  const champ = M.result.champion;
  const entry = M.cfg.entry || 0, pot = entry * M.players.length;
  // gude: o ganhador leva a entrada dele + metade da do outro; o resto fica pra casa
  const take = M.game === 'gude' ? Math.min(pot, gudeWinnerTake(entry)) : pot;
  const tour = room && room.tournament_id;
  const tie = !!(M.result.tie && champ == null);   // empate (gude): cada um recebe a entrada de volta
  for (let i = 0; i < M.players.length; i++) {
    const p = M.players[i];
    if (tie && entry > 0) await repo.adjustProfile(p.uid, entry, 0, 0);
    // ranking: 10 pontos pra quem vence, 1 por jogar (no torneio os pontos vêm no final)
    await repo.adjustProfile(p.uid, i === champ ? take : 0, 1, i === champ ? 1 : 0, tour ? 0 : (i === champ ? 10 : 1));
  }
  try {
    const [h] = await repo.ins('match_history', {
      room_name: room ? room.name : 'Mesa', mode: room ? room.mode : 'cacheta', tournament_id: tour || null,
      players: M.players.map(p => ({ uid: p.uid, name: p.name, avatar: p.avatar })),
      winner: champ != null ? M.players[champ].uid : null, winner_name: champ != null ? M.players[champ].name : null,
      pot, rounds: M.round,
    });
    await repo.ins('match_players', M.players.map((p, i) => ({ match_id: h.id, user_id: p.uid, won: i === champ, coins_delta: tie ? 0 : (i === champ ? take : 0) - entry })));
  } catch (e) { console.error('histórico', e); }
  if (tour) {
    await repo.updateRoom(roomId, { status: 'closed' });
    const { tableDone } = await import('./tournament.js');
    await tableDone(repo, roomId, champ != null ? M.players[champ] : null);
    return;
  }
  await repo.updateRoom(roomId, { status: 'waiting' });
  await repo.resetReady(roomId);
}

/* ---------------- mesas abandonadas ---------------- */
// Quem está na tela da sala manda um "estou aqui" a cada 2 min (fica em room_players.joined_at).
export async function ping(repo, user, roomId) {
  await repo.updateRoomPlayer(roomId, user.id, { joined_at: new Date().toISOString() });
  return { ok: true };
}
// Mesa sem jogada e sem ninguém na tela por 10 min é fechada. Se a partida estava valendo,
// o pote volta inteiro para quem ainda estava na mesa (ninguém perde fichas).
export const STALE_MS = 10 * 60 * 1000;
let lastCleanup = 0;
export async function cleanupRooms(repo, now = Date.now(), force = false) {
  if (!force && now - lastCleanup < 60000) return { closed: 0, skipped: true };
  lastCleanup = now;
  let closed = 0;
  for (const room of await repo.sel('rooms', {}, { limit: 300 })) {
    if (room.tournament_id || room.status === 'closed') continue;
    const players = await repo.listRoomPlayers(room.id);
    let last = Date.parse(room.created_at) || 0;
    for (const p of players) last = Math.max(last, Date.parse(p.joined_at) || 0);
    const g = room.status === 'playing' ? await repo.getGame(room.id) : null;
    if (g && g.state.at) last = Math.max(last, g.state.at);
    if (players.length && now - last < STALE_MS) continue;
    if (g && !(g.state.result && g.state.result.matchOver)) {
      const M = g.state;
      M.over = true; M.phase = 'end'; M.endedAt = now; M.result = { ...(M.result || {}), matchOver: true, abandoned: true, champion: null };
      if (!(await save(repo, room.id, M, g.version))) continue; // alguém jogou agora: deixa a mesa
      const pot = (M.cfg.entry || 0) * M.players.length, ficam = M.players.filter(p => !p.left);
      if (pot > 0 && ficam.length) {
        const parte = Math.floor(pot / ficam.length);
        for (let k = 0; k < ficam.length; k++) await repo.adjustProfile(ficam[k].uid, parte + (k === 0 ? pot - parte * ficam.length : 0), 0, 0);
      }
    }
    await repo.deleteRoom(room.id); closed++;
  }
  return { closed };
}
