// Indique um amigo: o amigo se cadastra pelo link de quem indicou e,
// quando ele fizer o primeiro depósito de R$ 10 ou mais, quem indicou ganha 10 fichas (uma vez por amigo).
import { PREMIO_INDICACAO, DEPOSITO_MIN, META_INDICACAO, BONUS_META } from './indicacao-regras.js';
export { PREMIO_INDICACAO, DEPOSITO_MIN, META_INDICACAO, BONUS_META };
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
  await bonusMeta(repo, ind.indicador);
  return ind.indicador;
}

// chegou em 50 indicados que depositaram: +300 fichas, uma vez só por jogador (a chave no banco é única)
export async function bonusMeta(repo, indicador, notificar = null) {
  try {
    const feitos = (await repo.sel('indicacoes', { indicador, pago: true })).length;
    if (feitos < META_INDICACAO) return false;
    const key = 'ind_meta_' + indicador;
    if ((await repo.sel('app_settings', { key })).length) return false;
    try { await repo.ins('app_settings', { key, value: { em: Date.now(), feitos } }); } catch { return false; }
    await repo.adjustProfile(indicador, BONUS_META, 0, 0);
    const p = await repo.getProfile(indicador);
    const avisa = notificar || (await import('./push.js')).notifyAdmins;
    await avisa(repo, '🤝 Meta de indicação', `${p ? p.nickname : 'Jogador'} chegou em ${feitos} amigos e ganhou ${BONUS_META} fichas`);
    return true;
  } catch (e) { console.error('meta indicação:', e?.message); return false; }
}
