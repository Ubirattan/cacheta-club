import { route } from '../../../../../lib/api.js';
import { joinRoom } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, params, body, repo }) => joinRoom(repo, user, { id: params.id }, body.password), { jrEntrada: true });
