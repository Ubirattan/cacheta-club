import assert from 'node:assert/strict';
import { Engine, AI } from '../lib/engine.js';
const mk = (r, s, id) => ({ r, s, id });
// coringa = 10 vermelho (vira 9♥)
function mesa() {
  const M = Engine.newMatch({ ...Engine.DEFAULT }, [{ name: 'A' }, { name: 'B' }]);
  Engine.startRound(M); M.cor = 9 + 16 * 2; M.turn = 0; M.phase = 'draw';
  // fecha com qualquer coringa: A♠ 2♠ 3♠ | 5♥ 5♦ 5♣ | 8♠ 9♠ _ 
  M.players[0].hand = [mk(0,0,1),mk(1,0,2),mk(2,0,3),mk(4,1,4),mk(4,2,5),mk(4,3,6),mk(7,0,7),mk(8,0,8),mk(12,3,9)];
  M.desc.push(mk(9,1,10)); M.history.push({ pi: 1, t: 'discard', card: mk(9,1,10) });
  return M;
}
assert.ok(Engine.isJ(mk(9,1,10), mesa().cor));
// não pode pegar o coringa do descarte
let M = mesa();
let r = Engine.act(M, 0, { type: 'draw', from: 'desc' });
assert.equal(r.ok, false); assert.match(r.err, /Coringa/);
// nem bater com ele
M = mesa(); r = Engine.act(M, 0, { type: 'baterDesc' });
assert.equal(r.ok, false); assert.equal(M.players[0].queimado, false);
// do monte pode
M = mesa(); assert.ok(Engine.act(M, 0, { type: 'draw', from: 'monte' }).ok);
// computador não tenta pegar
M = mesa(); for (const lv of ['facil','medio','dificil']) assert.equal(AI.chooseDraw(M, 0, lv), 'monte');
// carta normal no descarte continua valendo
M = mesa(); M.desc = [mk(9,0,11)]; assert.ok(Engine.act(M, 0, { type: 'draw', from: 'desc' }).ok);
console.log('coringa no descarte: ok');
