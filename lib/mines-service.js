// Mines no servidor: as bombas são sorteadas com número aleatório seguro e ficam só aqui;
// o celular só fica sabendo onde estavam quando a partida acaba.
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { multDe, ganhoDe, livres, sortearMinas, publico, MIN_BOMBAS, MAX_BOMBAS, MIN_APOSTA, MAX_APOSTA, MAX_GANHO, CASAS } from './mines.js';

const fail = (m, s) => { throw new GameError(m, s); };
const saldo = c => c == null ? null : Number(Array.isArray(c) ? c[0] : c);
const sorteio = n => randomInt(0, n);

async function ativa(repo, user) {
  const [p] = await repo.sel('mines_partidas', { user_id: user.id, status: 'jogando' }, { order: ['id', false], limit: 1 });
  return p || null;
}
async function coinsDe(repo, user) { return saldo((await repo.getProfile(user.id))?.coins); }

export async function mines(repo, user, b = {}, r = sorteio) {
  const op = b.op || 'estado';
  if (op === 'estado') {
    const ult = await ativa(repo, user);
    return { partida: publico(ult), coins: await coinsDe(repo, user) };
  }
  if (op === 'iniciar') {
    if (await ativa(repo, user)) fail('Termine a partida que está aberta');
    const valor = Math.floor(Number(b.valor)), bombas = Math.floor(Number(b.bombas));
    if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) fail(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
    if (!(bombas >= MIN_BOMBAS && bombas <= MAX_BOMBAS)) fail(`Escolha de ${MIN_BOMBAS} a ${MAX_BOMBAS} bombas`);
    const p = await repo.getProfile(user.id);
    if (!p || p.blocked) fail('Conta bloqueada', 403);
    const depois = await repo.adjustProfile(user.id, -valor, 0, 0);
    if (depois == null) fail('Fichas insuficientes. Compre fichas na Loja', 402);
    let nova;
    try {
      [nova] = await repo.ins('mines_partidas', { user_id: user.id, valor, bombas, minas: sortearMinas(bombas, r), abertas: [], passo: 0, status: 'jogando', ganho: 0 });
    } catch { await repo.adjustProfile(user.id, valor, 0, 0); fail('Termine a partida que está aberta'); }
    return { partida: publico(nova), coins: saldo(depois) };
  }
  const p = await ativa(repo, user);
  if (!p) fail('Nenhuma partida aberta. Toque em JOGAR');
  const abertas = p.abertas || [];
  if (op === 'abrir') {
    const casa = Math.floor(Number(b.casa));
    if (!(casa >= 0 && casa < CASAS)) fail('Casa inválida');
    if (abertas.includes(casa)) return { partida: publico(p), coins: await coinsDe(repo, user) };
    const novas = [...abertas, casa];
    if ((p.minas || []).includes(casa)) {
      const ok = await repo.upd('mines_partidas', { id: p.id, status: 'jogando', passo: p.passo }, { status: 'perdeu', abertas: novas, bomba: casa, passo: p.passo + 1 });
      if (!ok.length) fail('Calma, uma jogada de cada vez');
      return { partida: publico(ok[0]), coins: await coinsDe(repo, user) };
    }
    const premio = ganhoDe(Number(p.valor), multDe(p.bombas, novas.length));
    const acabou = novas.length >= livres(p.bombas) || premio >= MAX_GANHO;     // abriu tudo ou chegou no máximo: saca sozinho
    const ok = await repo.upd('mines_partidas', { id: p.id, status: 'jogando', passo: p.passo },
      acabou ? { abertas: novas, passo: p.passo + 1, status: 'sacou', ganho: premio } : { abertas: novas, passo: p.passo + 1 });
    if (!ok.length) fail('Calma, uma jogada de cada vez');
    const c = acabou ? await repo.adjustProfile(user.id, premio, 0, 0) : null;
    return { partida: publico(ok[0]), coins: c != null ? saldo(c) : await coinsDe(repo, user) };
  }
  if (op === 'sacar') {
    if (!abertas.length) fail('Abra pelo menos uma casa antes de sacar');
    const premio = ganhoDe(Number(p.valor), multDe(p.bombas, abertas.length));
    const ok = await repo.upd('mines_partidas', { id: p.id, status: 'jogando', passo: p.passo }, { status: 'sacou', ganho: premio, passo: p.passo + 1 });
    if (!ok.length) fail('Calma, uma jogada de cada vez');
    const c = await repo.adjustProfile(user.id, premio, 0, 0);
    return { partida: publico(ok[0]), coins: saldo(c) };
  }
  fail('Ação inválida');
}
