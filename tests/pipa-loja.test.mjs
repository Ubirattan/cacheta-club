// Pipas na loja: compra com fichas, fica equipada e o jogo acha o desenho
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { buy, equip } from '../lib/shop.js';
import { ITEMS } from '../lib/shop-items.js';
import { MODELOS, modelo, modelosBots, PIPA_PADRAO } from '../lib/pipa-arte.js';

const pipas = ITEMS.filter(i => i.slot === 'pipa');
assert.ok(pipas.length >= 8, 'várias pipas na loja');
for (const p of pipas) assert.ok(MODELOS[p.id], 'toda pipa da loja tem desenho: ' + p.id);
assert.equal(pipas.find(p => p.id === PIPA_PADRAO).price, 0, 'a clássica é grátis');
const repo = memRepo(); const [a] = addUsers(repo, 1, 12);
await assert.rejects(equip(repo, a, 'pipa-raio'), /Compre/, 'não usa sem comprar');
await buy(repo, a, 'pipa-raio');
let p = repo.T.profiles[0];
assert.equal(p.coins, 0); assert.equal(p.equipped.pipa, 'pipa-raio'); assert.ok(p.owned.includes('pipa-raio'));
await assert.rejects(buy(repo, a, 'pipa-fogo'), /insuficientes/);
await equip(repo, a, 'pipa-classica');
assert.equal(repo.T.profiles[0].equipped.pipa, 'pipa-classica', 'volta pra grátis');
assert.equal(modelo('nao-existe'), MODELOS[PIPA_PADRAO]);
const b = modelosBots('pipa-raio', 3); assert.equal(b.length, 3); assert.ok(!b.includes('pipa-raio') && new Set(b).size === 3);
console.log('pipa loja ok');
