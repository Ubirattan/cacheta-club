// Jogo do bicho no servidor: sorteios em horários fixos (lib/bicho.js), os 5 prêmios só são
// sorteados (número aleatório seguro) depois da hora do sorteio, e quem acertou é pago na hora.
// Os sorteios andam sozinhos sempre que alguém abre o jogo (igual à roleta ao vivo).
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { conferir, ganho, proximoSorteio, sorteiosDoDia, chaveDe, FECHA_ANTES_MS, MAX_POR_SORTEIO } from './bicho.js';
import { registrarJogada } from './relatorio.js';

const fail = (m, s) => { throw new GameError(m, s); };
const ms = d => new Date(d).getTime();
const saldo = c => c == null ? null : Number(Array.isArray(c) ? c[0] : c);
const S = 'bicho_sorteios', A = 'bicho_apostas';
const sortear = () => Array.from({ length: 5 }, () => randomInt(0, 10000));

async function garantir(repo, t) {
  const chave = chaveDe(t);
  const [s] = await repo.sel(S, { chave });
  if (s) return s;
  try { const [n] = await repo.ins(S, { chave, hora_at: new Date(t).toISOString(), status: 'aberta' }); return n; }
  catch { const [x] = await repo.sel(S, { chave }); return x; }   // outro pedido criou ao mesmo tempo
}

// sorteia e paga os sorteios que já passaram da hora
export async function liquidar(repo, agora = Date.now(), sorteio = sortear) {
  for (const s of await repo.sel(S, { status: 'aberta' })) {
    if (agora < ms(s.hora_at)) continue;
    const premios = sorteio();
    const moved = await repo.upd(S, { id: s.id, status: 'aberta' }, { status: 'fechada', premios });
    if (!moved.length) continue;
    for (const a of await repo.sel(A, { sorteio: s.id, status: 'aberta' })) {
      const g = ganho(a, premios);
      const ok = await repo.upd(A, { id: a.id, status: 'aberta' }, { status: g ? 'ganhou' : 'perdeu', ganho: g });
      if (ok.length && g) await repo.adjustProfile(a.user_id, g, 0, 0);
      if (ok.length) await registrarJogada(repo, 'bicho', a.user_id, a.valor, g);
    }
  }
}

export async function estado(repo, user, agora = Date.now()) {
  for (const t of sorteiosDoDia(agora)) await garantir(repo, t);   // o dia todo aparece nos resultados
  await liquidar(repo, agora);
  const t = proximoSorteio(agora), prox = await garantir(repo, t);
  const fechados = await repo.sel(S, { status: 'fechada' }, { order: ['hora_at', false], limit: 10 });
  const p = user.visitante ? null : await repo.getProfile(user.id);
  const minhas = user.visitante ? [] : await repo.sel(A, { user_id: user.id }, { order: ['created_at', false], limit: 30 });
  const porId = Object.fromEntries([...fechados, prox].map(s => [s.id, s]));
  return {
    agora, coins: p ? saldo(p.coins) : null,
    proximo: { id: prox.id, hora: t, fecha: t - FECHA_ANTES_MS },
    resultados: fechados.map(s => ({ id: s.id, hora: ms(s.hora_at), premios: (s.premios || []).map(Number) })),
    minhas: minhas.map(a => ({ id: a.id, tipo: a.tipo, palpite: a.palpite, pos: a.pos, valor: Number(a.valor), status: a.status, ganho: Number(a.ganho) || 0,
      hora: porId[a.sorteio] ? ms(porId[a.sorteio].hora_at) : ms(a.hora_at || a.created_at) })),
  };
}

export async function jogoDoBicho(repo, user, b = {}, agora = Date.now()) {
  if (!b.op || b.op === 'estado') return estado(repo, user, agora);
  if (b.op === 'apostar') {
    await liquidar(repo, agora);
    const t = proximoSorteio(agora), s = await garantir(repo, t);
    if (agora >= t - FECHA_ANTES_MS) fail('As apostas desse sorteio já fecharam');
    const c = conferir(b.aposta);
    if (c.erro) fail(c.erro);
    const p = await repo.getProfile(user.id);
    if (!p || p.blocked) fail('Conta bloqueada', 403);
    const ja = (await repo.sel(A, { sorteio: s.id, user_id: user.id })).reduce((x, a) => x + Number(a.valor), 0);
    if (ja + c.valor > MAX_POR_SORTEIO) fail(`No máximo ${MAX_POR_SORTEIO} fichas por sorteio (você já apostou ${ja})`);
    const depois = await repo.adjustProfile(user.id, -c.valor, 0, 0);
    if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
    try { await repo.ins(A, { sorteio: s.id, hora_at: new Date(t).toISOString(), user_id: user.id, ...c, status: 'aberta', ganho: 0, nick: p.nickname, avatar: p.avatar }); }
    catch { await repo.adjustProfile(user.id, c.valor, 0, 0); fail('Não deu pra apostar, tente de novo'); }
    return { ok: true, coins: saldo(depois) };
  }
  fail('Ação inválida');
}
