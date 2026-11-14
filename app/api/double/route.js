import { route } from '../../../lib/api.js';
import { double } from '../../../lib/double-service.js';
export const dynamic = 'force-dynamic';
// POST /api/double  { op: 'estado' | 'apostar', cor, valor }
export const POST = route(({ user, body, repo }) => double(repo, user, body), { visitante: ['', 'estado'] });
