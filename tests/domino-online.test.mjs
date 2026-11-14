// Dominó online (duplas): mesa cheia, pedras escondidas, passe e tempo automáticos, prêmio dividido, quem sai perde.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as SV from '../lib/service.js';
import { jogadaBot, precisa, dupla } from '../lib/domino.js';
import { premioPorVencedor } from '../lib/taxa.js';

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
const R = memRepo(); const us = addUsers(R, 4, 50);
await assert.rejects(SV.createRoom(R, us[0], { mode: 'domino-duplas', entry: 1, turnSeconds: 30 }), /mínima é 2/);
const room = await SV.createRoom(R, us[0], { mode: 'domino-duplas', entry: 20, turnSeconds: 30 });
for (const u of us.slice(1, 3)) await SV.joinRoom(R, u, { id: room.id });
for (const u of us.slice(0, 3)) await SV.setReady(R, u, room.id, true);
assert.ok(!R.games.get(room.id), 'não começa com 3');
await SV.joinRoom(R, us[3], { id: room.id }); await SV.setReady(R, us[3], room.id, true);
for (const u of us) assert.equal(coins(R, u), 30);
let g = await R.getGame(room.id);
assert.ok(!JSON.stringify(R.pub.get(room.id)).includes('"mao":['), 'estado público sem as pedras durante a mão');
assert.equal(R.hands.get(room.id).length, 4); assert.equal(R.hands.get(room.id)[0].cards.length, 7);
let k = 0, passouSozinho = 0, porTempo = 0;
while (g.state.fase !== 'fim' && k++ < 5000) {
  const M = g.state, nd = precisa(M);
  const st = R.games.get(room.id).state;
  if (nd.kind === 'mao' || nd.kind === 'passar') { st.nextAt = 1; const r = await SV.tick(R, null, room.id); if (nd.kind === 'passar' && r.changed) passouSozinho++; g = await R.getGame(room.id); continue; }
  if (k % 29 === 0) { st.deadline = 1; await SV.tick(R, null, room.id); porTempo++; g = await R.getGame(room.id); continue; }
  const mv = jogadaBot(M, nd.pi, 'medio'); const u = us.find(x => x.id === M.players[nd.pi].uid);
  await SV.act(R, u, room.id, mv);
  g = await R.getGame(room.id);
}
assert.equal(g.state.fase, 'fim', 'terminou'); assert.ok(porTempo > 0);
const t = g.state.over.dupla, take = premioPorVencedor(20, 4, 2);
for (const [i, p] of g.state.players.entries()) { const u = us.find(x => x.id === p.uid); assert.equal(coins(R, u), dupla(i) === t ? 30 + take : 30); }
assert.equal((await R.getRoom(room.id)).status, 'waiting');
// quem sai no meio: a dupla dele perde
for (const u of us) await SV.setReady(R, u, room.id, true);
g = await R.getGame(room.id); assert.equal(g.state.fase, 'jogo');
await SV.leaveRoom(R, us[1], room.id);
g = await R.getGame(room.id);
assert.equal(g.state.fase, 'fim'); assert.equal(g.state.over.dupla, 1 - dupla(g.state.players.findIndex(p => p.uid === us[1].id)));
console.log('OK — dominó online: mesa cheia, pedras escondidas, passe/tempo automáticos, prêmio e desistência');
