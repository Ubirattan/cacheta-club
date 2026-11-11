// Login e senha do painel: criar, entrar, travar após 5 erros, trocar senha derruba a sessão antiga.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { adminOp } from '../lib/admin.js';

const R = memRepo(); const U = addUsers(R, 2); // u0 é admin, u1 não
await assert.rejects(adminOp(R, U[1], { op: 'authStatus' }), /Só administradores/);
assert.equal((await adminOp(R, U[0], { op: 'authStatus' })).configured, false);
await assert.rejects(adminOp(R, U[0], { op: 'stats' }), /PAINEL_LOGIN/);           // sem login do painel, nada funciona
await assert.rejects(adminOp(R, U[0], { op: 'setup', username: 'bira', password: '123' }), /8 caracteres/);
const { token } = await adminOp(R, U[0], { op: 'setup', username: 'bira', password: 'senha-forte-1' });
assert.ok(!JSON.stringify(R.T.admin_auth).includes('senha-forte-1'), 'senha guardada só como hash');
await assert.rejects(adminOp(R, U[0], { op: 'setup', username: 'x', password: 'outra-senha-1' }), /já foi criado/);
assert.equal((await adminOp(R, U[0], { op: 'stats', adminToken: token })).users, 2);
await assert.rejects(adminOp(R, U[0], { op: 'stats', adminToken: token + 'x' }), /PAINEL_LOGIN/);  // token adulterado
await assert.rejects(adminOp(R, U[0], { op: 'stats', adminToken: 'abc.def' }), /PAINEL_LOGIN/);
// login certo e errado; trava depois de 5 erros
assert.ok((await adminOp(R, U[0], { op: 'login', username: 'BIRA', password: 'senha-forte-1' })).token);
for (let i = 0; i < 4; i++) await assert.rejects(adminOp(R, U[0], { op: 'login', username: 'bira', password: 'errada' }), /restante/);
await assert.rejects(adminOp(R, U[0], { op: 'login', username: 'bira', password: 'errada' }), /travado/);
await assert.rejects(adminOp(R, U[0], { op: 'login', username: 'bira', password: 'senha-forte-1' }), /Muitas tentativas/);
R.T.admin_auth[0].locked_until = null;
const t2 = (await adminOp(R, U[0], { op: 'login', username: 'bira', password: 'senha-forte-1' })).token;
// trocar senha: exige a atual e derruba o token antigo
await assert.rejects(adminOp(R, U[0], { op: 'changePass', adminToken: t2, current: 'errada', password: 'nova-senha-22' }), /atual está errada/);
const t3 = (await adminOp(R, U[0], { op: 'changePass', adminToken: t2, current: 'senha-forte-1', password: 'nova-senha-22' })).token;
await assert.rejects(adminOp(R, U[0], { op: 'stats', adminToken: t2 }), /PAINEL_LOGIN/);
assert.equal((await adminOp(R, U[0], { op: 'stats', adminToken: t3 })).users, 2);
console.log('OK — login do painel: criar, entrar, trava após 5 erros, token assinado, troca de senha derruba sessão antiga');
