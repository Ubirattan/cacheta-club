import { route } from '../../../../../lib/api.js';
import { watchRoom } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
// assistir a mesa: estado público + chat (só leitura), sem sentar
export const POST = route(({ user, params, repo }) => watchRoom(repo, user, params.id));
