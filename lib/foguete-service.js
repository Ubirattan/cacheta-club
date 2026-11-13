// Foguetinho ao vivo: todo mundo vê a mesma rodada. O servidor sorteia onde o foguete explode
// (sem mostrar antes), confere o horário de cada saque e paga. As rodadas andam sozinhas
// sempre que alguém consulta o jogo (não precisa de nada rodando no fundo).
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { multEm, duracaoMs, sorteiaCrash, ganhoDe, APOSTAS_MS, PAUSA_MS, MIN_APOSTA, MAX_APOSTA, MAX_MULT } from './foguete.js';

const fail = (m, s) => { throw new GameError(m, s); };
const ms = d => new Date(d).getTime();
const sorteio = () => sorteiaCrash(randomInt(0, 2 ** 32) / 2 ** 32);

async function ultima(repo) {
  const [r] = await repo.sel('foguete_rodadas', {}, { order: ['num', false], limit: 1 });
  return r || null;
}
// rodada atual (cria a próxima quando a anterior acabou)
export async function rodadaAtual(repo, agora = Date.now(), sortear = sorteio) {
  const u = await ultima(repo);
  if (u && agora < ms(u.end_at) + PAUSA_MS) return u;
  const start = Math.max(agora, u ? ms(u.end_at) + PAUSA_MS : 0) + APOSTAS_MS;
  const crash = sortear();
  try {
    const [r] = await repo.ins('foguete_rodadas', { num: u ? Number(u.num) + 1 : 1, crash, start_at: new Date(start).toISOString(), end_at: new Date(start + duracaoMs(crash)).toISOString(), status: 'aberta' });
    return r;
  } catch { return ultima(repo); }   // outro pedido criou ao mesmo tempo
}
const fase = (r, agora) => agora < ms(r.start_at) ? 'apostas' : agora < ms(r.end_at) ? 'voando' : 'explodiu';

// fecha as rodadas que já explodiram: paga os saques automáticos e marca o resto como perdido
export async function liquidar(repo, agora = Date.now()) {
  const abertas = await repo.sel('foguete_rodadas', { status: 'aberta' });
  for (const r of abertas) {
    if (agora < ms(r.end_at)) continue;
    const moved = await repo.upd('foguete_rodadas', { id: r.id, status: 'aberta' }, { status: 'fechada' });
    if (!moved.length) continue;
    const crash = Number(r.crash);
    for (const a of await repo.sel('foguete_apostas', { rodada: r.id, status: 'aberta' })) {
      const auto = a.auto != null ? Number(a.auto) : null;
      if (auto && auto <= crash) {
        const g = ganhoDe(a.valor, auto);
        const ok = await repo.upd('foguete_apostas', { id: a.id, status: 'aberta' }, { status: 'sacou', mult: auto, ganho: g });
        if (ok.length) await repo.adjustProfile(a.user_id, g, 0, 0);
      } else await repo.upd('foguete_apostas', { id: a.id, status: 'aberta' }, { status: 'perdeu' });
    }
  }
}

export async function estado(repo, user, agora = Date.now()) {
  await liquidar(repo, agora);
  const r = await rodadaAtual(repo, agora);
  const f = fase(r, agora);
  const apostas = (await repo.sel('foguete_apostas', { rodada: r.id }, { order: ['valor', false], limit: 200 })).filter(a => a.status !== 'cancelada');
  const hist = await repo.sel('foguete_rodadas', { status: 'fechada' }, { order: ['num', false], limit: 25 });
  return {
    agora,
    rodada: { id: r.id, num: Number(r.num), start: ms(r.start_at), fase: f, ...(f === 'explodiu' ? { crash: Number(r.crash), fim: ms(r.end_at) } : {}) },
    apostas: apostas.slice(0, 60).map(a => ({ nick: a.nick, avatar: a.avatar, valor: a.valor, mult: a.status === 'sacou' ? Number(a.mult) : null, ganho: Number(a.ganho) || 0, perdeu: a.status === 'perdeu' })),
    total: apostas.length,
    minhas: apostas.filter(a => a.user_id === user.id).map(a => ({ slot: a.slot, valor: a.valor, auto: a.auto != null ? Number(a.auto) : null, status: a.status, mult: a.mult != null ? Number(a.mult) : null, ganho: Number(a.ganho) || 0 })),
    historico: hist.filter(h => h.id !== r.id).map(h => Number(h.crash)),
  };
}

export async function foguete(repo, user, b = {}, agora = Date.now()) {
  if (b.op === 'estado' || !b.op) return estado(repo, user, agora);
  const slot = Number(b.slot) === 2 ? 2 : 1;
  if (b.op === 'apostar') {
    await liquidar(repo, agora);
    const r = await rodadaAtual(repo, agora);
    if (fase(r, agora) !== 'apostas') fail('O foguete já decolou. Espere a próxima rodada');
    const valor = Math.floor(Number(b.valor));
    if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) fail(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
    let auto = b.auto == null || b.auto === '' ? null : Math.floor(Number(b.auto) * 100) / 100;
    if (auto != null && !(auto >= 1.01 && auto <= MAX_MULT)) fail(`O saque automático vai de 1.01x a ${MAX_MULT}x`);
    const p = await repo.getProfile(user.id);
    if (!p || p.blocked) fail('Conta bloqueada', 403);
    const [ja] = await repo.sel('foguete_apostas', { rodada: r.id, user_id: user.id, slot });
    if (ja && ja.status !== 'cancelada') fail('Você já apostou nesse lugar');
    const depois = await repo.adjustProfile(user.id, -valor, 0, 0);
    if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
    try {
      if (ja) {
        const ok = await repo.upd('foguete_apostas', { id: ja.id, status: 'cancelada' }, { valor, auto, status: 'aberta', mult: null, ganho: 0 });
        if (!ok.length) throw new Error('dup');
      } else await repo.ins('foguete_apostas', { rodada: r.id, user_id: user.id, slot, valor, auto, status: 'aberta', ganho: 0, nick: p.nickname, avatar: p.avatar });
    } catch { await repo.adjustProfile(user.id, valor, 0, 0); fail('Você já apostou nesse lugar'); }
    return { ok: true, coins: Array.isArray(depois) ? depois[0] : depois };
  }
  if (b.op === 'cancelar') {
    const r = await rodadaAtual(repo, agora);
    if (fase(r, agora) !== 'apostas') fail('O foguete já decolou');
    const [a] = await repo.sel('foguete_apostas', { rodada: r.id, user_id: user.id, slot });
    if (!a) fail('Aposta não encontrada');
    const ok = await repo.upd('foguete_apostas', { id: a.id, status: 'aberta' }, { status: 'cancelada' });
    if (!ok.length) fail('Aposta não encontrada');
    const c = await repo.adjustProfile(user.id, a.valor, 0, 0);
    return { ok: true, coins: Array.isArray(c) ? c[0] : c };
  }
  if (b.op === 'sacar') {
    const r = await rodadaAtual(repo, agora);
    if (fase(r, agora) !== 'voando') fail(fase(r, agora) === 'apostas' ? 'O foguete ainda não decolou' : 'Tarde demais, o foguete explodiu 💥');
    const [a] = await repo.sel('foguete_apostas', { rodada: r.id, user_id: user.id, slot });
    if (!a || a.status !== 'aberta') fail('Nada pra sacar');
    let mult = Math.min(multEm(agora - ms(r.start_at)), Number(r.crash));
    if (a.auto != null && Number(a.auto) <= mult) mult = Number(a.auto);
    const g = ganhoDe(a.valor, mult);
    const ok = await repo.upd('foguete_apostas', { id: a.id, status: 'aberta' }, { status: 'sacou', mult, ganho: g });
    if (!ok.length) fail('Nada pra sacar');
    const c = await repo.adjustProfile(user.id, g, 0, 0);
    return { ok: true, mult, ganho: g, coins: Array.isArray(c) ? c[0] : c };
  }
  fail('Ação inválida');
}
