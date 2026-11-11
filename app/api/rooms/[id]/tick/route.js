import { route } from '../../../../../lib/api.js';
import { tick } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, params, repo }) => tick(repo, user, params.id));
