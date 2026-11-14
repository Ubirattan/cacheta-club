import { route } from '../../../lib/api.js';
import { buy, equip, dailyBonus, resgatarLivre } from '../../../lib/shop.js';
import { GameError } from '../../../lib/service.js';
export const dynamic = 'force-dynamic';
// body.op: buy | equip | bonus | resgatar
export const POST = route(({ user, body, repo }) => {
  if (body.op === 'buy') return buy(repo, user, body.item);
  if (body.op === 'equip') return equip(repo, user, body.item);
  if (body.op === 'resgatar') return resgatarLivre(repo, user, body.valor);
  if (body.op === 'bonus') return dailyBonus(repo, user);
  throw new GameError('Operação desconhecida');
}, { jrLivre: ['resgatar'] });
