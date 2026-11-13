// Onça da Sorte: retorno calibrado, linhas, coringa, casas vazias, tela cheia x10, Rodada da Onça e pagamento.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { confere, gira, premio, SIMBOLOS, VAZIO, CHANCE_RODADA, RETORNO } from '../lib/onca.js';
import { girarOnca } from '../lib/onca-service.js';

// retorno: parte normal pela conta exata + Rodada da Onça simulada
const TOT = SIMBOLOS.reduce((a, s) => a + s.peso, 0), p = SIMBOLOS.map(s => s.peso / TOT), pw = p[0];
let l = 0, f = 0; SIMBOLOS.forEach((s, i) => { l += (i ? (p[i] + pw) ** 3 - pw ** 3 : pw ** 3) * s.paga; f += (i ? (p[i] + pw) ** 9 - pw ** 9 : pw ** 9) * 5 * s.paga * 9; });
let soma = 0; const N = 300000;
for (let k = 0; k < N; k++) { let pri = true; const g = gira(() => pri ? (pri = false, 0) : Math.random()); assert.ok(g.rodada && g.mult > 0, 'Rodada sempre paga'); soma += g.mult; }
const rtp = (1 - CHANCE_RODADA) * (5 * l + f) + CHANCE_RODADA * soma / N;
assert.ok(Math.abs(rtp - RETORNO) < 0.012, 'retorno ' + rtp);
// linha do meio com coringa
let c = confere([1, 2, 3, 7, 0, 7, 4, 3, 2]);
assert.deepEqual(c.linhas.map(x => x.linha), [1]); assert.equal(c.mult, SIMBOLOS[7].paga);
c = confere([0, 1, 2, 3, 0, 4, 5, 1, 0]); assert.equal(c.linhas.length, 1); assert.equal(c.mult, SIMBOLOS[0].paga);
c = confere([3, 3, 0, 3, 3, 3, 0, 3, 3]); assert.equal(c.cheia, true); assert.equal(c.mult, Math.round(5 * SIMBOLOS[3].paga * 10 * 100) / 100);
assert.equal(confere([VAZIO, VAZIO, VAZIO, 2, 2, 2, VAZIO, 0, VAZIO]).linhas.length, 1, 'vazio não atrapalha outra linha');
assert.equal(confere([VAZIO, 2, 2, VAZIO, 2, 2, VAZIO, 2, 2]).mult, 0);
assert.equal(confere([1, 2, 3, 4, 5, 6, 7, 1, 2]).mult, 0);
assert.equal(premio(1, 1.24), 1.24); assert.equal(premio(10, 2.47), 24.7);
// servidor
const R = memRepo(); const [u] = addUsers(R, 1, 20);
const meio = i => (SIMBOLOS.slice(0, i).reduce((a, s) => a + s.peso, 0) + .5) / TOT;
const seq = [0.9, ...[1, 1, 1, 2, 3, 4, 5, 6, 7].map(meio)]; let k = 0;
const r = await girarOnca(R, u, { aposta: 10 }, () => seq[k++]);
assert.equal(r.ganho, premio(10, SIMBOLOS[1].paga)); assert.equal(R.T.profiles[0].coins, Math.round((20 - 10 + r.ganho) * 100) / 100);
assert.equal(r.passos.length, 1);
await assert.rejects(girarOnca(R, u, { aposta: 7 }), /inválida/);
await assert.rejects(girarOnca(R, u, { aposta: 500 }), /insuficientes/);
console.log('OK — onça da sorte: retorno ' + (rtp * 100).toFixed(1) + '%, linhas, coringa, vazios, tela cheia x10, Rodada da Onça, pagamento');
