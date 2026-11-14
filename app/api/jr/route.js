import { route } from '../../../lib/api.js';
import { jogoResponsavel } from '../../../lib/jogo-responsavel.js';
export const dynamic = 'force-dynamic';
// POST /api/jr  { op: 'status' | 'limites' | 'excluir' | 'ping', deposito: { dia, semana, mes }, tempo, dias }
export const POST = route(({ user, body, repo }) => jogoResponsavel(repo, user, body), { jrLivre: ['status', 'limites', 'excluir', 'ping', ''] });
