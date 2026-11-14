import { route } from '../../../lib/api.js';
import { roletaVivo } from '../../../lib/roleta-vivo-service.js';
export const dynamic = 'force-dynamic';
// POST /api/roleta-vivo  { op: 'estado' | 'apostar', apostas: { chave: fichas } }
export const POST = route(({ user, body, repo }) => roletaVivo(repo, user, body), { visitante: ['', 'estado'] });
