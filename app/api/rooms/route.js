import { route } from '../../../lib/api.js';
import { createRoom, joinRoom } from '../../../lib/service.js';
export const dynamic = 'force-dynamic';
// POST /api/rooms  -> cria sala   |  body.code -> entra pelo código
export const POST = route(({ user, body, repo }) =>
  body.code ? joinRoom(repo, user, { code: body.code }, body.password) : createRoom(repo, user, body), { jrEntrada: true });
