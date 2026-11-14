// Ajuda para as rotas de API: confere quem está logado e devolve erros em português.
import { NextResponse } from 'next/server';
import { adminClient, repo } from './repo-supabase.js';
import { GameError } from './service.js';

export async function getUser(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new GameError('Faça login para jogar', 401);
  // guarda por 60 s quem é o dono do token: as jogadas seguidas não esperam o Supabase conferir de novo
  const hit = userCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw new GameError('Sessão expirada, entre de novo', 401);
  if (userCache.size > 500) userCache.clear();
  userCache.set(token, { user: data.user, until: Date.now() + 60000 });
  return data.user;
}
const userCache = new Map();

// Visitante sem conta: só pode OLHAR (ops listadas em `visitante`, ex.: ver jogos e odds).
// Usa um id que não existe no banco, então não tem saldo nem apostas.
export const VISITANTE = { id: '00000000-0000-0000-0000-000000000000', visitante: true };

export function route(fn, { visitante = [] } = {}) {
  return async (req, ctx) => {
    try {
      let body = {};
      try { body = await req.json(); } catch { body = {}; }
      const semToken = !(req.headers.get('authorization') || '').startsWith('Bearer ');
      const user = semToken && visitante.includes(body.op || '') ? VISITANTE : await getUser(req);
      const params = ctx && ctx.params ? await ctx.params : {};
      const out = await fn({ user, params, body, repo });
      return NextResponse.json(out || { ok: true });
    } catch (e) {
      const status = e instanceof GameError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e instanceof GameError ? e.message : 'Erro no servidor, tente de novo' }, { status });
    }
  };
}
