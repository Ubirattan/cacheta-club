// Página de TESTE do Mercado Pago (só admin): cria uma cobrança de verdade, mostra o que o cliente vê,
// acompanha o status e mostra quando o dinheiro fica disponível. Não credita fichas. Dá pra reembolsar.
import { randomUUID } from 'node:crypto';
import { GameError } from './service-error.js';

const MP = 'https://api.mercadopago.com';
const fail = (m, s = 400) => { throw new GameError(m, s); };
function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) fail('Falta cadastrar MP_ACCESS_TOKEN no Netlify (Access Token de produção do Mercado Pago)', 503);
  return t;
}
const site = () => (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');

async function mp(caminho, { method = 'GET', body, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${MP}${caminho}`, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(method === 'POST' ? { 'X-Idempotency-Key': randomUUID() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) fail('Mercado Pago: ' + (j.message || j.error || res.status) + (j.cause?.[0]?.description ? ' (' + j.cause[0].description + ')' : ''), 502);
  return j;
}
const resumo = p => ({
  id: p.id, status: p.status, detalhe: p.status_detail, valor: p.transaction_amount, liquido: p.transaction_details?.net_received_amount ?? null,
  taxas: (p.fee_details || []).reduce((t, f) => t + Number(f.amount || 0), 0), meio: p.payment_method_id, tipo: p.payment_type_id,
  criado: p.date_created, aprovado: p.date_approved, liberacao: p.money_release_date, liberado: p.money_release_status,
  pix: p.point_of_interaction?.transaction_data ? { qr: p.point_of_interaction.transaction_data.qr_code, img: p.point_of_interaction.transaction_data.qr_code_base64, link: p.point_of_interaction.transaction_data.ticket_url } : null,
  expira: p.date_of_expiration, reembolsado: (p.refunds || []).length > 0 || p.status === 'refunded',
});

export async function testeMp(repo, user, b = {}, fetchImpl = fetch) {
  const p = await repo.getProfile(user.id);
  if (!p?.is_admin) fail('Só o administrador pode usar a página de teste', 403);
  const valor = Math.round(Number(b.valor) * 100) / 100;
  if (b.op === 'pix') {
    if (!(valor >= 0.01 && valor <= 1000)) fail('Valor de R$ 0,01 a R$ 1.000');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(b.email || ''))) fail('Digite o e-mail de quem vai pagar');
    const pay = await mp('/v1/payments', { method: 'POST', fetchImpl, body: {
      transaction_amount: valor, payment_method_id: 'pix', description: 'Teste de pagamento - Casa de Jogos',
      payer: { email: String(b.email).trim() }, date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString(),
    } });
    return resumo(pay);
  }
  if (b.op === 'pro') {
    if (!(valor >= 0.01 && valor <= 1000)) fail('Valor de R$ 0,01 a R$ 1.000');
    // volta pra mesma página de onde saiu (site ou link de teste do Netlify)
    const o = String(b.origem || '');
    const s = /^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$/.test(o) || o === site() ? o : site();
    const pref = await mp('/checkout/preferences', { method: 'POST', fetchImpl, body: {
      items: [{ id: 'teste', title: 'Teste de pagamento - Casa de Jogos', quantity: 1, currency_id: 'BRL', unit_price: valor }],
      statement_descriptor: 'CASADEJOGOS',
      ...(s ? { back_urls: { success: `${s}/teste-mp`, pending: `${s}/teste-mp`, failure: `${s}/teste-mp` }, auto_return: 'approved' } : {}),
    } });
    return { url: pref.init_point };
  }
  if (b.op === 'status') {
    if (!/^\d+$/.test(String(b.id || ''))) fail('Pagamento inválido');
    return resumo(await mp(`/v1/payments/${b.id}`, { fetchImpl }));
  }
  if (b.op === 'reembolsar') {
    if (!/^\d+$/.test(String(b.id || ''))) fail('Pagamento inválido');
    await mp(`/v1/payments/${b.id}/refunds`, { method: 'POST', fetchImpl, body: {} });
    return resumo(await mp(`/v1/payments/${b.id}`, { fetchImpl }));
  }
  fail('Ação inválida');
}
