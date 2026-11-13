// Indique um amigo: o amigo se cadastra pelo link de quem indicou e,
// quando ele fizer o primeiro depósito de R$ 10 ou mais, quem indicou ganha 10 fichas (uma vez por amigo).
export const PREMIO_INDICACAO = 10, DEPOSITO_MIN = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// no cadastro: guarda quem indicou (só se a conta existir e não for a própria)
export async function registrarIndicacao(repo, indicado, indicador) {
  indicador = String(indicador || '').trim().toLowerCase();
  if (!indicado || !UUID.test(indicador) || indicador === indicado) return false;
  const [ja] = await repo.sel('indicacoes', { indicado });
  if (ja) return false;
  if (!(await repo.getProfile(indicador))) return false;
  await repo.ins('indicacoes', { indicado, indicador, pago: false });
  return true;
}

// depois de um depósito aprovado: paga quem indicou, uma vez só
export async function pagarIndicacao(repo, pur) {
  if (!pur || Number(pur.price_brl || 0) < DEPOSITO_MIN) return null;
  const [ind] = await repo.sel('indicacoes', { indicado: pur.user_id, pago: false });
  if (!ind) return null;
  const moved = await repo.upd('indicacoes', { indicado: pur.user_id, pago: false }, { pago: true, paid_at: new Date().toISOString() });
  if (!moved.length) return null;
  await repo.adjustProfile(ind.indicador, PREMIO_INDICACAO, 0, 0);
  return ind.indicador;
}
