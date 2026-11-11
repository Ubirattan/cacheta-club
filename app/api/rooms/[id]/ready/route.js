import { route } from '../../../../../lib/api.js';
import { setReady } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, params, body, repo }) => setReady(repo, user, params.id, !!body.ready));
