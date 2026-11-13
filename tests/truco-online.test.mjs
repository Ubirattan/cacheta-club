// Truco online: 1x1 e duplas, cartas escondidas, tempo esgotado, prêmio dividido nas duplas
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as SV from '../lib/service.js';
import { botMove, needs, teamOf } from '../lib/truco.js';
import { trucoTick } from '../lib/truco-service.js';

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
for (const [mode, n] of [['truco-1x1', 2], ['truco-duplas', 4]]) {
  const R = memRepo(); const us = addUsers(R, n, 50);
  await assert.rejects(SV.createRoom(R, us[0], { mode, entry: 1, turnSeconds: 30 }), /mínima é 2/);
  const room = await SV.createRoom(R, us[0], { mode, entry: 20, turnSeconds: 30 });
  for (const u of us.slice(1)) await SV.joinRoom(R, u, { id: room.id });
  // não começa sem a mesa cheia
  if (n === 4) { const R2 = memRepo(); const v = addUsers(R2, 3, 50); const r2 = await SV.createRoom(R2, v[0], { mode, entry: 2, turnSeconds: 30 }); await SV.joinRoom(R2, v[1], { id: r2.id }); await SV.setReady(R2, v[0], r2.id, true); await SV.setReady(R2, v[1], r2.id, true); assert.ok(!R2.games.get(r2.id), 'duplas não começa com 2'); }
  for (const u of us) await SV.setReady(R, u, room.id, true);
  for (const u of us) assert.equal(coins(R, u), 30);
  let g = await R.getGame(room.id);
  assert.ok(!JSON.stringify(g.pub || {}).includes('"hand"'), 'estado público sem as mãos');
  let k = 0;
  while (g.state.phase !== 'over' && k++ < 3000) {
    const M = g.state, nd = needs(M);
    if (nd.kind === 'vaza' || nd.kind === 'hand' || (k % 37 === 0)) { const st = R.games.get(room.id).state; st.nextAt = 1; if (k % 37 === 0 && nd.kind !== "vaza" && nd.kind !== "hand") st.deadline = 1; await SV.tick(R, null, room.id); g = await R.getGame(room.id); continue; }
    const pi = nd.kind === 'onze' ? M.players.findIndex((p, i) => teamOf(i) === nd.team) : nd.pi;
    const mv = botMove(M, pi, 'medio'); const u = us.find(x => x.id === M.players[pi].uid);
    await SV.act(R, u, room.id, mv.type === 'play' ? { type: 'play', id: mv.id } : mv);
    g = await R.getGame(room.id);
  }
  assert.equal(g.state.phase, 'over', mode + ': terminou');
  const t = g.state.over.team, win = us.filter(u => teamOf(g.state.players.findIndex(p => p.uid === u.id)) === t);
  const each = n === 2 ? 36 : 36;   // pote 40 (1x1) → 36 · pote 80 (duplas) → 72 / 2 = 36
  for (const u of us) assert.equal(coins(R, u), win.includes(u) ? 30 + each : 30, 'prêmio certo');
  console.log(`${mode}: ${g.state.score.join(' x ')}, cada vencedor recebeu ${each}`);
}
console.log('truco online ok');
