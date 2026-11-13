// Apostas de futebol no servidor. Os jogos, as odds e os resultados vêm da API-Football e ficam
// guardados no Supabase. A atualização acontece sozinha quando alguém abre o futebol (como o
// Foguetinho), sem nada rodando no fundo, e conta as chamadas pra caber no plano da API.
import { GameError } from './service-error.js';
import { chamarApi, temChave } from './futebol-api.js';
import { LIGAS, MIN_APOSTA, MAX_APOSTA, FECHA_ANTES_MS, FIM, CANCELADO, NO_JOGO, ESTATISTICA, lerJogo, lerOdds, conferirBilhete, premioDe, fechar, diaBR, situacao, antecipa, cashOut, r2 } from './futebol.js';

const fail = (m, s) => { throw new GameError(m, s); };
const saldo = c => (c == null ? null : Number(Array.isArray(c) ? c[0] : c));
const MIN = 60 * 1000, H = 60 * MIN;
let chamar = chamarApi;
export const usarApi = fn => { chamar = fn || chamarApi; };   // os testes trocam pela API de mentira

export const CFG = {
  ligas: () => { const v = (process.env.FUTEBOL_LIGAS || '').split(',').map(Number).filter(Boolean); return v.length ? v : LIGAS.map(l => l[0]); },
  limiteEnv: () => Number(process.env.FUTEBOL_LIMITE_DIA) || 0,
  margemCashout: () => { const v = Number(process.env.FUTEBOL_CASHOUT_MARGEM); return v >= 0 && v < 0.5 ? v : 0.08; },
  corte: () => Math.min(0.3, Math.max(0, Number(process.env.FUTEBOL_CORTE) || 0)),
};
const JOGOS_CADA = 6 * H, ODDS_CADA = 3 * MIN, RESULT_CADA = 8 * MIN, VIVO_CADA = 50 * 1000;
const ODDS_JANELA = 48 * H, ODDS_SEM = 3 * H;
// plano grátis (100/dia) x Pro (7.500/dia): o Pro busca mais odds, mais dias e acompanha o placar ao vivo
const PLANO = pro => pro
  ? { oddsPorVez: 20, oddsVelha: 3 * H, dias: [0, 1, 2], reserva: 1500 }
  : { oddsPorVez: 5, oddsVelha: 24 * H, dias: [0, 1], reserva: 25 };
const DURACAO = 115 * MIN;              // depois disso o jogo já deve ter acabado

// ---------- controle: quem atualiza, quando, e quantas chamadas já foram hoje ----------
async function linha(repo, chave) { const [r] = await repo.sel('futebol_sync', { chave }); return r || null; }
async function pegar(repo, chave, intervalo, agora) {
  const r = await linha(repo, chave);
  if (!r) { try { await repo.ins('futebol_sync', { chave, v: 1, em: agora, valor: null }); return true; } catch { return false; } }
  if (agora - Number(r.em) < intervalo) return false;
  const ok = await repo.upd('futebol_sync', { chave, v: r.v }, { v: r.v + 1, em: agora });
  return ok.length > 0;
}
async function guardar(repo, chave, valor, agora) {
  const r = await linha(repo, chave);
  if (r) await repo.upd('futebol_sync', { chave }, { valor, em: agora });
  else { try { await repo.ins('futebol_sync', { chave, v: 1, em: agora, valor }); } catch {} }
}
async function cota(repo, agora) {
  const r = await linha(repo, 'cota'), d = diaBR(agora), v = r?.valor || {};
  const plano = Number(v.lim) || 100;                       // a API conta o tamanho do plano em cada resposta
  return { n: v.dia === d ? Number(v.n) || 0 : 0, lim: CFG.limiteEnv() || Math.max(10, plano - 5), plano, pro: plano >= 1000 };
}
const usadas = async (repo, agora) => (await cota(repo, agora)).n;
// várias chamadas ao mesmo tempo (a tela não fica esperando uma de cada vez). Devolve só as que couberam na cota.
async function apiLote(repo, agora, pedidos, reserva = 0) {
  const c = await cota(repo, agora), k = Math.max(0, Math.min(pedidos.length, c.lim - reserva - c.n));
  if (!k) return [];
  await guardar(repo, 'cota', { dia: diaBR(agora), n: c.n + k, lim: c.plano }, agora);
  const rs = await Promise.allSettled(pedidos.slice(0, k).map(([cam, p]) => chamar(cam, p)));
  const out = rs.map(r => r.status === 'fulfilled' ? r.value : null), erro = rs.find(r => r.status === 'rejected');
  const lim = out.find(r => r?.limite)?.limite;
  if (lim && lim !== c.plano) { const c2 = await cota(repo, agora); await guardar(repo, 'cota', { dia: diaBR(agora), n: c2.n, lim }, agora); }
  return Object.assign(out, { erro: erro ? erro.reason : null });
}

// ---------- tarefas ----------
async function atualizarJogos(repo, agora) {
  const ligas = new Set(CFG.ligas()), linhas = [], P = PLANO((await cota(repo, agora)).pro);
  const rs = await apiLote(repo, agora, P.dias.map(k => ['fixtures', { date: diaBR(agora + k * 24 * H), timezone: 'America/Sao_Paulo' }]), P.reserva);
  for (const r of rs) for (const f of r || []) if (ligas.has(f.league?.id)) linhas.push(lerJogo(f));
  if (linhas.length) await repo.ups('futebol_jogos', linhas.map(l => ({ ...l, atualizado: new Date(agora).toISOString() })));
  // jogos velhos que nunca tiveram resultado (sem aposta) saem da tabela
  await repo.delAntes('futebol_jogos', { status: 'NS' }, 'inicio', new Date(agora - 3 * 24 * H).toISOString());
  if (rs.erro) throw rs.erro;
}

async function atualizarOdds(repo, agora) {
  const P = PLANO((await cota(repo, agora)).pro);
  const jogos = (await repo.sel('futebol_jogos', { status: 'NS' }))
    .filter(j => { const t = Date.parse(j.inicio); return t > agora + FECHA_ANTES_MS && t - agora < ODDS_JANELA; })
    .filter(j => !j.odds_em || agora - Number(j.odds_em) > (j.odds ? P.oddsVelha : ODDS_SEM))
    .sort((a, b) => (a.odds ? 1 : 0) - (b.odds ? 1 : 0) || Date.parse(a.inicio) - Date.parse(b.inicio))
    .slice(0, P.oddsPorVez);
  const rs = await apiLote(repo, agora, jogos.map(j => ['odds', { fixture: j.id }]), P.reserva);
  await Promise.all(rs.map((r, i) => r && repo.upd('futebol_jogos', { id: jogos[i].id }, { odds: lerOdds(r[0], CFG.corte()) || jogos[i].odds || null, odds_em: agora })));
  if (rs.erro) throw rs.erro;
}

async function atualizarResultados(repo, agora) {
  const abertas = await repo.sel('futebol_apostas', { status: 'aberta' });
  const ids = [...new Set(abertas.flatMap(a => a.selecoes.map(s => Number(s.jogo))))];
  if (!ids.length) return;
  const tem = new Map((await repo.selIn('futebol_jogos', 'id', ids)).map(j => [Number(j.id), j]));
  const falta = ids.filter(id => {
    const j = tem.get(id);
    if (!j) return true;
    if (FIM.includes(j.status) || CANCELADO.includes(j.status)) return false;
    return agora > Date.parse(j.inicio) + DURACAO;
  });
  const lotes = [];
  for (let i = 0; i < falta.length && lotes.length < 5; i += 20) lotes.push(['fixtures', { ids: falta.slice(i, i + 20).join('-'), timezone: 'America/Sao_Paulo' }]);
  const rs = await apiLote(repo, agora, lotes);
  const linhas = rs.flatMap(r => r || []).map(f => ({ ...lerJogo(f), atualizado: new Date(agora).toISOString() }));
  if (linhas.length) await repo.ups('futebol_jogos', linhas);
  if (rs.erro) throw rs.erro;
  // escanteios e cartões: estatísticas dos jogos encerrados que têm esse tipo de palpite em aberto
  const precisa = new Set(abertas.flatMap(a => a.selecoes.filter(x => !x.status && ESTATISTICA.includes(x.mercado)).map(x => Number(x.jogo))));
  if (!precisa.size) return;
  const agoraJ = new Map((await repo.selIn('futebol_jogos', 'id', [...precisa])).map(j => [Number(j.id), j]));
  const sem = [...precisa].filter(id => { const j = agoraJ.get(id); return j && j.status === 'FT' && (j.escanteios == null || j.cartoes == null); }).slice(0, 20);
  const st = await apiLote(repo, agora, sem.map(id => ['fixtures/statistics', { fixture: id }]));
  await Promise.all(st.map((r, i) => {
    if (!r || !r.length) return null;
    const tot = tipo => r.reduce((n, t) => n + (Number((t.statistics || []).find(x => tipo.test(x.type))?.value) || 0), 0);
    return repo.upd('futebol_jogos', { id: sem[i] }, { escanteios: tot(/^corner/i), cartoes: tot(/yellow card/i) + tot(/red card/i) });
  }));
  if (st.erro) throw st.erro;
}

// placar ao vivo (só no plano Pro): a cada ~1 min, jogos com aposta que estão rolando
async function atualizarAoVivo(repo, agora) {
  if (!(await cota(repo, agora)).pro) return;
  const abertas = await repo.sel('futebol_apostas', { status: 'aberta' });
  const ids = [...new Set(abertas.flatMap(a => a.selecoes.filter(x => !x.status).map(x => Number(x.jogo))))];
  if (!ids.length) return;
  const vivos = (await repo.selIn('futebol_jogos', 'id', ids)).filter(j => {
    const t = Date.parse(j.inicio);
    return !FIM.includes(j.status) && !CANCELADO.includes(j.status) && agora >= t - 2 * MIN && agora < t + 4 * H;
  }).map(j => Number(j.id));
  const lotes = [];
  for (let i = 0; i < vivos.length && lotes.length < 5; i += 20) lotes.push(['fixtures', { ids: vivos.slice(i, i + 20).join('-'), timezone: 'America/Sao_Paulo' }]);
  const rs = await apiLote(repo, agora, lotes);
  const linhas = rs.flatMap(r => r || []).map(f => ({ ...lerJogo(f), atualizado: new Date(agora).toISOString() }));
  if (linhas.length) await repo.ups('futebol_jogos', linhas);
  if (rs.erro) throw rs.erro;
}

// paga os bilhetes que já têm resultado
export async function liquidar(repo, agora = Date.now(), so = null) {
  const abertas = (await repo.sel('futebol_apostas', so ? { status: 'aberta', user_id: so } : { status: 'aberta' }));
  if (!abertas.length) return;
  const ids = [...new Set(abertas.flatMap(a => a.selecoes.map(s => Number(s.jogo))))];
  const jogos = Object.fromEntries((await repo.selIn('futebol_jogos', 'id', ids)).map(j => [Number(j.id), j]));
  for (const a of abertas) {
    // pagamento antecipado: o time abriu 2 gols, esse palpite já conta como ganho
    if (a.selecoes.some(x => !x.status && antecipa(x, jogos[Number(x.jogo)]))) {
      const sels = a.selecoes.map(x => !x.status && antecipa(x, jogos[Number(x.jogo)])
        ? { ...x, status: 'ganhou', antecipado: true, placar: [Number(jogos[x.jogo].ao_vivo_casa), Number(jogos[x.jogo].ao_vivo_fora)] } : x);
      const ok = await repo.upd('futebol_apostas', { id: a.id, status: 'aberta' }, { selecoes: sels });
      if (!ok.length) continue;
      a.selecoes = sels;
    }
    const f = fechar(a, jogos, agora);
    if (!f) continue;
    const ok = await repo.upd('futebol_apostas', { id: a.id, status: 'aberta' }, { status: f.status, ganho: f.ganho, selecoes: f.selecoes, liquidada_em: new Date(agora).toISOString() });
    if (ok.length && f.ganho > 0) await repo.adjustProfile(a.user_id, f.ganho, 0, 0);
  }
}

// roda o que estiver na hora. Erros da API ficam guardados (o admin vê) e não travam a tela.
export async function sincronizar(repo, agora = Date.now()) {
  if (!temChave()) return 0;
  let rodou = 0;
  const passos = [['aovivo', VIVO_CADA, atualizarAoVivo], ['jogos', JOGOS_CADA, atualizarJogos], ['odds', ODDS_CADA, atualizarOdds], ['resultados', RESULT_CADA, atualizarResultados]];
  for (const [chave, cada, fn] of passos) {
    try {
      if (!(await pegar(repo, chave, cada, agora))) continue;
      rodou++;
      await fn(repo, agora);
      const e = await linha(repo, 'erro');
      if (e?.valor?.passo === chave) await guardar(repo, 'erro', null, agora);     // voltou a funcionar
    }
    catch (e) { await guardar(repo, 'erro', { msg: String(e.message || e).slice(0, 300), passo: chave }, agora).catch(() => {}); }
  }
  await liquidar(repo, agora);
  return rodou;
}

// ---------- o que o celular pede ----------
const publico = j => ({
  id: Number(j.id), liga: j.liga, ligaNome: j.liga_nome, ligaLogo: j.liga_logo, casa: j.casa, fora: j.fora,
  casaLogo: j.casa_logo, foraLogo: j.fora_logo, inicio: Date.parse(j.inicio), odds: j.odds,
});

export async function listar(repo, user, agora = Date.now()) {
  if (!temChave()) {     // ainda sem a chave da API: tela vazia, sem erro (as tabelas podem nem existir)
    const p = await repo.getProfile(user.id);
    return { agora, jogos: [], coins: p ? Number(p.coins) : null, abertas: 0, ...(p?.is_admin ? { admin: { chave: false, chamadasHoje: 0, limite: 0, erro: null } } : {}) };
  }
  // só lê o banco (rápido). Quem busca jogos/odds/resultados na API é o pedido 'atualizar',
  // que o celular manda separado, sem ficar esperando.
  const [todos, p, abertas] = await Promise.all([
    repo.sel('futebol_jogos', { status: 'NS' }), repo.getProfile(user.id), repo.sel('futebol_apostas', { user_id: user.id, status: 'aberta' }),
  ]);
  const jogos = todos
    .filter(j => j.odds && Date.parse(j.inicio) - agora > FECHA_ANTES_MS && Date.parse(j.inicio) - agora < 4 * 24 * H)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)).map(publico);
  const out = { agora, jogos, coins: p ? Number(p.coins) : null, abertas: abertas.length };
  if (p?.is_admin) {
    const [erro, c] = await Promise.all([linha(repo, 'erro'), cota(repo, agora)]);
    out.admin = { chave: temChave(), chamadasHoje: c.n, limite: c.lim, pro: c.pro, erro: erro?.valor ? { ...erro.valor, em: Number(erro.em) } : null };
  }
  return out;
}

export async function apostar(repo, user, b = {}, agora = Date.now()) {
  const valor = Math.floor(Number(b.valor));
  if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) fail(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
  const sels = Array.isArray(b.selecoes) ? b.selecoes : [];
  const ids = [...new Set(sels.map(s => Number(s.jogo)).filter(Boolean))];
  const jogos = Object.fromEntries((ids.length ? await repo.selIn('futebol_jogos', 'id', ids) : []).map(j => [Number(j.id), j]));
  const c = conferirBilhete(sels, jogos, agora);
  if (c.erro) fail(c.erro, c.mudou ? 409 : 400);
  const p = await repo.getProfile(user.id);
  if (!p || p.blocked) fail('Conta bloqueada', 403);
  const depois = await repo.adjustProfile(user.id, -valor, 0, 0);
  if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
  try {
    const [a] = await repo.ins('futebol_apostas', { user_id: user.id, valor, odd: c.odd, premio: premioDe(valor, c.odd), selecoes: c.selecoes, status: 'aberta', ganho: 0 });
    return { ok: true, id: a.id, odd: c.odd, premio: premioDe(valor, c.odd), coins: saldo(depois) };
  } catch (e) { await repo.adjustProfile(user.id, valor, 0, 0); throw e; }
}

export async function minhas(repo, user, agora = Date.now()) {
  await liquidar(repo, agora, user.id);
  const lista = await repo.sel('futebol_apostas', { user_id: user.id }, { order: ['id', false], limit: 40 });
  const ids = [...new Set(lista.filter(a => a.status === 'aberta').flatMap(a => a.selecoes.map(s => Number(s.jogo))))];
  const jogos = Object.fromEntries((ids.length ? await repo.selIn('futebol_jogos', 'id', ids) : []).map(j => [Number(j.id), j]));
  const p = await repo.getProfile(user.id);
  return {
    coins: p ? Number(p.coins) : null,
    apostas: lista.map(a => ({
      id: a.id, valor: Number(a.valor), odd: Number(a.odd), premio: Number(a.premio), status: a.status, ganho: Number(a.ganho) || 0,
      em: Date.parse(a.created_at),
      cashout: a.status === 'aberta' ? cashOut(a, jogos, agora, CFG.margemCashout()) : null,
      selecoes: a.selecoes.map(s => {
        const j = jogos[Number(s.jogo)];
        const placar = j && j.status !== 'NS' ? [j.gols_casa ?? j.ao_vivo_casa, j.gols_fora ?? j.ao_vivo_fora] : s.placar || null;
        return { ...s, inicio: Date.parse(s.inicio), status: s.status || (a.status === 'aberta' ? situacao(s, j, agora) : null), jogoStatus: j?.status || null, minuto: j?.minuto ?? null, placar: placar && placar[0] != null ? placar : null };
      }),
    })),
  };
}

// cash out: encerra o bilhete agora pelo valor do momento (o celular manda o valor que viu)
export async function encerrar(repo, user, b = {}, agora = Date.now()) {
  const [a] = await repo.sel('futebol_apostas', { id: Number(b.id), user_id: user.id });
  if (!a) fail('Aposta não encontrada');
  if (a.status !== 'aberta') fail('Essa aposta já foi encerrada');
  const ids = [...new Set(a.selecoes.map(s => Number(s.jogo)))];
  const jogos = Object.fromEntries((await repo.selIn('futebol_jogos', 'id', ids)).map(j => [Number(j.id), j]));
  const v = cashOut(a, jogos, agora, CFG.margemCashout());
  if (v == null) fail('Cash out indisponível agora. Tente de novo em instantes');
  const visto = Number(b.valor);
  if (!(visto > 0) || v < r2(visto * 0.99)) fail(`O valor mudou para ${v.toFixed(2).replace('.', ',')} fichas. Confira e tente de novo`, 409);
  const pago = Math.min(v, visto);
  const ok = await repo.upd('futebol_apostas', { id: a.id, status: 'aberta' }, { status: 'cashout', ganho: pago, liquidada_em: new Date(agora).toISOString() });
  if (!ok.length) fail('Essa aposta já foi encerrada');
  const c = await repo.adjustProfile(user.id, pago, 0, 0);
  return { ok: true, ganho: pago, coins: saldo(c) };
}

export async function futebol(repo, user, b = {}, agora = Date.now()) {
  if (b.op === 'cashout') return encerrar(repo, user, b, agora);
  if (!b.op || b.op === 'jogos') return listar(repo, user, agora);
  if (b.op === 'apostar') return apostar(repo, user, b, agora);
  if (b.op === 'minhas') return minhas(repo, user, agora);
  if (b.op === 'atualizar') return { mudou: (await sincronizar(repo, agora)) > 0 };
  fail('Ação inválida');
}
