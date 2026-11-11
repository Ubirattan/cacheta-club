import { route } from '../../../lib/api.js';
import { createCheckout, processPayment } from '../../../lib/payments.js';
export const dynamic = 'force-dynamic';
// body.op: create (gera o link de pagamento) | check (confere um pagamento ao voltar do Mercado Pago)
export const POST = route(async ({ user, body, repo }) => {
  if (body.op === 'create') return createCheckout(repo, user, body.pack);
  const r = await processPayment(repo, body.paymentId);
  return { ok: r.ok, credited: r.credited || 0, already: !!r.already, status: r.status || null };
});
