// Ajuda para as rotas de API: confere quem está logado e devolve erros em português.
import { NextResponse } from 'next/server';
import { adminClient, repo } from './repo-supabase.js';
import { GameError } from './service.js';

export async function getUser(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new GameError('Faça login para jogar', 401);
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw new GameError('Sessão expirada, entre de novo', 401);
  return data.user;
}

export function route(fn) {
  return async (req, ctx) => {
    try {
      const user = await getUser(req);
      const params = ctx && ctx.params ? await ctx.params : {};
      let body = {};
      try { body = await req.json(); } catch { body = {}; }
      const out = await fn({ user, params, body, repo });
      return NextResponse.json(out || { ok: true });
    } catch (e) {
      const status = e instanceof GameError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e instanceof GameError ? e.message : 'Erro no servidor, tente de novo' }, { status });
    }
  };
}
