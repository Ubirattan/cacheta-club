// Onça da Sorte: retorno de 95%, linhas, coringa, tela cheia x10 e pagamento no servidor.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { confere, retorno, gira, premio, SIMBOLOS } from '../lib/onca.js';
import { girarOnca } from '../lib/onca-service.js';

const rtp = retorno(); assert.ok(rtp > 0.295 && rtp < 0.305, 'retorno teórico ' + rtp);
let ap = 0, vo = 0; for (let i = 0; i < 300000; i++) { ap += 1; vo += gira(Math.random).mult; }
assert.ok(Math.abs(vo / ap - rtp) < 0.03, 'simulado ' + vo / ap);
// linha do meio de laranjas com uma onça no meio
let c = confere([1, 2, 3, 7, 0, 7, 4, 3, 2]);
assert.deepEqual(c.linhas.map(l => l.linha), [1]); assert.equal(c.mult, SIMBOLOS[7].paga);
// diagonal de onças: paga a onça
c = confere([0, 1, 2, 3, 0, 4, 5, 1, 0]); assert.equal(c.linhas.length, 1); assert.equal(c.mult, SIMBOLOS[0].paga);
// tela cheia de moedas com onças: 5 linhas x10
c = confere([3, 3, 0, 3, 3, 3, 0, 3, 3]); assert.equal(c.cheia, true); assert.equal(c.mult, Math.round(5 * SIMBOLOS[3].paga * 10 * 100) / 100);
assert.equal(confere([1, 2, 3, 4, 5, 6, 7, 1, 2]).mult, 0);
assert.equal(premio(1, 1.08), 1.08); assert.equal(premio(10, 3.25), 32.5);
// servidor
const R = memRepo(); const [u] = addUsers(R, 1, 20);
let seq = [1, 1, 1, 2, 3, 4, 5, 6, 7].map(i => (SIMBOLOS.slice(0, i).reduce((a, s) => a + s.peso, 0) + .5) / 75), k = 0;
const r = await girarOnca(R, u, { aposta: 10 }, () => seq[k++]);
assert.equal(r.ganho, 108.3); assert.equal(R.T.profiles[0].coins, 20 - 10 + 108.3);
await assert.rejects(girarOnca(R, u, { aposta: 7 }), /inválida/);
await assert.rejects(girarOnca(R, u, { aposta: 500 }), /insuficientes/);
console.log('OK — onça da sorte: retorno ' + (rtp * 100).toFixed(2) + '%, linhas, coringa, tela cheia x10, pagamento');
