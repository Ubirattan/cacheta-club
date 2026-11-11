import { route } from '../../../lib/api.js';
import { buy, equip, dailyBonus } from '../../../lib/shop.js';
import { GameError } from '../../../lib/service.js';
export const dynamic = 'force-dynamic';
// body.op: buy | equip | bonus
export const POST = route(({ user, body, repo }) => {
  if (body.op === 'buy') return buy(repo, user, body.item);
  if (body.op === 'equip') return equip(repo, user, body.item);
  if (body.op === 'bonus') return dailyBonus(repo, user);
  throw new GameError('Operação desconhecida');
});
