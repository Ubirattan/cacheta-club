// Roleta: pagamentos, limites e o servidor descontando/pagando certo
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { RODA, cor, conferir, pagar, APOSTAS, MAX_APOSTA } from '../lib/roleta.js';
import { girar } from '../lib/roleta-service.js';

assert.equal(RODA.length, 37); assert.equal(new Set(RODA).size, 37, 'roda com os 37 números');
assert.equal(cor(0), 'verde'); assert.equal(cor(1), 'vermelho'); assert.equal(cor(2), 'preto');
assert.equal([...Array(37).keys()].filter(n => cor(n) === 'vermelho').length, 18);
// pagamentos
assert.equal(pagar({ n17: 2 }, 17).volta, 72, 'número cheio paga 35 pra 1');
assert.equal(pagar({ vermelho: 10 }, 1).volta, 20);
assert.equal(pagar({ vermelho: 10, preto: 10 }, 0).volta, 0, 'zero: casa leva as externas');
assert.equal(pagar({ d2: 5 }, 24).volta, 15); assert.equal(pagar({ d2: 5 }, 25).volta, 0);
assert.equal(pagar({ c1: 3 }, 34).volta, 9, '34 é da 1ª coluna'); assert.equal(pagar({ c3: 3 }, 36).volta, 9);
assert.equal(pagar({ par: 4 }, 0).volta, 0, 'zero não é par');
// cada aposta cobre o número certo de casas
const casas = k => [...Array(37).keys()].filter(n => APOSTAS[k].ganha(n)).length;
for (const k of ['vermelho', 'preto', 'par', 'impar', 'baixo', 'alto']) assert.equal(casas(k), 18, k);
for (const k of ['d1', 'd2', 'd3', 'c1', 'c2', 'c3']) assert.equal(casas(k), 12, k);
// vantagem da casa: 1/37 em qualquer aposta
for (const k of Object.keys(APOSTAS)) {
  const ev = [...Array(37).keys()].reduce((s, n) => s + pagar({ [k]: 1 }, n).volta, 0) / 37;
  assert.ok(Math.abs(ev - 36 / 37) < 1e-9, 'retorno ' + k);
}
// limites
assert.ok(conferir({}).erro); assert.ok(conferir({ n40: 1 }).erro); assert.ok(conferir({ n1: -1 }).erro);
assert.ok(conferir({ n1: 1.5 }).erro); assert.ok(conferir({ vermelho: MAX_APOSTA + 1 }).erro);
assert.equal(conferir({ vermelho: 25, n0: 25 }).total, 50);
// servidor
{
  const R = memRepo(); const [u] = addUsers(R, 1, 30);
  const coins = () => R.T.profiles[0].coins;
  let r = await girar(R, u, { apostas: { n7: 2, vermelho: 3 } }, () => 7);
  assert.equal(r.numero, 7); assert.equal(r.volta, 72 + 6); assert.equal(coins(), 30 - 5 + 78); assert.equal(r.coins, coins());
  r = await girar(R, u, { apostas: { preto: 10 } }, () => 0);
  assert.equal(r.volta, 0); assert.equal(coins(), 103 - 10);
  await assert.rejects(girar(R, u, { apostas: { preto: 51 } }), /máximo/);
  R.T.profiles[0].coins = 4;
  await assert.rejects(girar(R, u, { apostas: { preto: 5 } }), /insuficientes/);
  assert.equal(coins(), 4, 'sem saldo não desconta');
  // sorteio de verdade espalha por todos os números
  R.T.profiles[0].coins = 1e6; const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add((await girar(R, u, { apostas: { n0: 1 } })).numero);
  assert.equal(seen.size, 37);
}
console.log('roleta ok');
