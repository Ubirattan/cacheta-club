import { route } from '../../../lib/api.js';
import { girarOnca } from '../../../lib/onca-service.js';
export const dynamic = 'force-dynamic';
// POST /api/onca  { aposta }  -> { grade, linhas, cheia, mult, ganho, coins }
export const POST = route(({ user, body, repo }) => girarOnca(repo, user, body));
