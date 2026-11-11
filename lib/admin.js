// Painel administrativo: só quem tem is_admin = true no perfil.
import { GameError, getSettings } from './service.js';
import { createTournament, startTournament, cancelTournament } from './tournament.js';
const fail = (m, s) => { throw new GameError(m, s); };

const SETTING_KEYS = {
  daily_bonus: v => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0))),
  ads_enabled: v => !!v,
  modes_enabled: v => { const ok = (Array.isArray(v) ? v : []).filter(m => ['cacheta', 'dez', 'pifpaf'].includes(m)); if (!ok.length) fail('Deixe pelo menos uma modalidade ligada'); return ok; },
  max_entry: v => Math.max(0, Math.floor(Number(v) || 0)),
  motd: v => String(v || '').slice(0, 140),
};

export async function adminOp(repo, user, b) {
  const me = await repo.getProfile(user.id);
  if (!me || !me.is_admin) fail('Só administradores', 403);
  switch (b.op) {
    case 'stats': {
      const [users, rWait, rPlay, tOpen, tRun] = await Promise.all([
        repo.count('profiles'), repo.count('rooms', { status: 'waiting' }), repo.count('rooms', { status: 'playing' }),
        repo.count('tournaments', { status: 'open' }), repo.count('tournaments', { status: 'running' })]);
      const recent = await repo.sel('match_history', {}, { order: ['created_at', false], limit: 500 });
      const day = Date.now() - 86400000;
      const today = recent.filter(m => new Date(m.created_at).getTime() > day);
      const rich = await repo.sel('profiles', {}, { order: ['coins', false], limit: 5 });
      return { users, roomsWaiting: rWait, roomsPlaying: rPlay, tournamentsOpen: tOpen, tournamentsRunning: tRun,
        matchesToday: today.length, potToday: today.reduce((s, m) => s + (m.pot || 0), 0), matchesTotal: await repo.count('match_history'),
        rich: rich.map(p => ({ nickname: p.nickname, coins: p.coins })) };
    }
    case 'players': return { players: (await repo.searchProfiles(String(b.q || '').trim())).map(p => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, coins: p.coins, games: p.games, wins: p.wins, blocked: p.blocked, is_admin: p.is_admin, vip_until: p.vip_until, created_at: p.created_at })) };
    case 'block': {
      if (b.uid === user.id) fail('Você não pode bloquear a si mesmo');
      await repo.upd('profiles', { id: b.uid }, { blocked: !!b.blocked }); return { ok: true };
    }
    case 'coins': {
      const d = Math.floor(Number(b.delta) || 0); if (!d) fail('Informe quantas fichas');
      const r = await repo.adjustProfile(b.uid, d, 0, 0); if (r == null) fail('O saldo não pode ficar negativo');
      await repo.ins('purchases', { user_id: b.uid, item: d > 0 ? 'admin-credito' : 'admin-debito', price_coins: -d });
      return { ok: true, coins: r };
    }
    case 'matches': return { matches: await repo.sel('match_history', {}, { order: ['created_at', false], limit: 100 }) };
    case 'rooms': return { rooms: await repo.sel('rooms', {}, { order: ['created_at', false], limit: 100 }) };
    case 'closeRoom': await repo.deleteRoom(b.roomId); return { ok: true };
    case 'createTournament': return { tournament: await createTournament(repo, user, b) };
    case 'startTournament': return startTournament(repo, b.id);
    case 'cancelTournament': return cancelTournament(repo, b.id);
    case 'settings': return { settings: await getSettings(repo) };
    case 'saveSettings': {
      for (const [k, v] of Object.entries(b.settings || {})) {
        if (!SETTING_KEYS[k]) continue;
        const val = SETTING_KEYS[k](v);
        const ex = await repo.sel('app_settings', { key: k });
        if (ex.length) await repo.upd('app_settings', { key: k }, { value: val }); else await repo.ins('app_settings', { key: k, value: val });
      }
      return { settings: await getSettings(repo) };
    }
    default: fail('Operação desconhecida');
  }
}
