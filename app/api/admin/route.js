import { route } from '../../../lib/api.js';
import { adminOp } from '../../../lib/admin.js';
export const dynamic = 'force-dynamic';
export const POST = route(({ user, body, repo }) => adminOp(repo, user, body));
