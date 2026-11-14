import { route } from '../../../lib/api.js';
import { futebol } from '../../../lib/futebol-service.js';
export const dynamic = 'force-dynamic';
// POST /api/futebol  { op: 'jogos' | 'apostar' | 'minhas', valor, selecoes: [{ jogo, mercado, escolha, odd }] }
export const POST = route(({ user, body, repo }) => futebol(repo, user, body), { visitante: ['', 'jogos', 'vivo'] });
