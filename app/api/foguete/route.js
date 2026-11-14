import { route } from '../../../lib/api.js';
import { foguete } from '../../../lib/foguete-service.js';
export const dynamic = 'force-dynamic';
// POST /api/foguete  { op: 'estado' | 'apostar' | 'cancelar' | 'sacar', slot, valor, auto }
export const POST = route(({ user, body, repo }) => foguete(repo, user, body), { visitante: ['', 'estado'] });
