import { route } from '../../../lib/api.js';
import { cobrarTreino } from '../../../lib/treino-service.js';
export const dynamic = 'force-dynamic';
// POST /api/treino  { jogo: 'cacheta' | 'truco' }  -> cobra 1 ficha pra começar uma partida contra o computador
export const POST = route(({ user, body, repo }) => cobrarTreino(repo, user, body));
