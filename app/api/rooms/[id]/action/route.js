import { route } from '../../../../../lib/api.js';
import { act } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, params, body, repo }) => act(repo, user, params.id, body));
