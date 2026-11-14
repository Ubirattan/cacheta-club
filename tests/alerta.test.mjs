// Aviso de erro no celular do admin: manda, não repete o mesmo erro em 30 min e espera 3 min entre avisos.
import assert from 'node:assert/strict';
import { memRepo } from './memrepo.mjs';
import { avisarErro, MESMO_ERRO_MS, ENTRE_AVISOS_MS } from '../lib/alerta.js';
const repo = memRepo();
const env = [];
const n = async (_r, t, b) => { env.push(b); return 1; };
let t = 1e12;
assert.equal(await avisarErro(repo, '/api/roleta', new Error('quebrou'), t, n), true);
assert.equal(await avisarErro(repo, '/api/mines', new Error('outro'), t + 1000, n), false, 'espera entre avisos');
assert.equal(await avisarErro(repo, '/api/roleta', new Error('quebrou'), t + ENTRE_AVISOS_MS + 1, n), false, 'mesmo erro não repete');
assert.equal(await avisarErro(repo, '/api/mines', new Error('outro'), t + ENTRE_AVISOS_MS + 1, n), true, 'erro diferente avisa');
assert.equal(await avisarErro(repo, '/api/roleta', new Error('quebrou'), t + MESMO_ERRO_MS + ENTRE_AVISOS_MS * 2, n), true, 'depois de 30 min avisa de novo');
assert.equal(env.length, 3); assert.match(env[0], /\/api\/roleta: quebrou/);
console.log('OK — aviso de erro no celular do admin');
