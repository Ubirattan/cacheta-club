import assert from 'node:assert/strict';
import { Engine, AI } from '../lib/engine.js';
const cfg = { ...Engine.DEFAULT, hand: 9, coringa: 'viraCor', deck: 'completo', maxJ: 99, aceHigh: true, limpaDobro: true, fichas: 5, correr: true };
const mesa = n => { const M = Engine.newMatch(cfg, Array.from({ length: n }, (_, i) => ({ name: 'J' + i }))); Engine.startRound(M); return M; };
// rodada começa na decisão; ninguém compra antes de todos decidirem
let M = mesa(3);
assert.equal(M.phase, 'decide');
assert.equal(Engine.act(M, M.turn, { type: 'draw', from: 'monte' }).ok, false);
// 2 jogam, 1 corre: quem correu perde 1 e fica de fora
Engine.act(M, 0, { type: 'decide', go: true });
assert.equal(Engine.act(M, 0, { type: 'decide', go: false }).ok, false, 'não decide duas vezes');
Engine.act(M, 1, { type: 'decide', go: false });
let r = Engine.act(M, 2, { type: 'decide', go: true });
assert.equal(r.ev.type, 'decidido'); assert.equal(M.phase, 'draw');
assert.equal(M.players[1].fichas, 4); assert.ok(M.players[1].out);
assert.notEqual(M.turn, 1);
// quem correu não joga e não bate
assert.equal(Engine.act(M, 1, { type: 'baterDesc' }).ok, false);
// quem bate não perde; quem jogou e perdeu perde 2; quem correu fica com -1 só
const w = M.turn, other = w === 0 ? 2 : 0, mk = (r, s, id) => ({ r, s, id });
M.cor = -1; M.players[w].hand = [mk(0,0,901),mk(1,0,902),mk(2,0,903),mk(4,1,904),mk(4,2,905),mk(4,3,906),mk(7,0,907),mk(8,0,908),mk(9,0,909),mk(12,3,910)]; M.phase = 'discard'; M.taken = null;
r = Engine.act(M, w, { type: 'bater', cardId: 910 });
assert.equal(r.ev.type, 'bater');
assert.equal(M.players[w].fichas, 5); assert.equal(M.players[other].fichas, 3); assert.equal(M.players[1].fichas, 4);
assert.equal(M.result.before[1] - M.players[1].fichas, 1);
// só um vai jogar: ganha a rodada sem jogo
M = mesa(3);
Engine.act(M, 0, { type: 'decide', go: false }); Engine.act(M, 1, { type: 'decide', go: true });
r = Engine.act(M, 2, { type: 'decide', go: false });
assert.equal(r.ev.type, 'semJogo'); assert.equal(M.result.winner, 1); assert.ok(M.over);
assert.deepEqual(M.players.map(p => p.fichas), [4, 5, 4]);
// com 1 ponto não pode correr
M = mesa(2); M.players[0].fichas = 1;
assert.equal(Engine.act(M, 0, { type: 'decide', go: false }).ok, false);
assert.equal(AI.chooseGo(M, 0, 'medio'), true);
// sem a regra, a rodada começa direto na compra
M = Engine.newMatch({ ...cfg, correr: false }, [{ name: 'a' }, { name: 'b' }]); Engine.startRound(M);
assert.equal(M.phase, 'draw');
// com 1 ponto: não corre, mas pode desistir (sai da partida)
M = mesa(3); M.players[0].fichas = 1;
assert.equal(Engine.act(M, 0, { type: 'decide', go: false, desistir: true }).ok, true);
Engine.act(M, 1, { type: 'decide', go: true }); r = Engine.act(M, 2, { type: 'decide', go: true });
assert.equal(r.ev.type, 'decidido'); assert.equal(M.players[0].fichas, 0); assert.ok(M.players[0].out);
// se todos sairiam, quem desistiu volta a jogar
M = mesa(2); M.players[0].fichas = 1; M.players[1].fichas = 1;
Engine.act(M, 0, { type: 'decide', go: false, desistir: true }); r = Engine.act(M, 1, { type: 'decide', go: false, desistir: true });
assert.ok(M.players.every(p => p.fichas === 1));
console.log('OK — com 1 ponto pode desistir; ir ou correr: correu perde 1, jogou e perdeu perde 2, vencedor não perde, só um jogador ganha sem jogo');
