// Camada do banco: tudo que o servidor lê/grava no Supabase (com a chave de serviço).
import { createClient } from '@supabase/supabase-js';

let admin = null;
export function adminClient() {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvozttyypufegzizvpnu.supabase.co', key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do Netlify');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

export const repo = {
  async getProfile(uid) {
    return must(await adminClient().from('profiles').select('*').eq('id', uid).maybeSingle());
  },
  async adjustProfile(uid, coins, games, wins, points = 0) {
    const { data, error } = await adminClient().rpc('adjust_profile', { p_uid: uid, p_coins: coins, p_games: games, p_wins: wins, p_points: points });
    if (error) throw error;
    return data == null || (Array.isArray(data) && !data.length) ? null : data;
  },
  async createRoom(row) {
    const { data, error } = await adminClient().from('rooms').insert(row).select().single();
    if (error) { if (error.code === '23505') return null; throw error; } // código repetido: tenta outro
    return data;
  },
  async getRoom(id) { return must(await adminClient().from('rooms').select('*').eq('id', id).maybeSingle()); },
  async getRoomByCode(code) { return must(await adminClient().from('rooms').select('*').eq('code', code).maybeSingle()); },
  async updateRoom(id, patch) { must(await adminClient().from('rooms').update(patch).eq('id', id)); },
  async transitionRoom(id, from, to) {
    const data = must(await adminClient().from('rooms').update({ status: to }).eq('id', id).eq('status', from).select('id'));
    return data.length === 1;
  },
  async deleteRoom(id) { must(await adminClient().from('rooms').delete().eq('id', id)); },
  async setRoomSecret(id, pass_hash) { must(await adminClient().from('room_secrets').upsert({ room_id: id, pass_hash })); },
  async getRoomSecret(id) {
    const d = must(await adminClient().from('room_secrets').select('pass_hash').eq('room_id', id).maybeSingle());
    return d ? d.pass_hash : '';
  },
  async listRoomPlayers(id) { return must(await adminClient().from('room_players').select('*').eq('room_id', id)); },
  async roomsOfUser(uid) { return must(await adminClient().from('room_players').select('room_id').eq('user_id', uid)).map(r => r.room_id); },
  async addRoomPlayer(row) {
    const { error } = await adminClient().from('room_players').insert(row);
    if (error) { if (error.code === '23505') return false; throw error; } // cadeira ocupada ao mesmo tempo
    return true;
  },
  async removeRoomPlayer(id, uid) { must(await adminClient().from('room_players').delete().eq('room_id', id).eq('user_id', uid)); },
  async updateRoomPlayer(id, uid, patch) { must(await adminClient().from('room_players').update(patch).eq('room_id', id).eq('user_id', uid)); },
  async resetReady(id) { must(await adminClient().from('room_players').update({ ready: false }).eq('room_id', id)); },

  // ---- consultas genéricas (etapa 3): where = { coluna: valor } ----
  async sel(table, where = {}, opt = {}) {
    let q = adminClient().from(table).select(opt.cols || '*');
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    if (opt.order) q = q.order(opt.order[0], { ascending: !!opt.order[1] });
    if (opt.limit) q = q.limit(opt.limit);
    return must(await q);
  },
  async ins(table, rows) { return must(await adminClient().from(table).insert(rows).select()); },
  async upd(table, where, patch) {
    let q = adminClient().from(table).update(patch);
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    return must(await q.select());
  },
  async del(table, where) {
    let q = adminClient().from(table).delete();
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    must(await q);
  },
  async searchProfiles(text, limit = 50) {
    let q = adminClient().from('profiles').select('*').order('created_at', { ascending: false }).limit(limit);
    if (text) q = q.ilike('nickname', `%${text}%`);
    return must(await q);
  },
  async count(table, where = {}) {
    let q = adminClient().from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const { count, error } = await q; if (error) throw error; return count || 0;
  },

  async getGame(id) {
    const d = must(await adminClient().from('game_secrets').select('version,state').eq('room_id', id).maybeSingle());
    return d ? { version: d.version, state: d.state } : null;
  },
  // grava só se ninguém gravou antes (controle de versão = sem jogada duplicada)
  async saveGame(id, state, prevVersion, publicState, hands) {
    const db = adminClient();
    let version;
    if (prevVersion == null) {
      const { error } = await db.from('game_secrets').insert({ room_id: id, version: 1, state });
      if (error) { if (error.code === '23505') return false; throw error; }
      version = 1;
    } else {
      version = prevVersion + 1;
      const data = must(await db.from('game_secrets').update({ version, state }).eq('room_id', id).eq('version', prevVersion).select('room_id'));
      if (data.length !== 1) return false;
    }
    must(await db.from('hands').delete().eq('room_id', id).not('user_id', 'in', `(${hands.map(h => h.uid).join(',')})`));
    must(await db.from('hands').upsert(hands.map(h => ({ room_id: id, user_id: h.uid, cards: h.cards }))));
    must(await db.from('games').upsert({ room_id: id, version, state: publicState, updated_at: new Date().toISOString() }));
    return true;
  },
};
