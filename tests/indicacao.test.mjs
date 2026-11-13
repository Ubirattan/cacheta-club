// Indique um amigo: quem indicou ganha 10 fichas no primeiro depósito de R$ 10+ do amigo, uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { registrarIndicacao, pagarIndicacao } from '../lib/indicacao.js';
import { gerapixWebhook } from '../lib/gerapix.js';

const R = memRepo(); addUsers(R, 4, 100);
const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
R.T.profiles.push({ id: A, nickname: 'A', coins: 100, games: 0, wins: 0 }, { id: B, nickname: 'B', coins: 100, games: 0, wins: 0 });
assert.equal(await registrarIndicacao(R, B, A), true);
assert.equal(await registrarIndicacao(R, B, A), false, 'só uma vez por amigo');
assert.equal(await registrarIndicacao(R, A, A), false, 'não indica a si mesmo');
assert.equal(await registrarIndicacao(R, 'u1', 'lixo'), false);
assert.equal(await registrarIndicacao(R, 'u1', 'cccccccc-0000-4000-8000-000000000003'), false, 'quem indicou precisa existir');
assert.equal(await pagarIndicacao(R, { user_id: B, price_brl: 5 }), null, 'depósito menor que 10 não paga');
assert.equal(await pagarIndicacao(R, { user_id: B, price_brl: 10 }), A);
assert.equal((await R.getProfile(A)).coins, 110);
assert.equal(await pagarIndicacao(R, { user_id: B, price_brl: 50 }), null, 'segundo depósito não paga de novo');
assert.equal((await R.getProfile(A)).coins, 110);

// pelo webhook do GeraPix
const C = 'cccccccc-0000-4000-8000-000000000004';
R.T.profiles.push({ id: C, nickname: 'C', coins: 0, games: 0, wins: 0 });
await registrarIndicacao(R, C, A);
process.env.GERAPIX_SECRET = 'seg';
const [pur] = await R.ins('purchases', { user_id: C, item: 'pack-20', coins: 20, price_coins: 0, price_brl: 20, status: 'pending', mp_preference: 'tx9' });
const r = await gerapixWebhook(R, 'Bearer seg', { status: 'aprovado', external_reference: String(pur.id), id_transacao: 'tx9' });
assert.equal(r.credited, 20);
assert.equal((await R.getProfile(A)).coins, 120, 'indicação paga pelo Pix');
assert.equal((await R.getProfile(C)).coins, 20);
console.log('OK — indicação: cadastro pelo link, paga 10 fichas no primeiro depósito, uma vez só');
