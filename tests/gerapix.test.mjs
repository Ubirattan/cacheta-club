// GeraPix: gera o Pix, só credita com o token certo, com a transação certa e uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { createGerapixCharge, gerapixWebhook, cpfValido } from '../lib/gerapix.js';

process.env.GERAPIX_SECRET = 'segredo-teste'; process.env.SITE_URL = 'https://cacheta.exemplo.com';
const R = memRepo(); const U = addUsers(R, 2); U[1].email = 'bira@exemplo.com';
let sent = null;
const fake = async (url, opt) => { sent = { url, opt, body: JSON.parse(opt.body) }; return { ok: true, json: async () => ({ id_transacao: 'TX9', external_reference: sent.body.external_reference, status: 'pendente', qr_code: '00020101021226...', qr_code_base64: 'data:image/png;base64,AAA' }) }; };
assert.equal(cpfValido('529.982.247-25'), true); assert.equal(cpfValido('111.111.111-11'), false); assert.equal(cpfValido('123'), false);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'pack-10', nome: 'Bira Silva', cpf: '12345678900' }, fake), /CPF inválido/);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'pack-10', nome: 'Bira', cpf: '52998224725' }, fake), /sobrenome/);
const r = await createGerapixCharge(R, U[1], { pack: 'pack-20', nome: 'Bira Silva', cpf: '529.982.247-25' }, fake);
assert.equal(sent.url, 'https://api.gerapix.digital/v1/pix/qrcodes/');
assert.equal(sent.opt.headers.Authorization, 'Bearer segredo-teste');
assert.equal(sent.body.valor, '20.00'); assert.equal(sent.body.doc_numero, '52998224725'); assert.equal(sent.body.doc_tipo, 'cpf');
assert.equal(sent.body.callback_url, 'https://cacheta.exemplo.com/api/pay/gerapix'); assert.equal(sent.body.email, 'bira@exemplo.com');
assert.ok(r.pix.copiaCola.startsWith('000201'));
assert.ok(!JSON.stringify(R.T.purchases).includes('52998224725'), 'CPF não fica guardado');
const ref = sent.body.external_reference;
assert.equal((await gerapixWebhook(R, 'Bearer errado', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).reason, 'token inválido');
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'OUTRA', external_reference: ref })).reason, 'transação não confere');
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'pendente', id_transacao: 'TX9', external_reference: ref })).ignored, 'pendente');
assert.equal((await R.getProfile('u1')).coins, 1000);
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).credited, 220); // R$ 20 = 200 fichas + 10% de bônus
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'TX9', external_reference: ref })).already, true);
assert.equal((await R.getProfile('u1')).coins, 1220, 'creditado uma vez só');
// valor livre: R$ 37,50 = 375 fichas; abaixo de R$ 10 é recusado
const r2 = await createGerapixCharge(R, U[1], { pack: 'custom', valor: '37,50', nome: 'Bira Silva', cpf: '52998224725' }, fake);
assert.equal(sent.body.valor, '37.50'); assert.equal(r2.pix.coins, 375);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'custom', valor: '9.99', nome: 'Bira Silva', cpf: '52998224725' }, fake), /Valor inválido/);
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'custom', valor: '5000', nome: 'Bira Silva', cpf: '52998224725' }, fake), /Valor inválido/);
// pacote de boas-vindas: R$ 5 = 80 fichas + avatar 🌟, só para quem nunca comprou
await assert.rejects(createGerapixCharge(R, U[1], { pack: 'pack-boasvindas', nome: 'Bira Silva', cpf: '52998224725' }, fake), /primeira compra/);
const U2 = { id: 'u0', email: 'novo@exemplo.com' };
await createGerapixCharge(R, U2, { pack: 'pack-boasvindas', nome: 'Novo Jogador', cpf: '52998224725' }, fake);
assert.equal(sent.body.valor, '5.00');
const c0 = (await R.getProfile('u0')).coins;
assert.equal((await gerapixWebhook(R, 'Bearer segredo-teste', { status: 'Aprovado', id_transacao: 'TX9', external_reference: sent.body.external_reference })).credited, 80);
const p0 = await R.getProfile('u0');
assert.equal(p0.coins, c0 + 80); assert.equal(p0.avatar, '🌟'); assert.ok(p0.owned.includes('av-estrela'));
await assert.rejects(createGerapixCharge(R, U2, { pack: 'pack-boasvindas', nome: 'Novo Jogador', cpf: '52998224725' }, fake), /primeira compra/);
console.log('OK — pacote de boas-vindas só na primeira compra, com avatar exclusivo; GeraPix: R$ 1 = 10 fichas, valor livre, token/transação conferidos, CPF não guardado, crédito único');
