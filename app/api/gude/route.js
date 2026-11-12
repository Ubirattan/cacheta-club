import { route } from '../../../lib/api.js';
import { gudeBot } from '../../../lib/gude-service.js';
export const dynamic = 'force-dynamic';
// POST /api/gude  { op: 'start' | 'shot' | 'state' | 'quit' }  -> gude contra o computador, valendo 1 ficha
export const POST = route(({ user, body, repo }) => gudeBot(repo, user, body));
