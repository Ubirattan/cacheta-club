// Pacote de boas-vindas: elegível só quem nunca teve uma compra de fichas paga.
import { WELCOME, itemById } from './shop-items.js';

export async function welcomeOk(repo, uid) {
  const done = await repo.sel('purchases', { user_id: uid, status: 'done' });
  return !done.some(p => (p.coins || 0) > 0);
}
// depois do pagamento confirmado: entrega o avatar exclusivo do pacote
export async function grantExtras(repo, pur) {
  if (pur.item !== WELCOME.id) return;
  const it = itemById(WELCOME.avatarItem), p = await repo.getProfile(pur.user_id); if (!p || !it) return;
  const owned = Array.isArray(p.owned) ? p.owned : [];
  await repo.upd('profiles', { id: p.id }, { owned: owned.includes(it.id) ? owned : [...owned, it.id], avatar: it.em, equipped: { ...(p.equipped || {}), avatar: it.id } });
}
