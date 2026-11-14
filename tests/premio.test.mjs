// Prêmio máximo de 4 mil fichas em todos os jogos da casa.
import assert from 'node:assert/strict';
import { PREMIO_MAXIMO } from '../lib/premio.js';
import { premio } from '../lib/onca.js';
import { ganhoDe as gDouble } from '../lib/double.js';
import { ganhoDe as gFog, autoMaximo } from '../lib/foguete.js';
import { pagar } from '../lib/roleta.js';
import { premioDe } from '../lib/futebol.js';
import { MAX_GANHO } from '../lib/mines.js';
assert.equal(PREMIO_MAXIMO, 4000);
assert.equal(premio(500, 2406), 4000); assert.equal(premio(10, 5.78), 57.8);
assert.equal(gDouble(500, 'branco'), 4000); assert.equal(gDouble(100, 'branco'), 1400);
assert.equal(gFog(500, 100), 4000); assert.equal(autoMaximo(100), 40); assert.equal(autoMaximo(41), 97.56);
assert.equal(premioDe(1000, 10), 4000); assert.equal(MAX_GANHO, 4000);
const r = pagar({ n17: 500 }, 17); assert.ok(r.volta <= 4000, 'roleta ' + r.volta);
console.log('OK — prêmio máximo de 4 mil em todos os jogos');
