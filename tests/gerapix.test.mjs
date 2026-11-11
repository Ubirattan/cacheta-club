// GeraPix: gera o Pix, só credita com o token certo, com a transação certa e uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { createGerapixCharge, gerapixWebhook, cpfValido } from '../lib/gerapix.js';

process.env.GERAPIX_SECRET = 'segredo-teste'; process.env.SITE_URL = 'https://cacheta.exemplo.com';
const R = memRepo(); const U = addUsers(R, 2); U[1].email = 'bira@exemplo.com';
let sent = null;
const fake = async (url, opt) => { sent = { url, opt, body: JSON.parse(opt.body) }; return { ok: true, json: async () => ({ id_transacao: 'TX9', external_reference: sent.body.external_reference, status: 'pendente', qr_code: '00020101021226...', qr_code_base64: 'data:image/png;base64,AAA' }) }; };
assert.equal(cpfValido('529.982.247-25'), true); assert.equal(cpfValido('111.111.111-11'), false); assert.equal(cpfValido('123'), false);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'pack-p', nome: 'Bira Silva', cpf: '12345678900' }, fake), /CPF inválido/);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'pack-p', nome: 'Bira', cpf: '52998224725' }, fake), /sobrenome/);
const r = await createGerapixCharge(R, U[1], { pack: 'pack-m', nome: 'Bira Silva', cpf: '529.982.247-25' }, fake);
assert.equal(sent.url, 'https://api.gerapix.digital/v1/pix/qrcodes/');
assert.equal(sent.opt.headers.Authorization, 'Bearer segredo-teste');
assert.equal(sent.body.valor, '25.00'); assert.equal(sent.body.doc_numero, '52998224725'); assert.equal(sent.body.doc_tipo, 'cpf');
assert.equal(sent.body.callback_url, 'https://cacheta.exemplo.com/api/pay/gerapix'); assert.equal(sent.body.email, 'bira@exemplo.com');
assert.ok(r.pix.copiaCola.startsWith('000201'));
assert.ok(!JSON.stringify(R.T.purchases).includes('52998224725'), 'CPF não fica guardado');
const ref = sent.body.external_reference;
assert.equal((await gerapixWebhook(R, 'Bearer errado', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).reason, 'token inválido');
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'OUTRA', external_reference: ref })).reason, 'transação não confere');
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'pendente', id_transacao: 'TX9', external_reference: ref })).ignored, 'pendente');
assert.equal((await R.getProfile('u1')).coins, 1000);
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).credited, 30000);
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).already, true);
assert.equal((await R.getProfile('u1')).coins, 31000, 'creditado uma vez só');
console.log('OK — GeraPix: Pix gerado, token/transação conferidos, CPF não guardado, crédito único');
