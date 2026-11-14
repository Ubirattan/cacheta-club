// Bingo online: sala de 2 a 10, cartela 5 a 200, até 3 cartelas, cobra por cartela, sorteio e prêmio com taxa da casa.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as SV from '../lib/service.js';
import { novaCartela, numeros, premioBingo, taxaBingo, cheia } from '../lib/bingo.js';

const c = novaCartela();
assert.equal(numeros(c).length, 24); assert.equal(c.linhas[2][2], 0);
c.linhas.forEach(l => l.forEach((n, col) => { if (n) assert.ok(n > col * 15 && n <= col * 15 + 15, 'coluna certa'); }));
assert.equal(new Set(numeros(c)).size, 24);
assert.equal(taxaBingo(100), 10); assert.equal(premioBingo(100), 90); assert.equal(taxaBingo(101), 20); assert.equal(premioBingo(150), 120);

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
const R = memRepo(); const us = addUsers(R, 3, 200);
await assert.rejects(SV.createRoom(R, us[0], { mode: 'bingo', entry: 2, maxPlayers: 3, turnSeconds: 30 }), /5 a 200/);
await assert.rejects(SV.createRoom(R, us[0], { mode: 'bingo', entry: 10, maxPlayers: 11, turnSeconds: 30 }), /2 a 10/);
const room = await SV.createRoom(R, us[0], { mode: 'bingo', entry: 20, maxPlayers: 10, turnSeconds: 30 });
for (const u of us.slice(1)) await SV.joinRoom(R, u, { id: room.id });
await assert.rejects(SV.setReady(R, us[0], room.id, true), /pelo menos 1 cartela/);
const quero = [3, 1, 2];
for (const [i, u] of us.entries()) {
  let r = await SV.act(R, u, room.id, { type: 'cartelas' });
  const ops = r.state.escolhas[u.id].opcoes; assert.equal(ops.length, 6);
  for (let k = 0; k < quero[i]; k++) r = await SV.act(R, u, room.id, { type: 'escolher', id: ops[k].id });
  if (i === 0) { await assert.rejects(SV.act(R, u, room.id, { type: 'escolher', id: ops[4].id }), /No máximo 3/);
    const antes = r.state.escolhas[u.id].opcoes.map(x => x.id); r = await SV.act(R, u, room.id, { type: 'trocar' });
    const depois = r.state.escolhas[u.id].opcoes.map(x => x.id);
    assert.deepEqual(depois.slice(0, 3), antes.slice(0, 3), 'as escolhidas ficam'); assert.notDeepEqual(depois.slice(3), antes.slice(3)); }
}
for (const u of us) await SV.setReady(R, u, room.id, true);
assert.equal((await R.getRoom(room.id)).status, 'playing');
assert.deepEqual(us.map(u => coins(R, u)), [140, 180, 160], 'cobra por cartela');
let g = await R.getGame(room.id);
assert.equal(g.state.pote, 120); assert.equal(g.state.premio, 96);
assert.ok(!JSON.stringify(R.pub.get(room.id)).includes('"ordem"'), 'ordem das bolas escondida');
let k = 0;
while (g.state.fase === 'jogo' && k++ < 100) { R.games.get(room.id).state.nextAt = 1; await SV.tick(R, null, room.id); g = await R.getGame(room.id); }
assert.equal(g.state.fase, 'fim');
const M = g.state, s = new Set(M.saiu);
assert.ok(M.result.cartelas.length >= 1);
for (const w of M.result.cartelas) assert.ok(cheia(M.players[w.pi].cartelas.find(x => x.id === w.id), s), 'vencedor tem cartela cheia');
const antes = new Set(M.saiu.slice(0, -1));
assert.ok(M.players.every(p => p.cartelas.every(x => !cheia(x, antes))), 'ninguém tinha completado antes');
const total = us.reduce((t, u) => t + coins(R, u), 0);
assert.ok(Math.abs(total - (600 - 120 + 96)) < 0.05, 'prêmio = pote - 20%');
assert.equal((await R.getRoom(room.id)).status, 'waiting');
// nova partida: escolhe de novo
const r2 = await SV.act(R, us[0], room.id, { type: 'cartelas' });
assert.equal(r2.state.fase, 'espera'); assert.equal(r2.state.escolhas[us[0].id].minhas.length, 0);
console.log('OK — bingo online: sala, cartelas, cobrança, sorteio, cartela cheia e prêmio com taxa');
