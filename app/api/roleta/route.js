import { route } from '../../../lib/api.js';
import { girar } from '../../../lib/roleta-service.js';
export const dynamic = 'force-dynamic';
// POST /api/roleta  { apostas: { chave: fichas } }  -> { numero, apostado, volta, ganhas, coins }
export const POST = route(({ user, body, repo }) => girar(repo, user, body));
