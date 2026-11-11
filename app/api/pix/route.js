// Jogador consulta ou troca a própria chave Pix
import { route } from '../../../lib/api.js';
import { GameError } from '../../../lib/service.js';
import { normPix } from '../../../lib/pix.js';
export const dynamic = 'force-dynamic';
export const POST = route(async ({ user, body, repo }) => {
  if (body.op === 'get') {
    const [r] = await repo.sel('user_private', { user_id: user.id });
    return { tipo: r?.pix_tipo || null, chave: r?.pix_chave || null };
  }
  let p; try { p = normPix(body.tipo, body.chave); } catch (e) { throw new GameError(e.message); }
  const row = { pix_tipo: p.tipo, pix_chave: p.chave, updated_at: new Date().toISOString() };
  const ex = await repo.sel('user_private', { user_id: user.id });
  if (ex.length) await repo.upd('user_private', { user_id: user.id }, row); else await repo.ins('user_private', { user_id: user.id, ...row });
  return { tipo: p.tipo, chave: p.chave };
});
