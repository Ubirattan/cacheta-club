// Roleta ao vivo no servidor: sorteia com número aleatório seguro, só mostra o número quando a roda
// começa a girar (apostas fechadas) e paga quem acertou. As rodadas andam sozinhas sempre que alguém
// consulta o jogo (igual ao Double e ao Foguetinho).
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { conferir, pagar, MAX_APOSTA } from './roleta.js';
import { APOSTAS_MS, GIRO_MS, PAUSA_MS, faseDe } from './roleta-vivo.js';
import { registrarJogada } from './relatorio.js';

const fail = (m, s) => { throw new GameError(m, s); };
const ms = d => new Date(d).getTime();
const saldo = c => c == null ? null : Number(Array.isArray(c) ? c[0] : c);
const sorteio = () => randomInt(0, 37);
const rod = r => ({ start: ms(r.start_at), fim: ms(r.end_at) });
const R = 'roleta_vivo_rodadas', A = 'roleta_vivo_apostas';

async function ultima(repo) { const [r] = await repo.sel(R, {}, { order: ['num', false], limit: 1 }); return r || null; }
export async function rodadaAtual(repo, agora = Date.now(), sortear = sorteio) {
  const u = await ultima(repo);
  if (u && agora < ms(u.end_at) + PAUSA_MS) return u;
  const start = Math.max(agora, u ? ms(u.end_at) + PAUSA_MS : 0) + APOSTAS_MS;
  try {
    const [r] = await repo.ins(R, { num: u ? Number(u.num) + 1 : 1, resultado: sortear(), start_at: new Date(start).toISOString(), end_at: new Date(start + GIRO_MS).toISOString(), status: 'aberta' });
    return r;
  } catch { return ultima(repo); }   // outro pedido criou ao mesmo tempo
}

// paga as rodadas que já pararam de girar
export async function liquidar(repo, agora = Date.now()) {
  for (const r of await repo.sel(R, { status: 'aberta' })) {
    if (agora < ms(r.end_at)) continue;
    const moved = await repo.upd(R, { id: r.id, status: 'aberta' }, { status: 'fechada' });
    if (!moved.length) continue;
    const n = Number(r.resultado);
    for (const a of await repo.sel(A, { rodada: r.id, status: 'aberta' })) {
      const { volta } = pagar(a.apostas || {}, n);
      const ok = await repo.upd(A, { id: a.id, status: 'aberta' }, { status: volta ? 'ganhou' : 'perdeu', ganho: volta });
      if (ok.length && volta) await repo.adjustProfile(a.user_id, volta, 0, 0);
      if (ok.length) await registrarJogada(repo, 'roleta-vivo', a.user_id, a.valor, volta);
    }
  }
}

export async function estado(repo, user, agora = Date.now()) {
  await liquidar(repo, agora);
  const r = await rodadaAtual(repo, agora);
  const f = faseDe(rod(r), agora);
  const apostas = await repo.sel(A, { rodada: r.id }, { order: ['valor', false], limit: 300 });
  const hist = await repo.sel(R, { status: 'fechada' }, { order: ['num', false], limit: 16 });
  const p = await repo.getProfile(user.id);
  const minha = apostas.find(a => a.user_id === user.id);
  return {
    agora, coins: p ? saldo(p.coins) : null,
    rodada: { id: r.id, num: Number(r.num), start: ms(r.start_at), fim: ms(r.end_at), fase: f, ...(f !== 'apostas' ? { resultado: Number(r.resultado) } : {}) },
    jogadores: apostas.length, total: apostas.reduce((t, a) => t + Number(a.valor), 0),
    apostas: apostas.slice(0, 60).map(a => ({ nick: a.nick, avatar: a.avatar, valor: Number(a.valor), status: a.status, ganho: Number(a.ganho) || 0 })),
    minha: minha ? { apostas: minha.apostas, valor: Number(minha.valor), status: minha.status, ganho: Number(minha.ganho) || 0 } : null,
    historico: hist.filter(h => h.id !== r.id).slice(0, 15).map(h => Number(h.resultado)),
  };
}

export async function roletaVivo(repo, user, b = {}, agora = Date.now()) {
  if (!b.op || b.op === 'estado') return estado(repo, user, agora);
  if (b.op === 'apostar') {
    await liquidar(repo, agora);
    const r = await rodadaAtual(repo, agora);
    if (faseDe(rod(r), agora) !== 'apostas') fail('A roleta já está girando. Espere a próxima rodada');
    const c = conferir(b.apostas);
    if (c.erro) fail(c.erro);
    const p = await repo.getProfile(user.id);
    if (!p || p.blocked) fail('Conta bloqueada', 403);
    const [ja] = await repo.sel(A, { rodada: r.id, user_id: user.id });
    const soma = { ...(ja?.apostas || {}) };
    for (const [k, v] of Object.entries(c.apostas)) soma[k] = (soma[k] || 0) + v;
    const total = (ja ? Number(ja.valor) : 0) + c.total;
    if (total > MAX_APOSTA) fail(`No máximo ${MAX_APOSTA} fichas por rodada (você já apostou ${ja ? ja.valor : 0})`);
    const depois = await repo.adjustProfile(user.id, -c.total, 0, 0);
    if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
    try {
      if (ja) {   // apostar de novo na mesma rodada soma
        const ok = await repo.upd(A, { id: ja.id, status: 'aberta', valor: ja.valor }, { apostas: soma, valor: total });
        if (!ok.length) throw new Error('mudou');
      } else await repo.ins(A, { rodada: r.id, user_id: user.id, apostas: soma, valor: total, status: 'aberta', ganho: 0, nick: p.nickname, avatar: p.avatar });
    } catch { await repo.adjustProfile(user.id, c.total, 0, 0); fail('Não deu pra apostar, tente de novo'); }
    return { ok: true, coins: saldo(depois), minha: { apostas: soma, valor: total } };
  }
  fail('Ação inválida');
}
