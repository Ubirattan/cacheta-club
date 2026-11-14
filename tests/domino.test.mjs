// Dominó em duplas: distribuição, saída com a sena, encaixe, batidas (simples, carroça, lá-e-lô, cruzada), tranca e partidas inteiras.
import assert from 'node:assert/strict';
import { novaPartida, agir, precisa, seguir, jogadaBot, lados, tipoBatida, todasPedras, META } from '../lib/domino.js';
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const P = [{ name: 'Você' }, { name: 'A', bot: true }, { name: 'B', bot: true }, { name: 'C', bot: true }];
assert.equal(todasPedras().length, 28);
const M = novaPartida(P, rnd);
assert.equal(M.players.reduce((t, p) => t + p.mao.length, 0), 28);
assert.ok(M.players[M.vez].mao.some(p => p.id === 66), 'quem tem a sena começa');
const outra = M.players[M.vez].mao.find(p => p.id !== 66);
assert.equal(agir(M, M.vez, { type: 'jogar', id: outra.id, lado: 'L' }).ok, false, 'tem que sair com a sena');
assert.equal(agir(M, M.vez, { type: 'jogar', id: 66, lado: 'L' }).ok, true);
assert.deepEqual(M.pontas, [6, 6]);
// tipos de batida
assert.equal(tipoBatida({ a: 3, b: 5 }, [3, 4]), 'simples');
assert.equal(tipoBatida({ a: 4, b: 3 }, [3, 4]), 'laelo');
assert.equal(tipoBatida({ a: 2, b: 2 }, [2, 5]), 'carroca');
assert.equal(tipoBatida({ a: 2, b: 2 }, [2, 2]), 'cruzada');
assert.deepEqual(lados({ pontas: [3, 3] }, { a: 3, b: 1 }), ['L'], 'pontas iguais: um lado só');
assert.deepEqual(lados({ pontas: [3, 4] }, { a: 4, b: 3 }), ['L', 'R']);
// encaixe certo na linha
const N = { pontas: null, obrigaSena: false, linha: [], fase: 'jogo', vez: 0, passes: 0, players: [{ mao: [{ id: 12, a: 1, b: 2 }, { id: 25, a: 2, b: 5 }, { id: 11, a: 1, b: 1 }] }, { mao: [{ id: 0, a: 0, b: 0 }] }, { mao: [{ id: 3, a: 0, b: 3 }] }, { mao: [{ id: 4, a: 0, b: 4 }] }], placar: [0, 0] };
agir(N, 0, { type: 'jogar', id: 12, lado: 'L' }); N.vez = 0;
agir(N, 0, { type: 'jogar', id: 25, lado: 'R' }); N.vez = 0;
assert.deepEqual(N.linha.map(x => [x.a, x.b]), [[1, 2], [2, 5]]); assert.deepEqual(N.pontas, [1, 5]);
const r = agir(N, 0, { type: 'jogar', id: 11, lado: 'L' });
assert.equal(r.ev.type, 'mao'); assert.equal(r.ev.tipo, 'carroca'); assert.equal(N.placar[0], 2);
// 300 partidas inteiras só com o computador: sempre termina, pontos somam certo
let fins = 0;
for (let g = 0; g < 300; g++) {
  const G = novaPartida(P, rnd); let passos = 0;
  while (G.fase !== 'fim' && passos++ < 5000) {
    const nd = precisa(G);
    if (nd.kind === 'mao') { seguir(G); continue; }
    const mv = jogadaBot(G, nd.pi, g % 2 ? 'facil' : 'medio');
    const res = agir(G, nd.pi, mv); assert.ok(res.ok, res.err);
    if (G.fase === 'jogo') assert.equal(G.players.reduce((t, p) => t + p.mao.length, 0) + G.linha.length, 28);
  }
  assert.equal(G.fase, 'fim'); assert.ok(Math.max(...G.placar) >= META); fins++;
}
assert.equal(fins, 300);
console.log('OK — dominó em duplas: saída, encaixe, batidas, tranca e 300 partidas');
