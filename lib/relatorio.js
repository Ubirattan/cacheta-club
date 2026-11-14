// Relatório de jogos do painel admin + registro das jogadas que não tinham histórico.
import { isGudeMode, isSinucaMode, isTrucoMode, isPipaMode } from './modes.js';

// guarda uma jogada (roleta, Onça, contra o computador). Nunca atrapalha o jogo se falhar.
export async function registrarJogada(repo, jogo, uid, aposta, ganho = 0) {
  try { await repo.ins('jogadas', { jogo, user_id: uid, aposta: Number(aposta) || 0, ganho: Number(ganho) || 0 }); } catch {}
}

export const NOMES = {
  foguete: '🚀 Foguetinho', double: '🎯 Double', mines: '💣 Mines', futebol: '⚽ Futebol', roleta: '🎡 Roleta', onca: '🐆 Onça da Sorte',
  'gude-pc': '🔵 Gude (computador)', 'cacheta-pc': '🃏 Cacheta (computador)', 'truco-pc': '🂡 Truco (computador)',
  'pipa-pc': '🪁 Pipa (computador)', 'sinuca-pc': '🎱 Sinuca (computador)',
  'on-cacheta': '🃏 Cacheta online', 'on-truco': '🂡 Truco online', 'on-gude': '🔵 Gude online', 'on-sinuca': '🎱 Sinuca online', 'on-pipa': '🪁 Pipa online',
};
const online = m => isGudeMode(m) ? 'on-gude' : isSinucaMode(m) ? 'on-sinuca' : isTrucoMode(m) ? 'on-truco' : isPipaMode(m) ? 'on-pipa' : 'on-cacheta';
const r2 = x => Math.round(Number(x) * 100) / 100;

// linhas da consulta (relatorio_jogos) → uma linha por jogo, do mais jogado pro menos
export function montarRelatorio(rows) {
  const por = new Map();
  for (const r of rows || []) {
    const id = String(r.jogo).startsWith('online:') ? online(String(r.jogo).slice(7)) : r.jogo;
    const a = por.get(id) || { id, nome: NOMES[id] || id, partidas: 0, jogadores: 0, apostado: 0, pago: 0 };
    a.partidas += Number(r.partidas) || 0; a.jogadores += Number(r.jogadores) || 0;   // (online de modos diferentes pode contar a mesma pessoa 2x)
    a.apostado += Number(r.apostado) || 0; a.pago += Number(r.pago) || 0;
    por.set(id, a);
  }
  const jogos = [...por.values()].map(j => ({ ...j, apostado: r2(j.apostado), pago: r2(j.pago), casa: r2(j.apostado - j.pago) }))
    .sort((a, b) => b.partidas - a.partidas);
  const tot = jogos.reduce((t, j) => ({ partidas: t.partidas + j.partidas, apostado: r2(t.apostado + j.apostado), pago: r2(t.pago + j.pago), casa: r2(t.casa + j.casa) }), { partidas: 0, apostado: 0, pago: 0, casa: 0 });
  return { jogos, total: tot };
}

export async function relatorioJogos(repo, dias = 7, agora = Date.now()) {
  dias = [1, 7, 30].includes(Number(dias)) ? Number(dias) : 7;
  const desde = dias === 1
    ? new Date(Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agora)) + 'T00:00:00-03:00'))
    : new Date(agora - dias * 86400000);
  let rows;
  try { rows = await repo.rpc('relatorio_jogos', { desde: desde.toISOString() }); }
  catch (e) { return { dias, erro: 'Falta rodar o supabase/relatorio-jogos.sql no Supabase', jogos: [], total: null }; }
  return { dias, ...montarRelatorio(rows) };
}
