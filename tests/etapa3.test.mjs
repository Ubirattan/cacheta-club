// Etapa 3: torneio ponta a ponta, histórico, ranking, loja, bônus e painel admin.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as S from '../lib/service.js';
import * as TT from '../lib/tournament.js';
import { buy, equip, dailyBonus, resgatarLivre } from '../lib/shop.js';
import { adminOp as adminOpRaw } from '../lib/admin.js';
// faz login no painel (cria o login na primeira vez) antes de cada operação
const tokens = new WeakMap();
async function adminOp(R, u, b) {
  if (['authStatus', 'setup', 'login'].includes(b.op)) return adminOpRaw(R, u, b);
  const me = await R.getProfile(u.id); if (!me || !me.is_admin) return adminOpRaw(R, u, b);
  if (!tokens.get(R)) { const st = await adminOpRaw(R, u, { op: 'authStatus' }); tokens.set(R, (await adminOpRaw(R, u, { op: st.configured ? 'login' : 'setup', username: 'admin', password: 'senha-teste-123' })).token); }
  return adminOpRaw(R, u, { ...b, adminToken: tokens.get(R) });
}
import { AI } from '../lib/engine.js';

async function playAllTables(R) {
  // joga todas as mesas abertas até não sobrar partida em andamento
  for (let guard = 0; guard < 50000; guard++) {
    const live = R.T.rooms.filter(r => r.status === 'playing');
    if (!live.length) return;
    for (const room of live) {
      const g = await R.getGame(room.id); if (!g) continue;
      const M = g.state;
      if (M.over) { R.games.get(room.id).state.endedAt = Date.now() - 60000; await S.tick(R, null, room.id); continue; }
      if (M.phase === 'decide') {
        for (let k = 0; k < M.players.length; k++) { const q = M.players[k]; if (q.fichas > 0 && !q.dec) { await S.act(R, { id: q.uid }, room.id, { type: 'decide', go: AI.chooseGo(M, k, 'medio') }); break; } }
        continue;
      }
      const pi = M.turn, u = { id: M.players[pi].uid };
      await S.act(R, u, room.id, { type: 'draw', from: AI.chooseDraw(M, pi, 'medio') });
      const M2 = (await R.getGame(room.id)).state; if (M2.over) continue;
      await S.act(R, u, room.id, AI.chooseEnd(M2, pi, 'medio'));
    }
  }
  throw new Error('torneio não terminou');
}

for (const [n, size] of [[9, 4], [5, 2], [2, 9], [13, 3]]) {
  const R = memRepo(); const U = addUsers(R, n);
  const admin = U[0];
  await assert.rejects(adminOp(R, U[1], { op: 'stats' }), /administradores/);
  const { tournament: t } = await adminOp(R, admin, { op: 'createTournament', name: 'Copa Teste', mode: 'cacheta', tableSize: size, entry: 50, prize: 1000, maxPlayers: 40, points: 3 });
  for (const u of U) await TT.joinTournament(R, u, t.id);
  await TT.leaveTournament(R, U[n - 1], t.id); await TT.joinTournament(R, U[n - 1], t.id); // sai e volta
  assert.equal(R.T.profiles[1].coins, 950, 'inscrição cobrada uma vez');
  await adminOp(R, admin, { op: 'startTournament', id: t.id });
  await assert.rejects(TT.joinTournament(R, { id: 'x' }, t.id), /fecharam/);
  await playAllTables(R);
  const [fin] = await R.sel('tournaments', { id: t.id });
  assert.equal(fin.status, 'finished');
  assert.ok(fin.champion, 'tem campeão');
  const champ = R.T.profiles.find(p => p.id === fin.champion);
  assert.equal(champ.coins, 950 + 50 * n + 1000, 'campeão leva inscrições + prêmio da casa');
  const total = R.T.profiles.reduce((s, p) => s + p.coins, 0);
  assert.equal(total, 1000 * n + 1000, 'nenhuma ficha sumiu');
  const tables = await R.sel('tournament_tables', { tournament_id: t.id });
  const rounds = Math.max(...tables.map(x => x.round));
  assert.equal(R.T.tournament_players.filter(p => p.status === 'champion').length, 1);
  assert.equal(R.T.tournament_players.filter(p => p.status === 'out').length, n - 1);
  assert.ok(R.T.match_history.length >= tables.filter(x => x.players.length > 1).length, 'histórico das mesas');
  assert.ok(champ.rank_points >= 50, 'pontos de ranking do campeão');
  console.log(`OK — torneio ${n} jogadores, mesas de ${size}: ${rounds} rodadas, ${tables.length} mesas, campeão ${champ.nickname} (${champ.coins} fichas)`);
}

// partida normal grava histórico e ranking
{
  const R = memRepo(); const U = addUsers(R, 3);
  const { id } = await S.createRoom(R, U[0], { mode: 'cacheta', maxPlayers: 3, points: 3, entry: 100, turnSeconds: 30 });
  for (const u of U.slice(1)) await S.joinRoom(R, u, { id });
  for (const u of U) await S.setReady(R, u, id, true);
  await playAllTables(R);
  assert.equal(R.T.match_history.length, 1);
  const h = R.T.match_history[0];
  const mp = R.T.match_players;
  assert.equal(mp.length, 3); assert.equal(mp.filter(x => x.won).length, 1);
  assert.equal(mp.find(x => x.won).coins_delta, 200); assert.equal(mp.filter(x => !x.won)[0].coins_delta, -100);
  const w = R.T.profiles.find(p => p.id === h.winner); assert.equal(w.rank_points, 10);
  console.log('OK — histórico e ranking de partida normal');
}

// loja, VIP, bônus, salas VIP, admin
{
  const R = memRepo(); const U = addUsers(R, 3, 40);
  await buy(R, U[1], 'back-roxo');
  await assert.rejects(buy(R, U[1], 'back-roxo'), /já tem/);
  let p = await R.getProfile('u1'); assert.equal(p.coins, 30); assert.equal(p.equipped.back, 'back-roxo');
  await assert.rejects(equip(R, U[1], 'felt-azul'), /Compre/);
  await assert.rejects(equip(R, U[1], 'felt-noite'), /VIP/);
  await assert.rejects(S.createRoom(R, U[1], { mode: 'cacheta', maxPlayers: 2, points: 3, entry: 1, vipOnly: true }), /VIP/);
  await buy(R, U[1], 'vip-30');
  p = await R.getProfile('u1'); assert.equal(p.coins, 0); assert.ok(new Date(p.vip_until) > new Date());
  await equip(R, U[1], 'felt-noite');
  await assert.rejects(buy(R, U[1], 'felt-azul'), /insuficientes/);
  await assert.rejects(dailyBonus(R, U[1]), /Não há bônus/, 'sem bônus grátis por padrão');
  R.T.app_settings.push({ key: 'daily_bonus', value: '20' });
  const b = await dailyBonus(R, U[1]); assert.equal(b.amount, 40, 'VIP ganha bônus em dobro');
  await assert.rejects(dailyBonus(R, U[1]), /já pegou/);
  const vr = await S.createRoom(R, U[1], { mode: 'cacheta', maxPlayers: 2, points: 3, entry: 1, vipOnly: true });
  await assert.rejects(S.joinRoom(R, U[2], { id: vr.id }), /VIP/);
  // admin
  const st = await adminOp(R, U[0], { op: 'stats' }); assert.equal(st.users, 3);
  await adminOp(R, U[0], { op: 'block', uid: 'u2', blocked: true });
  await assert.rejects(S.createRoom(R, U[2], { mode: 'cacheta', maxPlayers: 2, points: 3 }), /bloqueada/);
  await adminOp(R, U[0], { op: 'coins', uid: 'u2', delta: 250 });
  assert.equal((await R.getProfile('u2')).coins, 290);
  await assert.rejects(adminOp(R, U[0], { op: 'coins', uid: 'u2', delta: -99999 }), /negativo/);
  await adminOp(R, U[0], { op: 'saveSettings', settings: { daily_bonus: 500, modes_enabled: ['cacheta'], hack: 1 } });
  const cfg = (await adminOp(R, U[0], { op: 'settings' })).settings;
  assert.equal(cfg.daily_bonus, 500); assert.deepEqual(cfg.modes_enabled, ['cacheta']); assert.equal(cfg.hack, undefined);
  await assert.rejects(S.createRoom(R, U[0], { mode: 'pifpaf', maxPlayers: 2, points: 3 }), /indisponível/);
  // anúncios próprios: guarda imagem/link/texto, descarta vazios e recusa link ou imagem estranhos
  await adminOp(R, U[0], { op: 'saveSettings', settings: { ads: [{ img: 'https://x.com/a.png', link: 'https://wa.me/55', text: 'Promo' }, { img: '', text: '' }] } });
  assert.deepEqual((await adminOp(R, U[0], { op: 'settings' })).settings.ads, [{ img: 'https://x.com/a.png', link: 'https://wa.me/55', text: 'Promo', on: true }]);
  await assert.rejects(adminOp(R, U[0], { op: 'saveSettings', settings: { ads: [{ img: 'javascript:alert(1)' }] } }), /imagem/);
  await assert.rejects(adminOp(R, U[0], { op: 'saveSettings', settings: { ads: [{ text: 'a', link: 'javascript:alert(1)' }] } }), /link/);
  // vendas no painel: compras aparecem como novas até o admin abrir a aba
  let sv = await adminOp(R, U[0], { op: 'sales' });
  assert.ok(sv.sales.some(x => x.item === 'Verso roxo neon' && x.coins === 10 && x.isNew)); assert.equal(sv.unread, 2);
  assert.ok(!sv.sales.some(x => /admin/.test(x.item)), 'ajuste do admin não é venda');
  await adminOp(R, U[0], { op: 'salesSeen' });
  assert.equal((await adminOp(R, U[0], { op: 'sales' })).unread, 0);
  console.log('OK — loja, VIP, bônus diário, salas VIP e painel admin');
}

// torneio com início marcado e com menos de 2 inscritos é cancelado e devolve
{
  const R = memRepo(); const U = addUsers(R, 2);
  const t = await TT.createTournament(R, U[0], { name: 'Madrugada', mode: 'cacheta', tableSize: 4, entry: 100, startsAt: new Date(Date.now() - 1000).toISOString() });
  await TT.joinTournament(R, U[1], t.id);
  await TT.tournamentsTick(R);
  assert.equal((await R.sel('tournaments', { id: t.id }))[0].status, 'canceled');
  assert.equal((await R.getProfile('u1')).coins, 1000, 'inscrição devolvida');
  console.log('OK — torneio sem jogadores suficientes é cancelado e devolve as fichas');
}

// resgate de fichas por troféu: fichas saem na hora, troféu só depois que o admin libera
{
  const R = memRepo(); const U = addUsers(R, 2, 120);
  R.T.profiles.find(x => x.id === 'u0').is_admin = true;
  const av0 = (await R.getProfile('u1')).avatar;
  // troféus antigos e avatares pagos saíram da venda
  await assert.rejects(buy(R, U[1], 'tr-prata'), /indisponível/); await assert.rejects(buy(R, U[1], 'av-fogo'), /indisponível/);
  const r = await resgatarLivre(R, U[1], 100); assert.ok(r.pending);
  let p = await R.getProfile('u1');
  assert.equal(p.coins, 20); assert.ok(!(p.owned || []).includes('tr-livre'), 'ainda não liberado'); assert.equal(p.avatar, av0);
  await assert.rejects(resgatarLivre(R, U[1], 100), /insuficientes/); // pode pedir de novo, mas aqui falta ficha
  await assert.rejects(resgatarLivre(R, U[1], 150), /insuficientes/);
  const A = (op, b = {}) => adminOp(R, U[0], { op, ...b });
  let lst = (await A('resgates')).resgates; assert.equal(lst.length, 1); assert.equal(lst[0].item, 'Troféu de Ouro');
  assert.equal((await A('sales')).pendentes, 1);
  await A('liberarResgate', { id: lst[0].id });
  p = await R.getProfile('u1'); assert.ok(p.owned.includes('tr-livre')); assert.equal(p.coins, 20);
  await assert.rejects(A('liberarResgate', { id: lst[0].id }), /resolvido/);
  // troféu acumula: com fichas, resgata o mesmo de novo
  await R.adjustProfile('u1', 100, 0, 0);
  const r2 = await resgatarLivre(R, U[1], 100); assert.ok(r2.pending); assert.equal((await R.getProfile('u1')).coins, 20);
  lst = (await A('resgates')).resgates; assert.equal(lst.length, 1); await A('liberarResgate', { id: lst[0].id });
  // recusar devolve as fichas
  await A('coins', { uid: 'u1', delta: 30 });
  await resgatarLivre(R, U[1], 50); assert.equal((await R.getProfile('u1')).coins, 0);
  lst = (await A('resgates')).resgates; await A('recusarResgate', { id: lst[0].id });
  p = await R.getProfile('u1'); assert.equal(p.coins, 50);
  assert.equal((await A('resgates')).resgates.length, 0);
  console.log('OK — resgate de troféu: pedido pendente, admin libera ou recusa (devolve fichas)');
  // resgate livre: digita o valor, vira Troféu de Ouro com esse valor no painel
  await R.adjustProfile('u1', 0.5, 0, 0);
  await assert.rejects(resgatarLivre(R, U[1], '0,5'), /a partir/);
  await assert.rejects(resgatarLivre(R, U[1], 'abc'), /a partir/);
  await assert.rejects(resgatarLivre(R, U[1], 60), /insuficientes/);
  await assert.rejects(resgatarLivre(R, U[1], '37,5'), /inteiro/);
  const rl = await resgatarLivre(R, U[1], '37'); assert.equal(rl.valor, 37);
  assert.equal((await R.getProfile('u1')).coins, 13.5);
  await assert.rejects(buy(R, U[1], 'tr-livre'), /indisponível/, 'não sai pela loja');
  lst = (await A('resgates')).resgates; assert.equal(lst.length, 1);
  assert.equal(lst[0].item, 'Troféu de Ouro'); assert.equal(lst[0].coins, 37); assert.ok(lst[0].ouro);
  await A('liberarResgate', { id: lst[0].id });
  assert.ok((await R.getProfile('u1')).owned.includes('tr-livre'));
  console.log('OK — resgate livre: Troféu de Ouro com o valor digitado');
}
