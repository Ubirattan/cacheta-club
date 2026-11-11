// Teste do servidor com um banco em memória: salas, senha, início automático,
// jogadas validadas, cronômetro, saída no meio e pagamento do pote.
import * as S from '../lib/service.js';
import { Engine, AI } from '../lib/engine.js';
import assert from 'node:assert/strict';

function memRepo() {
  const db = { profiles: new Map(), rooms: new Map(), secrets: new Map(), rp: [], games: new Map(), pub: new Map(), hands: new Map() };
  let id = 0;
  return { db,
    async sel() { return []; }, async ins(t, r) { return [{ id: 1, ...r }]; },
    async getProfile(u) { return db.profiles.get(u) || null; },
    async adjustProfile(u, c, g, w) { const p = db.profiles.get(u); if (p.coins + c < 0) return null; p.coins += c; p.games += g; p.wins += w; return p.coins; },
    async createRoom(r) { if ([...db.rooms.values()].some(x => x.code === r.code)) return null; const room = { ...r, id: 'r' + (++id) }; db.rooms.set(room.id, room); return room; },
    async getRoom(i) { return db.rooms.get(i) || null; },
    async getRoomByCode(c) { return [...db.rooms.values()].find(r => r.code === c) || null; },
    async updateRoom(i, p) { Object.assign(db.rooms.get(i), p); },
    async transitionRoom(i, f, t) { const r = db.rooms.get(i); if (r.status !== f) return false; r.status = t; return true; },
    async deleteRoom(i) { db.rooms.delete(i); db.rp = db.rp.filter(x => x.room_id !== i); db.games.delete(i); },
    async setRoomSecret(i, h) { db.secrets.set(i, h); },
    async getRoomSecret(i) { return db.secrets.get(i) || ''; },
    async listRoomPlayers(i) { return db.rp.filter(x => x.room_id === i).map(x => ({ ...x })); },
    async roomsOfUser(u) { return db.rp.filter(x => x.user_id === u).map(x => x.room_id); },
    async addRoomPlayer(r) { if (db.rp.some(x => x.room_id === r.room_id && (x.seat === r.seat || x.user_id === r.user_id))) return false; db.rp.push({ ...r }); return true; },
    async removeRoomPlayer(i, u) { db.rp = db.rp.filter(x => !(x.room_id === i && x.user_id === u)); },
    async updateRoomPlayer(i, u, p) { Object.assign(db.rp.find(x => x.room_id === i && x.user_id === u), p); },
    async resetReady(i) { db.rp.filter(x => x.room_id === i).forEach(x => x.ready = false); },
    async getGame(i) { const g = db.games.get(i); return g ? { version: g.version, state: structuredClone(g.state) } : null; },
    async saveGame(i, st, pv, pub, hands) {
      const g = db.games.get(i);
      if (pv == null ? !!g : (!g || g.version !== pv)) return false;
      db.games.set(i, { version: (pv || 0) + 1, state: structuredClone(st) }); db.pub.set(i, pub); db.hands.set(i, hands); return true;
    },
  };
}
const R = memRepo();
const users = Array.from({ length: 9 }, (_, i) => ({ id: 'u' + i }));
users.forEach((u, i) => R.db.profiles.set(u.id, { id: u.id, nickname: 'J' + i, avatar: '😎', coins: 1000, games: 0, wins: 0, blocked: false }));

// sala privada com senha, 9 lugares, entrada 100
const { id: room, code } = await S.createRoom(R, users[0], { name: 'Teste', mode: 'cacheta', maxPlayers: 9, points: 3, entry: 100, turnSeconds: 30, isPrivate: true, password: 'abc' });
await assert.rejects(S.joinRoom(R, users[1], { code }, 'errada'), /Senha errada/);
for (let i = 1; i < 9; i++) await S.joinRoom(R, users[i], { code }, 'abc');
const extra = { id: 'x' }; R.db.profiles.set('x', { id: 'x', nickname: 'X', avatar: '😎', coins: 1000, games: 0, wins: 0 });
await assert.rejects(S.joinRoom(R, extra, { code }, 'abc'), /Sala cheia/);
assert.equal((await R.listRoomPlayers(room)).length, 9);
assert.equal(R.db.secrets.get(room).includes('abc'), false, 'senha não pode ficar em texto puro');

// só começa quando todos estão prontos
for (let i = 0; i < 8; i++) assert.equal((await S.setReady(R, users[i], room, true)).started, false);
assert.equal((await S.setReady(R, users[8], room, true)).started, true);
assert.equal(R.db.rooms.get(room).status, 'playing');
assert.equal(R.db.profiles.get('u3').coins, 900, 'entrada cobrada');
await assert.rejects(S.joinRoom(R, extra, { code }, 'abc'), /já está jogando/);

// estado público não pode vazar cartas
const pub = R.db.pub.get(room);
assert.ok(pub.players.every(p => !('hand' in p) && typeof p.count === 'number'), 'estado público sem as cartas dos jogadores');
assert.equal(typeof pub.monte, 'number');

// jogadas inválidas são barradas pelo servidor
let M = (await R.getGame(room)).state;
const notTurn = users.find(u => u.id !== M.players[M.turn].uid);
await assert.rejects(S.act(R, notTurn, room, { type: 'draw', from: 'monte' }), /Não é a sua vez/);
const cur = users.find(u => u.id === M.players[M.turn].uid);
await assert.rejects(S.act(R, cur, room, { type: 'discard', cardId: M.players[M.turn].hand[0].id }), /Compre uma carta/);

// alguém sai no meio: perde, e a vez passa
await S.leaveRoom(R, users[8], room);
M = (await R.getGame(room)).state;
assert.equal(M.players[8].fichas, 0); assert.equal(M.players[8].left, true);

// cronômetro: força o prazo vencido e chama tick
{ const g = R.db.games.get(room); g.state.deadline = Date.now() - 5000; }
const before = (await R.getGame(room)).state.turn;
assert.equal((await S.tick(R, users[0], room)).changed, true);
{ const st = (await R.getGame(room)).state; assert.ok(st.over || st.turn !== before, 'jogada automática passou a vez (ou bateu)'); }

// joga a partida até o fim, com IA no lugar dos jogadores e ticks entre rodadas
let steps = 0, rounds = 1;
while (R.db.rooms.get(room).status === 'playing' && steps < 20000) {
  steps++;
  M = (await R.getGame(room)).state;
  if (M.over) { R.db.games.get(room).state.endedAt = Date.now() - 60000; await S.tick(R, users[0], room); rounds++; continue; }
  const pi = M.turn, u = { id: M.players[pi].uid };
  await S.act(R, u, room, { type: 'draw', from: AI.chooseDraw(M, pi, 'medio') });
  M = (await R.getGame(room)).state; if (M.over) continue;
  const a = AI.chooseEnd(M, pi, 'medio');
  await S.act(R, u, room, a);
}
M = (await R.getGame(room)).state;
assert.equal(R.db.rooms.get(room).status, 'waiting', 'sala volta a esperar');
assert.ok(R.db.rp.every(x => !x.ready), 'prontos zerados');
const champ = M.players[M.result.champion].uid;
const totalCoins = [...R.db.profiles.values()].reduce((s, p) => s + p.coins, 0);
assert.equal(totalCoins, 10000, 'fichas conservadas: o pote foi todo para o campeão');
assert.equal(R.db.profiles.get(champ).wins, 1);
console.log(`OK — partida online com 9 jogadores: ${rounds} rodadas, ${steps} jogadas, campeão ${champ} com ${R.db.profiles.get(champ).coins} fichas`);

// sala de quem sai sozinho é apagada
await S.leaveRoom(R, users[0], room); for (let i = 1; i < 8; i++) await S.leaveRoom(R, users[i], room);
assert.equal(R.db.rooms.has(room), false);
console.log('OK — sala vazia apagada');
