// Ajuda para as rotas de API: confere quem está logado e devolve erros em português.
import { NextResponse } from 'next/server';
import { adminClient, repo } from './repo-supabase.js';
import { GameError } from './service.js';
import { avisarErro } from './alerta.js';
import { checarJogo } from './jogo-responsavel.js';

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

// Jogo responsável: quem está em autoexclusão ou passou do limite de tempo não gasta fichas.
// O repo de cada pedido confere isso antes de qualquer desconto de fichas do próprio cliente.
// jrLivre = ops que gastam fichas mas não são jogo (ex.: resgatar troféu); jrEntrada = confere já na entrada (mesas, torneio).
function repoDoPedido(user, op, jrLivre) {
  if (user.visitante || jrLivre.includes(op)) return repo;
  const r = Object.create(repo);
  r.adjustProfile = async (uid, coins, ...resto) => {
    if (uid === user.id && Number(coins) < 0) await checarJogo(repo, uid);
    return repo.adjustProfile(uid, coins, ...resto);
  };
  return r;
}

export function route(fn, { visitante = [], jrLivre = [], jrEntrada = false } = {}) {
  return async (req, ctx) => {
    try {
      let body = {};
      try { body = await req.json(); } catch { body = {}; }
      const semToken = !(req.headers.get('authorization') || '').startsWith('Bearer ');
      const user = semToken && visitante.includes(body.op || '') ? VISITANTE : await getUser(req);
      const params = ctx && ctx.params ? await ctx.params : {};
      if (!user.visitante && (jrEntrada === true || (Array.isArray(jrEntrada) && jrEntrada.includes(body.op || '')))) await checarJogo(repo, user.id);
      const out = await fn({ user, params, body, repo: repoDoPedido(user, body.op || '', jrLivre) });
      return NextResponse.json(out || { ok: true });
    } catch (e) {
      const status = e instanceof GameError ? e.status : 500;
      if (status === 500) {
        console.error(e);
        let onde = 'API'; try { onde = new URL(req.url).pathname; } catch {}
        await avisarErro(repo, onde, e);   // aviso no celular do admin
      }
      return NextResponse.json({ error: e instanceof GameError ? e.message : 'Erro no servidor, tente de novo' }, { status });
    }
  };
}
