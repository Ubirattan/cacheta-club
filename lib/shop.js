// Loja: comprar e usar itens com fichas virtuais, VIP e bônus diário.
import { GameError, getSettings, isVip } from './service.js';
import { itemById } from './shop-items.js';
const fail = (m, s) => { throw new GameError(m, s); };

export async function buy(repo, user, itemId) {
  const item = itemById(itemId); if (!item || item.price <= 0) fail('Item indisponível');
  const p = await repo.getProfile(user.id); if (!p || p.blocked) fail('Conta bloqueada', 403);
  const owned = Array.isArray(p.owned) ? p.owned : [];
  if (item.slot !== 'vip' && owned.includes(item.id)) fail('Você já tem esse item');
  if ((await repo.adjustProfile(user.id, -item.price, 0, 0)) == null) fail('Fichas insuficientes');
  if (item.slot === 'vip') {
    const base = isVip(p) ? new Date(p.vip_until).getTime() : Date.now();
    await repo.upd('profiles', { id: user.id }, { vip_until: new Date(base + 30 * 86400000).toISOString() });
  } else {
    await repo.upd('profiles', { id: user.id }, { owned: [...owned, item.id], equipped: { ...(p.equipped || {}), [item.slot]: item.id } });
  }
  await repo.ins('purchases', { user_id: user.id, item: item.id, price_coins: item.price });
  return { ok: true };
}

export async function equip(repo, user, itemId) {
  const item = itemById(itemId); if (!item || item.slot === 'vip') fail('Item inválido');
  const p = await repo.getProfile(user.id);
  const owned = Array.isArray(p.owned) ? p.owned : [];
  if (item.vipOnly ? !isVip(p) : (item.price > 0 && !owned.includes(item.id))) fail(item.vipOnly ? 'Item exclusivo VIP' : 'Compre o item primeiro');
  await repo.upd('profiles', { id: user.id }, { equipped: { ...(p.equipped || {}), [item.slot]: item.id } });
  return { ok: true };
}

const BONUS_GAP = 20 * 3600 * 1000;
export async function dailyBonus(repo, user) {
  const p = await repo.getProfile(user.id); if (!p || p.blocked) fail('Conta bloqueada', 403);
  const last = p.last_bonus ? new Date(p.last_bonus).getTime() : 0;
  if (Date.now() - last < BONUS_GAP) {
    const h = Math.ceil((BONUS_GAP - (Date.now() - last)) / 3600000);
    fail(`Você já pegou o bônus de hoje. Volte em ${h} h.`);
  }
  const st = await getSettings(repo);
  const amount = Number(st.daily_bonus || 0) * (isVip(p) ? 2 : 1);
  await repo.upd('profiles', { id: user.id }, { last_bonus: new Date().toISOString() });
  await repo.adjustProfile(user.id, amount, 0, 0);
  return { ok: true, amount };
}
