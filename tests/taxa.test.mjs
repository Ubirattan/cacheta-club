// Taxa da casa nas salas online (gude e pipa)
import assert from 'node:assert/strict';
import { premioOnline, taxaPct } from '../lib/taxa.js';
assert.equal(premioOnline(2), 3, 'até 10: entrada + metade da do outro');
assert.equal(premioOnline(10), 15);
assert.equal(taxaPct(11), 10); assert.equal(premioOnline(20), 36, 'acima de 10: casa fica com 10% do pote');
assert.equal(premioOnline(100), 180);
assert.equal(taxaPct(101), 20); assert.equal(premioOnline(200), 320, 'acima de 100: casa fica com 20% do pote');
assert.equal(premioOnline(15), 27, 'pote 30, casa 3');
console.log('taxa ok');
