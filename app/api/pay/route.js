import { route } from '../../../lib/api.js';
import { createCheckout, processPayment } from '../../../lib/payments.js';
import { gerapixOn, createGerapixCharge } from '../../../lib/gerapix.js';
export const dynamic = 'force-dynamic';
// body.op: create (gera o link de pagamento) | check (confere um pagamento ao voltar do Mercado Pago)
export const POST = route(async ({ user, body, repo }) => {
  if (body.op === 'create') {
    if (gerapixOn()) {
      if (!body.cpf) return { needDoc: true }; // o GeraPix exige nome e CPF de quem paga
      return createGerapixCharge(repo, user, body);
    }
    return createCheckout(repo, user, body.pack);
  }
  const r = await processPayment(repo, body.paymentId);
  return { ok: r.ok, credited: r.credited || 0, already: !!r.already, status: r.status || null };
});
