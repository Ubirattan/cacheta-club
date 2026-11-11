// Pagamento: link do Mercado Pago, crédito só com pagamento aprovado e valor certo, e uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { createCheckout, processPayment } from '../lib/payments.js';

process.env.MP_ACCESS_TOKEN = 'TEST-123'; process.env.SITE_URL = 'https://cacheta.exemplo.com';
const R = memRepo(); const U = addUsers(R, 2);
const payments = {}; let sent = null;
const fakeMP = async (url, opt = {}) => {
  if (url.endsWith('/checkout/preferences')) { sent = JSON.parse(opt.body); return { ok: true, json: async () => ({ id: 'pref1', init_point: 'https://mp/checkout/pref1' }) }; }
  const id = url.split('/').pop();
  return payments[id] ? { ok: true, json: async () => payments[id] } : { ok: false, json: async () => ({}) };
};
const co = await createCheckout(R, U[1], 'pack-20', fakeMP);
assert.equal(co.url, 'https://mp/checkout/pref1');
assert.equal(sent.items[0].unit_price, 20); assert.equal(sent.notification_url, 'https://cacheta.exemplo.com/api/pay/webhook');
assert.equal(R.T.purchases[0].status, 'pending');
const ref = sent.external_reference;

payments['111'] = { id: 111, status: 'pending', transaction_amount: 20, currency_id: 'BRL', external_reference: ref };
assert.equal((await processPayment(R, '111', fakeMP)).ok, false, 'Pix ainda não pago: não credita');
payments['222'] = { id: 222, status: 'approved', transaction_amount: 0.01, currency_id: 'BRL', external_reference: ref };
assert.equal((await processPayment(R, '222', fakeMP)).reason, 'valor diferente');
assert.equal((await R.getProfile('u1')).coins, 1000);
payments['111'].status = 'approved';
assert.equal((await processPayment(R, '111', fakeMP)).credited, 20); // R$ 20 = 20 fichas
assert.equal((await processPayment(R, '111', fakeMP)).already, true, 'aviso repetido não credita de novo');
await Promise.all([processPayment(R, '111', fakeMP), processPayment(R, '111', fakeMP)]);
assert.equal((await R.getProfile('u1')).coins, 1020, 'creditado exatamente uma vez');
assert.equal((await processPayment(R, 'abc;drop', fakeMP)).ok, false);
await assert.rejects(createCheckout(R, U[1], 'pack-falso', fakeMP), /inválido/);
delete process.env.MP_ACCESS_TOKEN;
await assert.rejects(createCheckout(R, U[1], 'pack-10', fakeMP), /não configurado/);
console.log('OK — pagamento: link, Pix pendente, valor errado barrado, crédito único');
