// JOGO RESPONSÁVEL: o próprio cliente define autoexclusão, limite de depósito e limite de tempo por dia.
// Regras (padrão das casas licenciadas):
//  • diminuir um limite (ou criar um novo) vale na hora;
//  • aumentar ou tirar um limite só vale depois de 24 h (fica "pendente");
//  • a autoexclusão não pode ser cancelada antes do fim; durante ela não dá pra jogar, apostar nem comprar fichas.
// Tudo fica na tabela jogo_responsavel (só o servidor lê e grava).
import { GameError } from './service.js';

const MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
export const ESPERA_AUMENTO = 24 * H;
export const EXCLUSAO_DIAS = [1, 7, 30, 90, 180];
export const PERIODOS = { dia: 'por dia', semana: 'em 7 dias', mes: 'em 30 dias' };
const TABELA = 'jogo_responsavel';

// dia no horário de Brasília (o Brasil não tem mais horário de verão: UTC−3)
export const diaBR = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t));
const inicioDoDia = t => Date.parse(diaBR(t) + 'T00:00:00-03:00');

const fail = (m, s = 403) => { throw new GameError(m, s); };
const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

async function ler(repo, uid) {
  try { const [r] = await repo.sel(TABELA, { user_id: uid }); return r ? { existe: true, d: r.dados || {} } : { existe: false, d: {} }; }
  catch { return { existe: false, d: {}, semTabela: true }; }   // tabela ainda não criada: nada bloqueia
}
async function gravar(repo, uid, existe, d, agora) {
  const row = { dados: d, atualizado: new Date(agora).toISOString() };
  if (existe) await repo.upd(TABELA, { user_id: uid }, row); else await repo.ins(TABELA, { user_id: uid, ...row });
}
// aplica o que já passou das 24 h (aumento/remoção de limite)
function efetivar(d, agora) {
  let mudou = false;
  const fx = l => { if (l?.pend && agora >= l.pend.vale) { mudou = true; return { v: l.pend.v }; } return l; };
  if (d.dep) for (const k of Object.keys(PERIODOS)) if (d.dep[k]) d.dep[k] = fx(d.dep[k]);
  if (d.tempo) d.tempo = fx(d.tempo);
  return mudou;
}
const valor = l => (l && l.v != null ? Number(l.v) : null);
const usoHoje = (d, agora) => (d.uso && d.uso.dia === diaBR(agora) ? Number(d.uso.min) || 0 : 0);

async function depositado(repo, uid, agora) {
  const rows = await repo.sel('purchases', { user_id: uid }, { order: ['created_at', false], limit: 300 });
  const conta = rows.filter(p => Number(p.price_brl) > 0 && (p.status === 'done' || (p.status === 'pending' && agora - Date.parse(p.created_at) < H)));
  const desde = t0 => Math.round(conta.filter(p => Date.parse(p.created_at) >= t0).reduce((s, p) => s + Number(p.price_brl), 0) * 100) / 100;
  return { dia: desde(inicioDoDia(agora)), semana: desde(agora - 7 * D), mes: desde(agora - 30 * D) };
}

// tudo o que a tela mostra
export async function status(repo, user, agora = Date.now()) {
  const { existe, d } = await ler(repo, user.id);
  if (efetivar(d, agora)) await gravar(repo, user.id, existe, d, agora);
  const lim = l => ({ valor: valor(l), pendente: l?.pend ? { valor: l.pend.v, vale: l.pend.vale } : null });
  return {
    agora,
    exclusaoAte: d.exclusao_ate && d.exclusao_ate > agora ? d.exclusao_ate : null,
    deposito: Object.fromEntries(Object.keys(PERIODOS).map(k => [k, lim(d.dep?.[k])])),
    tempo: lim(d.tempo),
    usoHoje: usoHoje(d, agora),
    depositado: await depositado(repo, user.id, agora),
  };
}

// muda os limites. body: { deposito: { dia, semana, mes }, tempo }  (null = sem limite)
export async function definirLimites(repo, user, body = {}, agora = Date.now()) {
  const { existe, d, semTabela } = await ler(repo, user.id);
  if (semTabela) fail('Jogo responsável ainda não foi ativado no banco (falta rodar o jogo-responsavel.sql)', 503);
  efetivar(d, agora);
  const muda = (atual, novo, nome, minimo) => {
    if (novo !== null && (!Number.isFinite(novo) || novo < minimo)) fail(`${nome}: valor inválido`, 400);
    if (novo !== null) novo = Math.round(novo * 100) / 100;
    const v = valor(atual);
    if (v === novo) return atual?.pend ? { v } : atual;                       // igual: cancela aumento pendente
    const maisRigido = novo !== null && (v === null || novo < v);
    if (maisRigido) return { v: novo };                                       // vale na hora
    return { v, pend: { v: novo, vale: agora + ESPERA_AUMENTO } };            // aumento/remoção: daqui 24 h
  };
  if (body.deposito) {
    d.dep = d.dep || {};
    for (const k of Object.keys(PERIODOS)) if (k in body.deposito) d.dep[k] = muda(d.dep[k], num(body.deposito[k]), `Depósito ${PERIODOS[k]}`, 1);
  }
  if ('tempo' in body) d.tempo = muda(d.tempo, num(body.tempo), 'Tempo por dia', 5);
  await gravar(repo, user.id, existe, d, agora);
  return status(repo, user, agora);
}

export async function autoexcluir(repo, user, dias, agora = Date.now()) {
  dias = Number(dias);
  if (!EXCLUSAO_DIAS.includes(dias)) fail('Escolha um período', 400);
  const { existe, d, semTabela } = await ler(repo, user.id);
  if (semTabela) fail('Jogo responsável ainda não foi ativado no banco (falta rodar o jogo-responsavel.sql)', 503);
  d.exclusao_ate = Math.max(Number(d.exclusao_ate) || 0, agora + dias * D);
  await gravar(repo, user.id, existe, d, agora);
  return status(repo, user, agora);
}

const dataHora = t => new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// antes de gastar fichas (apostar, entrar em mesa, girar…)
export async function checarJogo(repo, uid, agora = Date.now()) {
  const { d } = await ler(repo, uid);
  if (d.exclusao_ate && d.exclusao_ate > agora) fail(`Você está em autoexclusão até ${dataHora(d.exclusao_ate)}. Não dá pra jogar até lá.`);
  efetivar(d, agora);
  const t = valor(d.tempo);
  if (t != null && usoHoje(d, agora) >= t) fail(`Você chegou no seu limite de ${t} min de jogo hoje. Volte amanhã.`);
}

// antes de gerar um Pix
export async function checarDeposito(repo, uid, brl, agora = Date.now()) {
  const { d } = await ler(repo, uid);
  if (d.exclusao_ate && d.exclusao_ate > agora) fail(`Você está em autoexclusão até ${dataHora(d.exclusao_ate)}. Não dá pra comprar fichas até lá.`);
  efetivar(d, agora);
  if (!d.dep) return;
  const ja = await depositado(repo, uid, agora);
  for (const k of Object.keys(PERIODOS)) {
    const l = valor(d.dep[k]);
    if (l != null && ja[k] + Number(brl) > l + 1e-9) {
      const resta = Math.max(0, Math.round((l - ja[k]) * 100) / 100);
      fail(`Seu limite de depósito ${PERIODOS[k]} é R$ ${l.toFixed(2).replace('.', ',')}. ${resta > 0 ? `Ainda dá pra depositar R$ ${resta.toFixed(2).replace('.', ',')}.` : 'Você já chegou nele.'}`);
    }
  }
}

// o celular avisa a cada ~1 min que o cliente está num jogo: conta o tempo do dia
export async function ping(repo, user, agora = Date.now()) {
  const { existe, d, semTabela } = await ler(repo, user.id);
  if (semTabela) return { usoHoje: 0, limite: null, acabou: false };
  const mudou = efetivar(d, agora);
  const hoje = diaBR(agora);
  if (!d.uso || d.uso.dia !== hoje) d.uso = { dia: hoje, min: 0, ultimo: 0 };
  let conta = false;
  if (agora - (Number(d.uso.ultimo) || 0) >= 50 * 1000) { d.uso.min = (Number(d.uso.min) || 0) + 1; d.uso.ultimo = agora; conta = true; }
  // só grava quando tem limite de tempo ou já tinha linha (quem não usa nada não cria linha a cada minuto)
  const t = valor(d.tempo);
  if ((conta || mudou) && (existe || t != null)) await gravar(repo, user.id, existe, d, agora);
  const excluido = !!(d.exclusao_ate && d.exclusao_ate > agora);
  return { usoHoje: d.uso.min, limite: t, acabou: excluido || (t != null && d.uso.min >= t), excluido };
}

export async function jogoResponsavel(repo, user, b = {}, agora = Date.now()) {
  if (b.op === 'limites') return definirLimites(repo, user, b, agora);
  if (b.op === 'excluir') return autoexcluir(repo, user, b.dias, agora);
  if (b.op === 'ping') return ping(repo, user, agora);
  return status(repo, user, agora);
}
