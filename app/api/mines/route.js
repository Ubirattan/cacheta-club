import { route } from '../../../lib/api.js';
import { mines } from '../../../lib/mines-service.js';
export const dynamic = 'force-dynamic';
// POST /api/mines  { op: 'estado' | 'iniciar' | 'abrir' | 'sacar', valor, bombas, casa }
export const POST = route(({ user, body, repo }) => mines(repo, user, body));
