import { route } from '../../../lib/api.js';
import { statusPromo } from '../../../lib/promo.js';
export const dynamic = 'force-dynamic';
// POST /api/promo → promoção do mês da cacheta (meta, ganhador, meus pontos). Visitante também vê.
export const POST = route(({ user, repo }) => statusPromo(repo, user), { visitante: ['', 'status'] });
