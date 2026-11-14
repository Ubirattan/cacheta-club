// Banco em memória que imita o Supabase (para testes)
export function memRepo() {
  const T = { gude_partidas: [], profiles: [], rooms: [], room_players: [], match_history: [], match_players: [], tournaments: [], tournament_players: [], tournament_tables: [], app_settings: [], purchases: [], admin_auth: [], messages: [], indicacoes: [], jogo_responsavel: [] };
  const secrets = new Map(), games = new Map(), pub = new Map(), hands = new Map();
  let seq = 0;
  const match = (r, w) => Object.entries(w).every(([k, v]) => r[k] === v);
  const clone = x => structuredClone(x);
  const repo = {
    T, games, pub, hands,
    async getProfile(u) { const p = T.profiles.find(p => p.id === u); return p ? clone(p) : null; },
    async adjustProfile(u, c, g, w, pts = 0) { const p = T.profiles.find(p => p.id === u); if (!p || p.coins + c < 0) return null; p.coins += c; p.games += g; p.wins += w; p.rank_points = (p.rank_points || 0) + pts; return p.coins; },
    async createRoom(r) { if (T.rooms.some(x => x.code === r.code)) return null; const room = { tournament_id: null, vip_only: false, ...r, id: 'r' + (++seq), created_at: new Date().toISOString() }; T.rooms.push(room); return clone(room); },
    async getRoom(i) { const r = T.rooms.find(r => r.id === i); return r ? clone(r) : null; },
    async getRoomByCode(c) { const r = T.rooms.find(r => r.code === c); return r ? clone(r) : null; },
    async updateRoom(i, p) { const r = T.rooms.find(r => r.id === i); if (r) Object.assign(r, p); },
    async transitionRoom(i, f, t) { const r = T.rooms.find(r => r.id === i); if (!r || r.status !== f) return false; r.status = t; return true; },
    async deleteRoom(i) { T.rooms = T.rooms.filter(r => r.id !== i); T.room_players = T.room_players.filter(x => x.room_id !== i); games.delete(i); },
    async setRoomSecret(i, h) { secrets.set(i, h); }, async getRoomSecret(i) { return secrets.get(i) || ''; },
    async listRoomPlayers(i) { return T.room_players.filter(x => x.room_id === i).map(clone); },
    async roomsOfUser(u) { return T.room_players.filter(x => x.user_id === u).map(x => x.room_id); },
    async addRoomPlayer(r) { if (T.room_players.some(x => x.room_id === r.room_id && (x.seat === r.seat || x.user_id === r.user_id))) return false; T.room_players.push({ ...r }); return true; },
    async removeRoomPlayer(i, u) { T.room_players = T.room_players.filter(x => !(x.room_id === i && x.user_id === u)); },
    async updateRoomPlayer(i, u, p) { const x = T.room_players.find(x => x.room_id === i && x.user_id === u); if (x) Object.assign(x, p); },
    async resetReady(i) { T.room_players.filter(x => x.room_id === i).forEach(x => x.ready = false); },
    async getPublicGame(i) { const g = games.get(i), p = pub.get(i); return g && p ? { version: g.version, state: clone(p) } : null; },
    async roomMessages(i, n = 60) { return T.messages.filter(m => m.room_id === i).sort((a, b) => a.id - b.id).slice(-n).map(clone); },
    async getGame(i) { const g = games.get(i); return g ? { version: g.version, state: clone(g.state) } : null; },
    async saveGame(i, st, pv, p, h) { const g = games.get(i); if (pv == null ? !!g : (!g || g.version !== pv)) return false; games.set(i, { version: (pv || 0) + 1, state: clone(st) }); pub.set(i, p); hands.set(i, h); return true; },
    async sel(t, w = {}, o = {}) { let r = T[t].filter(x => match(x, w)).map(clone); if (o.order) { const [k, asc] = o.order; r.sort((a, b) => (a[k] > b[k] ? 1 : -1) * (asc ? 1 : -1)); } return o.limit ? r.slice(0, o.limit) : r; },
    async ins(t, rows) { const arr = (Array.isArray(rows) ? rows : [rows]).map(r => ({ id: t === 'tournaments' ? 't' + (++seq) : ++seq, created_at: new Date().toISOString(), ...(t === 'tournaments' ? { status: 'open', round: 0, champion: null } : {}), ...(t === 'tournament_players' ? { status: 'in', round_reached: 0 } : {}), ...(t === 'tournament_tables' ? { done: false, winner: null } : {}), ...r })); T[t].push(...arr); return arr.map(clone); },
    async upd(t, w, p) { const r = T[t].filter(x => match(x, w)); r.forEach(x => Object.assign(x, clone(p))); return r.map(clone); },
    async deleteUser(uid) { T.profiles = T.profiles.filter(p => p.id !== uid); T.room_players = T.room_players.filter(x => x.user_id !== uid); },
    async selIn(t, col, vals) { return (T[t] || []).filter(x => vals.includes(x[col])).map(clone); },
    async ups(t, rows) { T[t] = T[t] || []; const out = []; for (const r of rows) { const ex = T[t].find(x => x.id === r.id); if (ex) Object.assign(ex, clone(r)); else T[t].push(clone(r)); out.push(clone(ex || r)); } return out; },
    async delAntes(t, w, col, val) { T[t] = T[t].filter(x => !(match(x, w) && x[col] < val)); },
    async del(t, w) { T[t] = T[t].filter(x => !match(x, w)); },
    async count(t, w = {}) { return T[t].filter(x => match(x, w)).length; },
    async authUser(uid) { const p = T.profiles.find(x => x.id === uid); return p ? { id: uid, email: p.email || null } : null; },
    async searchProfiles(q) { return T.profiles.filter(p => !q || p.nickname.toLowerCase().includes(q.toLowerCase())).map(clone); },
  };
  return repo;
}
export function addUsers(repo, n, coins = 1000) {
  const out = [];
  for (let i = 0; i < n; i++) { const u = { id: 'u' + i }; repo.T.profiles.push({ id: u.id, nickname: 'J' + i, avatar: '😎', coins, games: 0, wins: 0, rank_points: 0, blocked: false, is_admin: i === 0, owned: [], equipped: {}, vip_until: null, last_bonus: null }); out.push(u); }
  return out;
}
