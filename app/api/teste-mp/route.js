import { route } from '../../../lib/api.js';
import { testeMp } from '../../../lib/teste-mp.js';
export const dynamic = 'force-dynamic';
// POST /api/teste-mp  { op: 'pix' | 'pro' | 'status' | 'reembolsar', valor, email, id }  (só admin)
export const POST = route(({ user, body, repo }) => testeMp(repo, user, body));
