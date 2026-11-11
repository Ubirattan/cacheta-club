// =====================================================================
// Pagamento de pacotes de FICHAS VIRTUAIS pelo Mercado Pago (Pix e cartão).
// As fichas não valem dinheiro e não têm saque.
//
// Segurança: o servidor NUNCA confia no navegador nem no aviso recebido.
// Ele sempre consulta o pagamento direto na API do Mercado Pago e só credita
// se estiver aprovado, com o valor certo e for de uma compra pendente.
// Cada compra é creditada uma única vez.
// =====================================================================
import { GameError } from './service.js';
import { packFor, RECARGA_MIN, RECARGA_MAX, WELCOME } from './shop-items.js';
import { welcomeOk, grantExtras } from './welcome.js';

const fail = (m, s) => { throw new GameError(m, s); };
const MP = 'https://api.mercadopago.com';

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) fail('Pagamento ainda não configurado (falta MP_ACCESS_TOKEN)', 503);
  return t;
}
function siteUrl() { return (process.env.SITE_URL || 'https://cacheta-club.netlify.app').replace(/\/$/, ''); }

// cria a compra pendente e o link de pagamento do Mercado Pago
export async function createCheckout(repo, user, packId, fetchImpl = fetch, valor) {
  const pack = packFor(packId, valor); if (!pack) fail(`Valor inválido: escolha de R$ ${RECARGA_MIN} a R$ ${RECARGA_MAX}`);
  if (pack.id === WELCOME.id && !(await welcomeOk(repo, user.id))) fail('O pacote de boas-vindas é só para a primeira compra');
  const profile = await repo.getProfile(user.id); if (!profile || profile.blocked) fail('Conta bloqueada', 403);
  const tk = token();
  const [pur] = await repo.ins('purchases', { user_id: user.id, item: pack.id, coins: pack.coins, price_coins: 0, price_brl: pack.brl, status: 'pending' });
  const site = siteUrl();
  const body = {
    items: [{ id: pack.id, title: `${pack.coins.toLocaleString('pt-BR')} fichas virtuais - Cacheta Club`, description: 'Fichas virtuais para jogar. Sem valor em dinheiro e sem saque.', quantity: 1, currency_id: 'BRL', unit_price: pack.brl }],
    external_reference: String(pur.id),
    metadata: { purchase_id: pur.id, user_id: user.id },
    statement_descriptor: 'CACHETACLUB',
    ...(site ? {
      notification_url: `${site}/api/pay/webhook`,
      back_urls: { success: `${site}/loja?pago=ok`, pending: `${site}/loja?pago=pendente`, failure: `${site}/loja?pago=erro` },
      auto_return: 'approved',
    } : {}),
  };
  const res = await fetchImpl(`${MP}/checkout/preferences`, { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `pur-${pur.id}` }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.init_point) { await repo.upd('purchases', { id: pur.id }, { status: 'failed' }); fail('Mercado Pago não respondeu. Tente de novo.', 502); }
  await repo.upd('purchases', { id: pur.id }, { mp_preference: data.id });
  return { url: data.init_point, purchaseId: pur.id };
}

// confere um pagamento no Mercado Pago e credita as fichas (uma vez só)
export async function processPayment(repo, paymentId, fetchImpl = fetch) {
  if (!/^\d+$/.test(String(paymentId || ''))) return { ok: false, reason: 'id inválido' };
  const res = await fetchImpl(`${MP}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) return { ok: false, reason: 'pagamento não encontrado' };
  const pay = await res.json();
  const purId = Number(pay.external_reference);
  const [pur] = purId ? await repo.sel('purchases', { id: purId }) : [];
  if (!pur) return { ok: false, reason: 'compra não encontrada' };
  if (pur.status === 'done') return { ok: true, already: true, coins: pur.coins };
  if (pay.status !== 'approved') return { ok: false, status: pay.status, reason: 'ainda não aprovado' };
  if (Math.abs(Number(pay.transaction_amount) - Number(pur.price_brl)) > 0.009 || pay.currency_id !== 'BRL') return { ok: false, reason: 'valor diferente' };
  // trava: só quem muda de "pending" para "done" credita
  const moved = await repo.upd('purchases', { id: pur.id, status: 'pending' }, { status: 'done', mp_payment_id: String(pay.id), paid_at: new Date().toISOString() });
  if (!moved.length) return { ok: true, already: true, coins: pur.coins };
  await repo.adjustProfile(pur.user_id, pur.coins, 0, 0);
  await grantExtras(repo, pur);
  return { ok: true, credited: pur.coins, userId: pur.user_id };
}
