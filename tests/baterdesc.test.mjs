import assert from 'node:assert/strict';
import { Engine } from '../lib/engine.js';
const mk = (r, s, id) => ({ r, s, id });
function mesa() {
  const M = Engine.newMatch({ ...Engine.DEFAULT, hand: 9, coringa: 'viraCor', deck: 'completo', maxJ: 99, aceHigh: true, limpaDobro: true, fichas: 5 }, [{ name: 'A' }, { name: 'B' }]);
  Engine.startRound(M); M.cor = -1; M.turn = 0; M.phase = 'draw';
  M.players[0].hand = [mk(0,0,1),mk(1,0,2),mk(2,0,3),mk(4,1,4),mk(4,2,5),mk(4,3,6),mk(7,0,7),mk(8,0,8),mk(12,3,9)];
  return M;
}
// carta do descarte fecha o jogo: bate direto, sem comprar
let M = mesa(); M.desc.push(mk(9,0,10));
let r = Engine.act(M, 0, { type: 'baterDesc' });
assert.ok(r.ok); assert.equal(r.ev.type, 'bater'); assert.equal(M.result.winner, 0);
// carta que não fecha: batida errada, perde a vez e fica queimado
M = mesa(); M.desc.push(mk(11,1,10));
r = Engine.act(M, 0, { type: 'baterDesc' });
assert.equal(r.ev.type, 'bateuErrado'); assert.equal(M.turn, 1); assert.ok(M.players[0].queimado); assert.equal(M.players[0].hand.length, 9);
// queimado não pode bater com o descarte
M = mesa(); M.players[0].queimado = true; M.desc.push(mk(9,0,10));
assert.equal(Engine.act(M, 0, { type: 'baterDesc' }).ok, false);
// depois de comprar não vale
M = mesa(); M.desc.push(mk(9,0,10)); M.phase = 'discard';
assert.equal(Engine.act(M, 0, { type: 'baterDesc' }).ok, false);
// fora da vez: o jogador 0 bate com o descarte do jogador 1 enquanto é a vez do 2
function mesa3() {
  const M = Engine.newMatch({ ...Engine.DEFAULT, hand: 9, coringa: 'viraCor', deck: 'completo', maxJ: 99, aceHigh: true, limpaDobro: true, fichas: 5 }, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
  Engine.startRound(M); M.cor = -1; M.turn = 2; M.phase = 'draw';
  M.players[0].hand = [mk(0,0,1),mk(1,0,2),mk(2,0,3),mk(4,1,4),mk(4,2,5),mk(4,3,6),mk(7,0,7),mk(8,0,8),mk(12,3,9)];
  M.history.push({ pi: 1, t: 'discard', card: mk(9,0,10) });
  return M;
}
M = mesa3(); M.desc.push(mk(9,0,10));
r = Engine.act(M, 0, { type: 'baterDesc' });
assert.equal(r.ev.type, 'bater'); assert.equal(r.ev.fora, true); assert.equal(M.result.winner, 0);
// fora da vez e errado: fica queimado, a vez continua com quem estava
M = mesa3(); M.desc.push(mk(11,1,10));
r = Engine.act(M, 0, { type: 'baterDesc' });
assert.equal(r.ev.type, 'bateuErrado'); assert.equal(M.turn, 2); assert.ok(M.players[0].queimado);
// não vale bater com o próprio descarte
M = mesa3(); M.history.push({ pi: 0, t: 'discard', card: mk(9,0,10) }); M.desc.push(mk(9,0,10));
assert.equal(Engine.act(M, 0, { type: 'baterDesc' }).ok, false);
// enquanto o outro está descartando (já comprou), não dá
M = mesa3(); M.desc.push(mk(9,0,10)); M.phase = 'discard';
assert.equal(Engine.act(M, 0, { type: 'baterDesc' }).ok, false);
console.log('OK — bater com a carta do descarte: na vez ou fora dela; errou fica queimado; não vale o próprio descarte');
