import { route } from '../../../../../lib/api.js';
import { leaveRoom } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, params, repo }) => leaveRoom(repo, user, params.id));
