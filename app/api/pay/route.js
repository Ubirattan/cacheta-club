import { route } from '../../../lib/api.js';
import { createCheckout, processPayment } from '../../../lib/payments.js';
import { gerapixOn, createGerapixCharge } from '../../../lib/gerapix.js';
import { packFor } from '../../../lib/shop-items.js';
import { checarDeposito } from '../../../lib/jogo-responsavel.js';
export const dynamic = 'force-dynamic';
// body.op: create (gera o link de pagamento) | check (confere um pagamento ao voltar do Mercado Pago)
export const POST = route(async ({ user, body, repo }) => {
  if (body.op === 'create') {
    const pk = packFor(body.pack, body.valor);
    if (pk) await checarDeposito(repo, user.id, pk.brl);   // autoexclusão e limite de depósito
    if (gerapixOn()) {
      if (!body.cpf) return { needDoc: true }; // o GeraPix exige nome e CPF de quem paga
      return createGerapixCharge(repo, user, body);
    }
    return createCheckout(repo, user, body.pack, fetch, body.valor);
  }
  const r = await processPayment(repo, body.paymentId);
  return { ok: r.ok, credited: r.credited || 0, already: !!r.already, status: r.status || null };
});
