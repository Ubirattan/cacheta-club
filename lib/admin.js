// Painel administrativo: só quem tem is_admin = true no perfil
// E que entrou com o login e senha do painel (segunda proteção, conferida em toda ação).
import { relatorioJogos } from './relatorio.js';
import { GameError, getSettings, hashPass, checkPass } from './service.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { itemById, PACKS, WELCOME } from './shop-items.js';
import { vapid, getSubs, saveSubs, notifyAdmins } from './push.js';
import { resgatesPendentes, decidirResgate } from './shop.js';
import { createTournament, startTournament, cancelTournament } from './tournament.js';
const fail = (m, s) => { throw new GameError(m, s); };

const SETTING_KEYS = {
  daily_bonus: v => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0))),
  ads_enabled: v => !!v,
  modes_enabled: v => { const ok = (Array.isArray(v) ? v : []).filter(m => ['cacheta', 'dez', 'pifpaf'].includes(m)); if (!ok.length) fail('Deixe pelo menos uma modalidade ligada'); return ok; },
  max_entry: v => Math.max(0, Math.floor(Number(v) || 0)),
  motd: v => String(v || '').slice(0, 140),
  // anúncios próprios: imagem (link ou foto enviada), link de destino e texto; se revezam no lobby
  ads: v => (Array.isArray(v) ? v : []).slice(0, 10).map(a => {
    const img = String(a?.img || '').trim(), link = String(a?.link || '').trim(), text = String(a?.text || '').trim().slice(0, 80);
    if (img && !/^https:\/\//.test(img) && !/^data:image\/(jpeg|png|webp|gif);base64,/.test(img)) fail('A imagem do anúncio precisa ser um link https ou uma foto enviada');
    if (img.length > 400000) fail('A imagem do anúncio é grande demais');
    if (link && !/^(https:\/\/|http:\/\/)/.test(link)) fail('O link do anúncio precisa começar com https://');
    return { img, link: link.slice(0, 300), text, on: a?.on !== false };
  }).filter(a => a.img || a.text),
};

/* ---------- login do painel ---------- */
const SESSAO_MS = 12 * 3600 * 1000, MAX_ERROS = 5, TRAVA_MS = 15 * 60 * 1000;
const key = () => process.env.ADMIN_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only';
const b64 = s => Buffer.from(s).toString('base64url');
function makeToken(uid, passHash) {
  // a assinatura inclui a senha atual: trocar a senha derruba as sessões abertas
  const payload = b64(JSON.stringify({ uid, exp: Date.now() + SESSAO_MS }));
  const sig = createHmac('sha256', key()).update(payload + '|' + passHash).digest('base64url');
  return payload + '.' + sig;
}
function tokenOk(token, uid, passHash) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return false;
  const want = Buffer.from(createHmac('sha256', key()).update(payload + '|' + passHash).digest('base64url'));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try { const p = JSON.parse(Buffer.from(payload, 'base64url').toString()); return p.uid === uid && p.exp > Date.now(); } catch { return false; }
}
async function getAuth(repo) { const [a] = await repo.sel('admin_auth', { id: 1 }); return a || null; }
function validCreds(username, password) {
  const u = String(username || '').trim();
  if (u.length < 3) fail('O usuário precisa ter pelo menos 3 letras');
  if (String(password || '').length < 8) fail('A senha precisa ter pelo menos 8 caracteres');
  return u;
}

export async function adminOp(repo, user, b) {
  const me = await repo.getProfile(user.id);
  if (!me || !me.is_admin) fail('Só administradores', 403);
  const auth = await getAuth(repo);
  // operações de entrada (não exigem o token do painel)
  if (b.op === 'authStatus') return { configured: !!auth };
  if (b.op === 'setup') {
    if (auth) fail('O login do painel já foi criado. Use "Entrar".');
    const u = validCreds(b.username, b.password);
    const h = hashPass(String(b.password));
    await repo.ins('admin_auth', { id: 1, username: u, pass_hash: h });
    return { token: makeToken(user.id, h) };
  }
  if (b.op === 'login') {
    if (!auth) fail('Crie o login do painel primeiro');
    if (auth.locked_until && new Date(auth.locked_until).getTime() > Date.now()) {
      fail(`Muitas tentativas erradas. Tente de novo em ${Math.ceil((new Date(auth.locked_until).getTime() - Date.now()) / 60000)} min.`, 429);
    }
    const ok = String(b.username || '').trim().toLowerCase() === auth.username.toLowerCase() && checkPass(String(b.password || ''), auth.pass_hash);
    if (!ok) {
      const fails = (auth.fails || 0) + 1;
      await repo.upd('admin_auth', { id: 1 }, fails >= MAX_ERROS ? { fails: 0, locked_until: new Date(Date.now() + TRAVA_MS).toISOString() } : { fails });
      fail(fails >= MAX_ERROS ? 'Senha errada. Painel travado por 15 minutos.' : `Usuário ou senha errados (${MAX_ERROS - fails} tentativa${MAX_ERROS - fails === 1 ? '' : 's'} restante${MAX_ERROS - fails === 1 ? '' : 's'})`, 401);
    }
    await repo.upd('admin_auth', { id: 1 }, { fails: 0, locked_until: null });
    return { token: makeToken(user.id, auth.pass_hash) };
  }
  // daqui pra baixo: precisa estar logado no painel
  if (!auth || !tokenOk(b.adminToken, user.id, auth.pass_hash)) fail('PAINEL_LOGIN', 401);
  if (b.op === 'changePass') {
    if (!checkPass(String(b.current || ''), auth.pass_hash)) fail('A senha atual está errada');
    const u = validCreds(b.username || auth.username, b.password);
    const h = hashPass(String(b.password));
    await repo.upd('admin_auth', { id: 1 }, { username: u, pass_hash: h, updated_at: new Date().toISOString() });
    return { token: makeToken(user.id, h) };
  }
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
    case 'playerData': {
      if (!b.uid) fail('Jogador não informado');
      const [priv] = await repo.sel('user_private', { user_id: b.uid });
      const u = await repo.authUser(b.uid);
      return { email: u?.email || null, provider: u?.app_metadata?.provider || null, createdAt: u?.created_at || null,
        lastLogin: u?.last_sign_in_at || null, pixTipo: priv?.pix_tipo || null, pixChave: priv?.pix_chave || null };
    }
    case 'sales': {
      // vendas da loja: itens comprados com fichas e recargas de fichas por Pix já pagas
      const rows = (await repo.sel('purchases', {}, { order: ['created_at', false], limit: 300 }))
        .filter(x => !String(x.item).startsWith('admin-') && (x.status || 'done') === 'done').slice(0, 150);
      const ids = [...new Set(rows.map(x => x.user_id))], nick = {};
      for (const id of ids) { const p = await repo.getProfile(id); nick[id] = p ? (p.avatar || '') + ' ' + p.nickname : '(conta excluída)'; }
      const [seenRow] = await repo.sel('app_settings', { key: 'sales_seen' });
      const seen = seenRow ? new Date(seenRow.value).getTime() : 0;
      const when = x => new Date(x.paid_at || x.created_at).getTime();
      const nome = x => { const it = itemById(x.item); if (it) return it.name;
        if (x.item === WELCOME.id) return 'Pacote de boas-vindas'; if (String(x.item).startsWith('pack-') || x.item === 'custom') return 'Recarga de fichas'; return x.item; };
      const sales = rows.map(x => ({ id: x.id, at: new Date(when(x)).toISOString(), who: nick[x.user_id], uid: x.user_id, item: nome(x), resgate: String(x.item).startsWith('tr-'),
        coins: x.price_coins || 0, brl: x.price_brl != null ? Number(x.price_brl) : null, got: x.coins || 0, isNew: when(x) > seen }));
      return { sales, unread: sales.filter(x => x.isNew).length, pendentes: (await resgatesPendentes(repo)).length };
    }
    case 'pushKey': return { key: vapid().publicKey, count: (await getSubs(repo)).length };
    case 'pushSubscribe': {
      const sub = b.sub || {};
      if (!/^https:\/\//.test(String(sub.endpoint || '')) || !sub.keys?.p256dh || !sub.keys?.auth) fail('Inscrição inválida');
      const subs = (await getSubs(repo)).filter(s => s.endpoint !== sub.endpoint);
      subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: new Date().toISOString() });
      await saveSubs(repo, subs.slice(-10));
      return { ok: true, count: Math.min(subs.length, 10) };
    }
    case 'pushUnsubscribe': {
      const subs = await getSubs(repo);
      await saveSubs(repo, b.endpoint ? subs.filter(s => s.endpoint !== b.endpoint) : []);
      return { ok: true };
    }
    case 'pushTest': return { sent: await notifyAdmins(repo, '🔔 Casa de Jogos', 'Notificações de vendas ativadas neste aparelho!') };
    case 'resgates': {
      const rows = await resgatesPendentes(repo), out = [];
      for (const r of rows) { const p = await repo.getProfile(r.user_id); const it = itemById(r.item);
        out.push({ id: r.id, at: r.created_at, who: p ? (p.avatar || '') + ' ' + p.nickname : '(conta excluída)', item: it ? it.name : r.item, em: it?.em || '🏆', coins: Number(r.price_coins) || 0, ouro: r.item === 'tr-livre' }); }
      return { resgates: out };
    }
    case 'liberarResgate': return decidirResgate(repo, Number(b.id), true);
    case 'recusarResgate': return decidirResgate(repo, Number(b.id), false);
    case 'salesSeen': {
      const v = new Date().toISOString();
      const ex = await repo.sel('app_settings', { key: 'sales_seen' });
      if (ex.length) await repo.upd('app_settings', { key: 'sales_seen' }, { value: v }); else await repo.ins('app_settings', { key: 'sales_seen', value: v });
      return { ok: true };
    }
    case 'block': {
      if (b.uid === user.id) fail('Você não pode bloquear a si mesmo');
      await repo.upd('profiles', { id: b.uid }, { blocked: !!b.blocked }); return { ok: true };
    }
    case 'deleteUser': {
      if (!b.uid) fail('Jogador não informado');
      if (b.uid === user.id) fail('Você não pode excluir a si mesmo');
      const seats = await repo.sel('room_players', { user_id: b.uid });
      for (const sp of seats) {
        const [room] = await repo.sel('rooms', { id: sp.room_id });
        if (room && room.status === 'playing') fail('Esse jogador está numa partida agora. Feche a sala dele em "Salas" ou espere a partida acabar.');
      }
      await repo.deleteUser(b.uid);
      return { ok: true };
    }
    case 'coins': {
      const d = Math.floor(Number(b.delta) || 0); if (!d) fail('Informe quantas fichas');
      const r = await repo.adjustProfile(b.uid, d, 0, 0); if (r == null) fail('O saldo não pode ficar negativo');
      await repo.ins('purchases', { user_id: b.uid, item: d > 0 ? 'admin-credito' : 'admin-debito', price_coins: -d });
      return { ok: true, coins: r };
    }
    case 'relatorio': return relatorioJogos(repo, b.dias);
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
