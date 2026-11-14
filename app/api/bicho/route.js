import { route } from '../../../lib/api.js';
import { jogoDoBicho } from '../../../lib/bicho-service.js';
export const dynamic = 'force-dynamic';
// POST /api/bicho  { op: 'estado' | 'apostar', aposta: { tipo, palpite, pos, valor } }
export const POST = route(({ user, body, repo }) => jogoDoBicho(repo, user, body), { visitante: ['', 'estado'] });
