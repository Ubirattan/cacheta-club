// Double ao vivo: o servidor sorteia a casa (número aleatório seguro), só mostra o resultado quando a
// roleta começa a girar (as apostas já fecharam) e paga quem acertou a cor. As rodadas andam sozinhas
// sempre que alguém consulta o jogo, igual ao Foguetinho.
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { CASAS, CORES, APOSTAS_MS, GIRO_MS, PAUSA_MS, MIN_APOSTA, MAX_APOSTA, corDe, ganhoDe, faseDe } from './double.js';

const fail = (m, s) => { throw new GameError(m, s); };
const ms = d => new Date(d).getTime();
const saldo = c => c == null ? null : Number(Array.isArray(c) ? c[0] : c);
const sorteio = () => randomInt(0, CASAS);
const rod = r => ({ start: ms(r.start_at), fim: ms(r.end_at) });

async function ultima(repo) {
  const [r] = await repo.sel('double_rodadas', {}, { order: ['num', false], limit: 1 });
  return r || null;
}
export async function rodadaAtual(repo, agora = Date.now(), sortear = sorteio) {
  const u = await ultima(repo);
  if (u && agora < ms(u.end_at) + PAUSA_MS) return u;
  const start = Math.max(agora, u ? ms(u.end_at) + PAUSA_MS : 0) + APOSTAS_MS;
  try {
    const [r] = await repo.ins('double_rodadas', { num: u ? Number(u.num) + 1 : 1, resultado: sortear(), start_at: new Date(start).toISOString(), end_at: new Date(start + GIRO_MS).toISOString(), status: 'aberta' });
    return r;
  } catch { return ultima(repo); }    // outro pedido criou ao mesmo tempo
}

// paga as rodadas que já pararam de girar
export async function liquidar(repo, agora = Date.now()) {
  for (const r of await repo.sel('double_rodadas', { status: 'aberta' })) {
    if (agora < ms(r.end_at)) continue;
    const moved = await repo.upd('double_rodadas', { id: r.id, status: 'aberta' }, { status: 'fechada' });
    if (!moved.length) continue;
    const cor = corDe(Number(r.resultado));
    for (const a of await repo.sel('double_apostas', { rodada: r.id, status: 'aberta' })) {
      if (a.cor === cor) {
        const g = ganhoDe(a.valor, cor);
        const ok = await repo.upd('double_apostas', { id: a.id, status: 'aberta' }, { status: 'ganhou', ganho: g });
        if (ok.length) await repo.adjustProfile(a.user_id, g, 0, 0);
      } else await repo.upd('double_apostas', { id: a.id, status: 'aberta' }, { status: 'perdeu' });
    }
  }
}

export async function estado(repo, user, agora = Date.now()) {
  await liquidar(repo, agora);
  const r = await rodadaAtual(repo, agora);
  const f = faseDe(rod(r), agora);
  const apostas = await repo.sel('double_apostas', { rodada: r.id }, { order: ['valor', false], limit: 300 });
  const hist = await repo.sel('double_rodadas', { status: 'fechada' }, { order: ['num', false], limit: 21 });
  const totais = Object.fromEntries(CORES.map(c => { const l = apostas.filter(a => a.cor === c); return [c, { qtd: l.length, soma: l.reduce((t, a) => t + Number(a.valor), 0) }]; }));
  const p = await repo.getProfile(user.id);
  return {
    agora, coins: p ? saldo(p.coins) : null,
    rodada: { id: r.id, num: Number(r.num), start: ms(r.start_at), fim: ms(r.end_at), fase: f, ...(f !== 'apostas' ? { resultado: Number(r.resultado) } : {}) },
    totais,
    apostas: apostas.slice(0, 90).map(a => ({ nick: a.nick, avatar: a.avatar, cor: a.cor, valor: Number(a.valor), status: a.status, ganho: Number(a.ganho) || 0 })),
    minhas: apostas.filter(a => a.user_id === user.id).map(a => ({ cor: a.cor, valor: Number(a.valor), status: a.status, ganho: Number(a.ganho) || 0 })),
    historico: hist.filter(h => h.id !== r.id).slice(0, 20).map(h => Number(h.resultado)),
  };
}

export async function double(repo, user, b = {}, agora = Date.now()) {
  if (!b.op || b.op === 'estado') return estado(repo, user, agora);
  if (b.op === 'apostar') {
    await liquidar(repo, agora);
    const r = await rodadaAtual(repo, agora);
    if (faseDe(rod(r), agora) !== 'apostas') fail('A roleta já está girando. Espere a próxima rodada');
    const cor = CORES.includes(b.cor) ? b.cor : null;
    if (!cor) fail('Escolha vermelho, branco ou preto');
    const valor = Math.floor(Number(b.valor));
    if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) fail(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
    const p = await repo.getProfile(user.id);
    if (!p || p.blocked) fail('Conta bloqueada', 403);
    const [ja] = await repo.sel('double_apostas', { rodada: r.id, user_id: user.id, cor });
    if (ja && Number(ja.valor) + valor > MAX_APOSTA) fail(`No máximo ${MAX_APOSTA} fichas em cada cor`);
    const depois = await repo.adjustProfile(user.id, -valor, 0, 0);
    if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
    try {
      if (ja) {    // apostar de novo na mesma cor soma na aposta
        const ok = await repo.upd('double_apostas', { id: ja.id, status: 'aberta', valor: ja.valor }, { valor: Number(ja.valor) + valor });
        if (!ok.length) throw new Error('mudou');
      } else await repo.ins('double_apostas', { rodada: r.id, user_id: user.id, cor, valor, status: 'aberta', ganho: 0, nick: p.nickname, avatar: p.avatar });
    } catch { await repo.adjustProfile(user.id, valor, 0, 0); fail('Não deu pra apostar, tente de novo'); }
    return { ok: true, coins: saldo(depois) };
  }
  fail('Ação inválida');
}
