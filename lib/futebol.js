// Apostas de futebol: regras que valem no servidor e no celular.
import { selecao } from './selecoes.js';
// Os jogos e as odds vêm da API-Football (api-sports.io); aqui só tem conta e conferência.

export const MIN_APOSTA = 5, MAX_APOSTA = 1000;
export const MAX_SELECOES = 10;            // jogos num bilhete múltiplo
export const MAX_PREMIO = 50000;           // prêmio máximo de um bilhete
export const FECHA_ANTES_MS = 60 * 1000;   // aposta fecha 1 minuto antes do jogo começar

// campeonatos (id da API-Football → nome curto). A ordem é a ordem das abas.
// campeonatos: id da API-Football, nome curto (aba), país pra conferir, e se tem pagamento antecipado.
// Os estaduais são achados pelo nome (re), porque o id muda de um ano pro outro em algumas fontes.
export const LIGAS = [
  { id: 71, nome: 'Brasileirão A', pais: 'Brazil', ant: true }, { id: 72, nome: 'Brasileirão B', pais: 'Brazil' },
  { id: 73, nome: 'Copa do Brasil', pais: 'Brazil', ant: true },
  { re: /^paulista\s*-?\s*(serie\s*)?a1$/i, nome: 'Paulistão', pais: 'Brazil', ant: true },
  { re: /^carioca\s*-?\s*1$/i, nome: 'Carioca', pais: 'Brazil', ant: true },
  { re: /^mineiro\s*-?\s*1$/i, nome: 'Mineiro', pais: 'Brazil', ant: true },
  { id: 13, nome: 'Libertadores', pais: 'World', ant: true }, { id: 11, nome: 'Sul-Americana', pais: 'World' },
  { id: 2, nome: 'Champions', pais: 'World', ant: true }, { id: 3, nome: 'Europa League', pais: 'World', ant: true },
  { id: 39, nome: 'Inglês', pais: 'England', ant: true }, { id: 140, nome: 'Espanhol', pais: 'Spain', ant: true },
  { id: 135, nome: 'Italiano', pais: 'Italy', ant: true }, { id: 78, nome: 'Alemão', pais: 'Germany', ant: true },
  { id: 61, nome: 'Francês', pais: 'France', ant: true }, { id: 94, nome: 'Português', pais: 'Portugal', ant: true },
  { id: 128, nome: 'Argentino', pais: 'Argentina', ant: true },
  { id: 169, nome: 'Chinês', pais: 'China', ant: true }, { id: 98, nome: 'Japonês', pais: 'Japan', ant: true },
  // seleções
  { id: 10, nome: 'Amistosos', pais: 'World' }, { id: 1, nome: 'Copa do Mundo', pais: 'World', ant: true },
  { id: 34, nome: 'Eliminatórias', pais: 'World', ant: true }, { id: 32, nome: 'Eliminatórias', pais: 'World', ant: true },
  { id: 31, nome: 'Eliminatórias', pais: 'World', ant: true }, { id: 29, nome: 'Eliminatórias', pais: 'World', ant: true },
  { id: 30, nome: 'Eliminatórias', pais: 'World', ant: true },
  { id: 5, nome: 'Nations League', pais: 'World', ant: true }, { id: 9, nome: 'Copa América', pais: 'World', ant: true },
  { id: 4, nome: 'Eurocopa', pais: 'World', ant: true }, { id: 6, nome: 'Copa Africana', pais: 'World', ant: true },
  { id: 7, nome: 'Copa da Ásia', pais: 'World', ant: true }, { id: 22, nome: 'Copa Ouro', pais: 'World', ant: true },
];
// acha o campeonato de um jogo da API (null = não está na lista). extra = ids a mais (variável FUTEBOL_LIGAS)
export function ligaDe(league, extra = []) {
  if (!league) return null;
  const l = LIGAS.find(x => x.id ? x.id === league.id : x.re.test(String(league.name || '').trim()) && league.country === x.pais);
  if (l) return l;
  return extra.includes(league.id) ? { id: league.id, nome: league.name } : null;
}
// campeonatos com pagamento antecipado (abriu 2 gols, o palpite no time já ganha). j = linha do jogo
export const temAntecipa = j => LIGAS.some(l => l.ant && (l.id ? l.id === Number(j?.liga) : l.nome === j?.liga_nome));
export const nomeLiga = (id, padrao) => LIGAS.find(l => l.id === Number(id))?.nome || padrao || 'Futebol';

export const MERCADOS = {
  '1x2': { nome: 'Resultado final', ops: ['1', 'X', '2'] },
  dc: { nome: 'Dupla chance', ops: ['1X', '12', 'X2'] },
  gols: { nome: 'Total de gols', ops: ['mais', 'menos'] },
  ambos: { nome: 'Ambos marcam', ops: ['sim', 'nao'] },
  ht: { nome: 'Resultado do 1º tempo', ops: ['1', 'X', '2'] },
  primeiro: { nome: 'Quem marca primeiro', ops: ['casa', 'nenhum', 'fora'] },
  proximo: { nome: 'Próximo gol', ops: ['casa', 'nenhum', 'fora'], soVivo: true },
  handicap: { nome: 'Handicap', ops: ['casa', 'fora'], linha: true },
  placar: { nome: 'Placar exato', ops: null },                // as opções vêm das odds (1:0, 2:1…)
  escanteios: { nome: 'Escanteios', ops: ['mais', 'menos'], linha: true },
  cartoes: { nome: 'Cartões', ops: ['mais', 'menos'], linha: true },
};
export const ESTATISTICA = ['escanteios', 'cartoes'];          // conferidos pelas estatísticas do jogo
const nl = l => String(l).replace('.', ',');
// texto da escolha, com o nome dos times (linha = 9.5 nos escanteios, por exemplo)
const sinal = l => (l > 0 ? '+' : '') + nl(l);
// palpites que têm linha (2,5 gols, 9,5 escanteios, handicap −1,5…)
export const COM_LINHA = ['gols', 'handicap', 'escanteios', 'cartoes'];
export const linhaPrincipal = (odds, m) => m === 'gols' ? Number(odds?.gols?.linha ?? 2.5) : odds?.[m]?.linha != null ? Number(odds[m].linha) : null;
// as odds de uma linha (a principal ou uma das outras de "Mostrar todos")
export function parDe(odds, m, linha) {
  const o = odds?.[m];
  if (linha == null || !COM_LINHA.includes(m) || Number(linha) === linhaPrincipal(odds, m)) return o || null;
  return odds?.linhas?.[m]?.[String(Number(linha))] || null;
}
export const oddDe = (odds, m, e, linha) => Number(parDe(odds, m, linha)?.[e]) || null;
// todas as linhas de um palpite, em ordem: [[linha, par], …]
export function todasLinhas(odds, m) {
  const ls = { ...(odds?.linhas?.[m] || {}) };
  const lp = linhaPrincipal(odds, m);
  if (odds?.[m] && lp != null) ls[String(lp)] = odds[m];
  return Object.entries(ls).map(([l, o]) => [Number(l), o]).sort((a, b) => a[0] - b[0]);
}
export const opcoes = (m, odds) => MERCADOS[m].ops || Object.keys(odds?.[m] || {}).filter(k => k !== 'linha');
export function rotulo(mercado, escolha, casa = 'Casa', fora = 'Fora', linha = null) {
  if (mercado === 'handicap') return escolha === 'casa' ? `${casa} ${sinal(linha)}` : `${fora} ${sinal(-linha)}`;
  if (mercado === 'placar') return `Placar ${escolha.replace(':', ' x ')}`;
  if (mercado === 'ht') return `1º tempo: ${({ '1': casa, X: 'empate', '2': fora })[escolha]}`;
  if (mercado === 'proximo') return escolha === 'nenhum' ? 'Próximo gol: ninguém' : `Próximo gol: ${escolha === 'casa' ? casa : fora}`;
  if (mercado === 'gols' && linha != null) return `${escolha === 'mais' ? 'Mais' : 'Menos'} de ${nl(linha)} gols`;
  if (mercado === 'primeiro') return escolha === 'nenhum' ? 'Ninguém marca (0 x 0)' : `${escolha === 'casa' ? casa : fora} marca primeiro`;
  if (MERCADOS[mercado]?.linha) return `${escolha === 'mais' ? 'Mais' : 'Menos'} de ${nl(linha)} ${mercado === 'escanteios' ? 'escanteios' : 'cartões'}`;
  return ({
    '1': casa, X: 'Empate', '2': fora,
    '1X': `${casa} ou empate`, '12': `${casa} ou ${fora}`, X2: `Empate ou ${fora}`,
    mais: 'Mais de 2,5 gols', menos: 'Menos de 2,5 gols',
    sim: 'Ambos marcam: sim', nao: 'Ambos marcam: não',
  })[escolha] || escolha;
}
export function curto(e, linha = null, m = null) {
  if (m === 'handicap') return e === 'casa' ? `1 ${sinal(linha)}` : `2 ${sinal(-linha)}`;
  if (m === 'placar') return e.replace(':', 'x');
  if (m === 'primeiro' || m === 'proximo') return ({ casa: '1', nenhum: 'Sem gol', fora: '2' })[e];
  if (linha != null) return `${e === 'mais' ? '+' : '-'}${nl(linha)}`;
  return ({ mais: '+2,5', menos: '-2,5', sim: 'Sim', nao: 'Não' })[e] || e;
}

export const r2 = x => Math.round(x * 100) / 100;
export const fichas = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });

// odd do bilhete = odds multiplicadas (anulada conta 1)
export const oddTotal = odds => r2(odds.reduce((a, o) => a * o, 1));
export const premioDe = (valor, odd) => Math.min(MAX_PREMIO, r2(valor * odd));

// ---------- leitura da API-Football ----------
const VALORES = {
  '1x2': { ids: [1], nomes: ['Match Winner'], map: { Home: '1', Draw: 'X', Away: '2' } },
  dc: { ids: [12], nomes: ['Double Chance'], map: { 'Home/Draw': '1X', 'Home/Away': '12', 'Draw/Away': 'X2' } },
  gols: { ids: [5], nomes: ['Goals Over/Under'], map: { 'Over 2.5': 'mais', 'Under 2.5': 'menos' } },
  ambos: { ids: [8], nomes: ['Both Teams Score'], map: { Yes: 'sim', No: 'nao' } },
  ht: { ids: [13], nomes: ['First Half Winner'], map: { Home: '1', Draw: 'X', Away: '2' } },
  primeiro: { ids: [14], nomes: ['Team To Score First'], map: { Home: 'casa', Draw: 'nenhum', 'No goal': 'nenhum', Away: 'fora' } },
};
const PREFERIDAS = [8, 1, 6, 11, 3];   // Bet365, 10Bet, Bwin, 1xBet, Betfair

// tira a margem extra da casa (0 = usa a odd da API como está)
export function comCorte(odd, corte = 0) {
  if (!corte) return r2(odd);
  return Math.max(1.01, Math.floor(odd * (1 - corte) * 100) / 100);
}

// item de /odds → { '1x2': { '1': 2.1, X: 3.2, '2': 3.4 }, dc: {...}, ... } ou null
export function lerOdds(item, corte = 0) {
  const casas = [...(item?.bookmakers || [])].sort((a, b) => {
    const ia = PREFERIDAS.indexOf(a.id), ib = PREFERIDAS.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const out = {}, linhas = {};
  const k = l => String(Number(l));
  const guarda = (m, por, a, b) => {           // todas as linhas com os dois lados (no máximo 9, perto da principal)
    const ok = Object.entries(por).filter(([, o]) => o[a] && o[b]).sort((x, y) => Math.abs(x[1][a] - x[1][b]) - Math.abs(y[1][a] - y[1][b])).slice(0, 9);
    if (ok.length > 1) linhas[m] = Object.fromEntries(ok.sort((x, y) => Number(x[0]) - Number(y[0])).map(([l, o]) => [k(l), { [a]: o[a], [b]: o[b] }]));
  };
  // total de gols: todas as linhas ",5" (a principal continua sendo a de 2,5)
  for (const bk of casas) {
    const bet = (bk.bets || []).find(b => b.id === 5 || b.name === 'Goals Over/Under');
    if (!bet) continue;
    const por = {};
    for (const v of bet.values || []) {
      const mm = /^(Over|Under)\s+(\d+(?:\.5))$/i.exec(String(v.value).trim()), n = Number(v.odd);
      if (mm && n > 1 && n < 200) (por[mm[2]] = por[mm[2]] || {})[/over/i.test(mm[1]) ? 'mais' : 'menos'] = comCorte(n, corte);
    }
    guarda('gols', por, 'mais', 'menos'); break;
  }
  for (const [m, d] of Object.entries(VALORES)) {
    for (const bk of casas) {
      const bet = (bk.bets || []).find(b => d.ids.includes(b.id) || d.nomes.includes(b.name));
      if (!bet) continue;
      const o = {};
      for (const v of bet.values || []) {
        const k = d.map[String(v.value)], n = Number(v.odd);
        if (k && n > 1 && n < 200) o[k] = comCorte(n, corte);
      }
      if (MERCADOS[m].ops.every(k => o[k])) { out[m] = o; break; }
    }
  }
  // handicap asiático só com linhas ",5" (sem devolução): a linha mais equilibrada
  for (const bk of casas) {
    const bet = (bk.bets || []).find(b => /^asian handicap$/i.test(b.name || '') || b.id === 4);
    if (!bet) continue;
    const por = {};
    for (const v of bet.values || []) {
      const mm = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/i.exec(String(v.value).trim()), n = Number(v.odd);
      if (!mm || !(n > 1 && n < 200)) continue;
      const l = Number(mm[2]), casa = /home/i.test(mm[1]), lc = casa ? l : -l;
      if (Math.abs(lc % 1) !== 0.5) continue;
      (por[lc] = por[lc] || {})[casa ? 'casa' : 'fora'] = comCorte(n, corte);
    }
    const melhor = Object.entries(por).filter(([, o]) => o.casa && o.fora).sort((a, b) => Math.abs(a[1].casa - a[1].fora) - Math.abs(b[1].casa - b[1].fora))[0];
    if (melhor) { out.handicap = { linha: Number(melhor[0]), ...melhor[1] }; guarda('handicap', por, 'casa', 'fora'); break; }
  }
  // placar exato: os 16 placares mais prováveis
  for (const bk of casas) {
    const bet = (bk.bets || []).find(b => /^exact score$/i.test(b.name || '') || b.id === 10);
    if (!bet) continue;
    const pl = (bet.values || []).map(v => [String(v.value).trim(), Number(v.odd)]).filter(([k, n]) => /^\d:\d$/.test(k) && n > 1 && n < 150)
      .sort((a, b) => a[1] - b[1]).slice(0, 16).sort((a, b) => a[0].localeCompare(b[0]));
    if (pl.length >= 6) { out.placar = Object.fromEntries(pl.map(([k, n]) => [k, comCorte(n, corte)])); break; }
  }
  // escanteios e cartões: a linha mais equilibrada (ex.: 9.5 escanteios) da melhor casa que tiver
  const LINHAS = { escanteios: /corner/i, cartoes: /card/i };
  for (const [m, re] of Object.entries(LINHAS)) {
    for (const bk of casas) {
      const bet = (bk.bets || []).find(b => re.test(b.name || '') && /over.?\/?.?under|over under/i.test(b.name || '')
        && !/1st|first|2nd|second|half|home|away|team|asian|exact|player/i.test(b.name || ''));
      if (!bet) continue;
      const por = {};
      for (const v of bet.values || []) {
        const mm = /^(Over|Under)\s+(\d+(?:\.5))$/i.exec(String(v.value).trim()), n = Number(v.odd);
        if (!mm || !(n > 1 && n < 200)) continue;
        (por[mm[2]] = por[mm[2]] || {})[mm[1].toLowerCase() === 'over' ? 'mais' : 'menos'] = comCorte(n, corte);
      }
      const melhor = Object.entries(por).filter(([, o]) => o.mais && o.menos).sort((a, b) => Math.abs(a[1].mais - a[1].menos) - Math.abs(b[1].mais - b[1].menos))[0];
      if (melhor) { out[m] = { linha: Number(melhor[0]), ...melhor[1] }; guarda(m, por, 'mais', 'menos'); break; }
    }
  }
  if (Object.keys(linhas).length) out.linhas = linhas;
  return out['1x2'] ? out : null;    // sem resultado final, o jogo não entra
}

// item de /fixtures → linha da tabela futebol_jogos
export function lerJogo(f) {
  const ft = f.score?.fulltime || {}, lg = ligaDe(f.league);
  return {
    id: f.fixture.id, liga: f.league.id, liga_nome: lg?.nome || nomeLiga(f.league.id, f.league.name), liga_logo: f.league.logo || null,
    // seleções: nome em português e bandeira; clubes: nome e escudo da API
    casa: selecao(f.teams.home.name)?.nome || f.teams.home.name, fora: selecao(f.teams.away.name)?.nome || f.teams.away.name,
    casa_logo: selecao(f.teams.home.name)?.bandeira || f.teams.home.logo || null, fora_logo: selecao(f.teams.away.name)?.bandeira || f.teams.away.logo || null,
    inicio: new Date(f.fixture.date).toISOString(), status: f.fixture.status?.short || 'NS',
    // placar do tempo normal (90 min): prorrogação e pênaltis não contam
    gols_casa: ft.home ?? (FIM.includes(f.fixture.status?.short) ? f.goals?.home : null) ?? null,
    gols_fora: ft.away ?? (FIM.includes(f.fixture.status?.short) ? f.goals?.away : null) ?? null,
    ao_vivo_casa: f.goals?.home ?? null, ao_vivo_fora: f.goals?.away ?? null,
    minuto: f.fixture.status?.elapsed ?? null,
    ht_casa: f.score?.halftime?.home ?? null, ht_fora: f.score?.halftime?.away ?? null,
  };
}

// ---------- resultado ----------
export const FIM = ['FT', 'AET', 'PEN'];
export const DEPOIS_HT = ['HT', '2H', 'ET', 'BT', 'P', 'FT', 'AET', 'PEN'];
// quem fez o 1º gol, olhando o placar (só no tempo normal). '?' = os dois já tinham marcado quando vimos
export function primeiroGol(antigo, novo) {
  if (antigo?.primeiro) return antigo.primeiro;
  if (!['1H', 'HT', '2H', 'FT'].includes(novo.status)) return null;
  const h = Number(novo.ao_vivo_casa) || 0, a = Number(novo.ao_vivo_fora) || 0;
  if (h && !a) return 'casa';
  if (a && !h) return 'fora';
  if (h && a) return '?';
  return null;
}
export const CANCELADO = ['CANC', 'ABD', 'AWD', 'WO'];
export const ADIADO = ['PST', 'TBD', 'SUSP', 'INT'];
export const ADIADO_ANULA_MS = 48 * 3600 * 1000;   // adiado há mais de 2 dias: aposta anulada

export function acertou(mercado, escolha, h, a, linha = 0) {
  if (mercado === 'handicap') return escolha === 'casa' ? h + Number(linha) > a : h + Number(linha) < a;
  if (mercado === 'placar') return escolha === `${h}:${a}`;
  if (mercado === '1x2') return escolha === (h > a ? '1' : h === a ? 'X' : '2');
  if (mercado === 'dc') return escolha === '1X' ? h >= a : escolha === '12' ? h !== a : h <= a;
  if (mercado === 'gols') return (h + a > (Number(linha) || 2.5)) === (escolha === 'mais');
  if (mercado === 'ambos') return (h > 0 && a > 0) === (escolha === 'sim');
  return false;
}
// 'ganhou' | 'perdeu' | 'anulada' | null (ainda não acabou)
export function situacao(sel, jogo, agora = Date.now()) {
  if (!jogo) return null;
  if (sel.mercado === 'combo') {          // Criar aposta: perde se um perder; anula se um anular; ganha se todos ganharem
    const st = sel.partes.map(p => situacao(p, jogo, agora));
    if (st.includes('perdeu')) return 'perdeu';
    if (st.includes(null)) return null;
    return st.includes('anulada') ? 'anulada' : 'ganhou';
  }
  if (ESTATISTICA.includes(sel.mercado)) {
    if (CANCELADO.includes(jogo.status) || ['AET', 'PEN'].includes(jogo.status)) return 'anulada';   // prorrogação: anula
    if (ADIADO.includes(jogo.status) && agora - Date.parse(jogo.inicio) > ADIADO_ANULA_MS) return 'anulada';
    if (jogo.status !== 'FT') return null;
    const v = jogo[sel.mercado];
    if (v == null) return agora - Date.parse(jogo.inicio) > 30 * 3600 * 1000 ? 'anulada' : null;   // sem estatística: anula
    return (Number(v) > Number(sel.linha)) === (sel.escolha === 'mais') ? 'ganhou' : 'perdeu';
  }
  if (sel.mercado === 'ht') {       // decide no intervalo
    if (DEPOIS_HT.includes(jogo.status) && jogo.ht_casa != null && jogo.ht_fora != null)
      return acertou('1x2', sel.escolha, Number(jogo.ht_casa), Number(jogo.ht_fora)) ? 'ganhou' : 'perdeu';
  } else if (sel.mercado === 'proximo') {      // próximo gol depois da aposta (base = placar na hora)
    if (CANCELADO.includes(jogo.status)) return 'anulada';
    const fim = FIM.includes(jogo.status);
    const h = Number(fim ? jogo.gols_casa : jogo.ao_vivo_casa), a = Number(fim ? jogo.gols_fora : jogo.ao_vivo_fora);
    const [bh, ba] = sel.base || [0, 0];
    if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
    if (h > bh && a > ba) return 'anulada';                          // os dois marcaram entre uma conferência e outra
    if (h > bh) return sel.escolha === 'casa' ? 'ganhou' : 'perdeu';
    if (a > ba) return sel.escolha === 'fora' ? 'ganhou' : 'perdeu';
    if (fim) return sel.escolha === 'nenhum' ? 'ganhou' : 'perdeu';
    return null;
  } else if (sel.mercado === 'primeiro') {
    if (jogo.primeiro === '?') return 'anulada';                      // não deu pra saber quem fez o 1º gol
    if (jogo.primeiro === 'casa' || jogo.primeiro === 'fora') return sel.escolha === jogo.primeiro ? 'ganhou' : 'perdeu';
    if (FIM.includes(jogo.status) && jogo.gols_casa != null) {
      const h = Number(jogo.gols_casa), a = Number(jogo.gols_fora);
      if (h + a === 0) return sel.escolha === 'nenhum' ? 'ganhou' : 'perdeu';
      if (!h || !a) return sel.escolha === (h ? 'casa' : 'fora') ? 'ganhou' : 'perdeu';
      return 'anulada';
    }
  } else if (FIM.includes(jogo.status) && jogo.gols_casa != null && jogo.gols_fora != null)
    return acertou(sel.mercado, sel.escolha, Number(jogo.gols_casa), Number(jogo.gols_fora), sel.linha) ? 'ganhou' : 'perdeu';
  if (CANCELADO.includes(jogo.status)) return 'anulada';
  if (ADIADO.includes(jogo.status) && agora - Date.parse(jogo.inicio) > ADIADO_ANULA_MS) return 'anulada';
  return null;
}
// confere o bilhete inteiro: devolve o fechamento ou null se ainda tem jogo rolando
export function fechar(aposta, jogos, agora = Date.now()) {
  const sels = aposta.selecoes.map(s => {
    if (s.status) return s;                                // já decidido antes (ex.: pagamento antecipado)
    const j = jogos[s.jogo], st = situacao(s, j, agora);
    return { ...s, status: st, ...(st && st !== 'anulada' ? { placar: [Number(j.gols_casa), Number(j.gols_fora)], ...(ESTATISTICA.includes(s.mercado) ? { total: Number(j[s.mercado]) } : {}) } : {}) };
  });
  if (sels.some(s => s.status === 'perdeu')) return { status: 'perdeu', ganho: 0, selecoes: sels };
  if (sels.some(s => !s.status)) return null;
  if (sels.every(s => s.status === 'anulada')) return { status: 'devolvida', ganho: Number(aposta.valor), selecoes: sels };
  const odd = oddTotal(sels.map(s => s.status === 'anulada' ? 1 : Number(s.odd)));
  return { status: 'ganhou', ganho: premioDe(Number(aposta.valor), odd), selecoes: sels };
}

// confere o bilhete na hora de apostar. jogos = { id: linha }. Lança { erro, odds } se algo mudou.
export function conferirBilhete(selecoes, jogos, agora = Date.now()) {
  if (!Array.isArray(selecoes) || !selecoes.length) return { erro: 'Escolha pelo menos um palpite' };
  if (selecoes.length > MAX_SELECOES) return { erro: `No máximo ${MAX_SELECOES} jogos por bilhete` };
  const vistos = new Set(), out = [];
  let mudou = false;
  for (const s of selecoes) {
    const id = Number(s.jogo), j = jogos[id];
    if (!j) return { erro: 'Jogo não encontrado' };
    if (vistos.has(id)) return { erro: 'Só dá pra fazer um palpite por jogo no mesmo bilhete' };
    vistos.add(id);
    if (j.status !== 'NS' || Date.parse(j.inicio) - agora < FECHA_ANTES_MS) return { erro: `${j.casa} x ${j.fora} já começou. Tire do bilhete` };
    if (s.mercado === 'combo') {
      const c = oddCombo(s.partes, j.odds);
      if (c.erro) return { erro: `${j.casa} x ${j.fora}: ${c.erro}` };
      if (Math.abs(c.odd - Number(s.odd)) > 0.001) mudou = true;
      out.push({ jogo: id, casa: j.casa, fora: j.fora, inicio: j.inicio, liga: j.liga_nome, mercado: 'combo', escolha: 'combo', odd: c.odd, partes: c.partes });
      continue;
    }
    const m = MERCADOS[s.mercado];
    if (!m || !(m.ops ? m.ops.includes(s.escolha) : /^\d:\d$/.test(s.escolha))) return { erro: 'Palpite inválido' };
    const linha = COM_LINHA.includes(s.mercado) ? (s.linha != null ? Number(s.linha) : linhaPrincipal(j.odds, s.mercado)) : null;
    const odd = oddDe(j.odds, s.mercado, s.escolha, linha);
    if (!(odd > 1)) return { erro: `Esse palpite saiu de ${j.casa} x ${j.fora}. Tire do bilhete` };
    if (Math.abs(odd - Number(s.odd)) > 0.001) mudou = true;
    out.push({ jogo: id, casa: j.casa, fora: j.fora, inicio: j.inicio, liga: j.liga_nome, mercado: s.mercado, escolha: s.escolha, odd,
      ...(s.mercado === '1x2' && s.escolha !== 'X' && temAntecipa(j) ? { antecipa: true } : {}), ...(linha != null ? { linha } : {}) });
  }
  if (mudou) return { erro: 'As odds mudaram. Confira o bilhete e aposte de novo', mudou: true };
  return { selecoes: out, odd: oddTotal(out.map(s => s.odd)) };
}

// dia no horário de Brasília (AAAA-MM-DD)
export const diaBR = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t));

// ---------- ao vivo ----------
export const AO_VIVO = ['1H', 'HT', '2H'];                 // tempo normal (prorrogação não conta)
export const NO_JOGO = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];

// pagamento antecipado: resultado final (1 ou 2) com o time 2 gols na frente no tempo normal
export function antecipa(sel, jogo) {
  if (!jogo || !sel.antecipa || sel.mercado !== '1x2' || !['1', '2'].includes(sel.escolha) || !AO_VIVO.includes(jogo.status)) return false;
  const h = Number(jogo.ao_vivo_casa), a = Number(jogo.ao_vivo_fora);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return false;
  return sel.escolha === '1' ? h - a >= 2 : a - h >= 2;
}

// chance de cada palpite com o placar e o minuto de agora (modelo de Poisson ajustado pelas odds de antes do jogo)
const fat = [1]; for (let i = 1; i <= 20; i++) fat[i] = fat[i - 1] * i;
const pois = (l, k) => Math.exp(-l) * l ** k / fat[k];
function dist(lh, la, h0 = 0, a0 = 0, fn) {
  let p = 0;
  for (let i = 0; i <= 10; i++) { const pi = pois(lh, i); if (pi < 1e-9 && i > lh) break;
    for (let j = 0; j <= 10; j++) { const pj = pois(la, j); if (pj < 1e-9 && j > la) break; if (fn(h0 + i, a0 + j)) p += pi * pj; } }
  return p;
}
const modelos = new Map();
export function modelo(odds) {
  const k = JSON.stringify(odds || {});
  if (modelos.has(k)) return modelos.get(k);
  let G = 2.6, s = 0.55;
  const o = odds?.['1x2'], g = odds?.gols;
  if (g?.mais && g?.menos) {
    const pOver = (1 / g.mais) / (1 / g.mais + 1 / g.menos);
    let best = 9; for (let x = 0.8; x <= 5; x += 0.05) { const d = Math.abs(1 - dist(x / 2, x / 2, 0, 0, (h, a) => h + a <= 2) - pOver); if (d < best) { best = d; G = x; } }
  }
  if (o?.['1'] && o?.['2'] && o?.X) {
    const t = 1 / o['1'] + 1 / o.X + 1 / o['2'], p1 = 1 / o['1'] / t, p2 = 1 / o['2'] / t;
    let best = 9; for (let x = 0.12; x <= 0.88; x += 0.01) { const d = Math.abs(dist(G * x, G * (1 - x), 0, 0, (h, a) => h > a) - p1) + Math.abs(dist(G * x, G * (1 - x), 0, 0, (h, a) => h < a) - p2); if (d < best) { best = d; s = x; } }
  }
  const m = { G, s }; if (modelos.size > 500) modelos.clear(); modelos.set(k, m); return m;
}
// minutos que faltam (de 90)
function falta(j) {
  if (!j || j.status === 'NS' || j.status === 'TBD') return 90;
  if (j.status === 'HT') return 45;
  const m = Number(j.minuto) || 0;
  return Math.max(1, 90 - m);
}
export function chance(sel, j) {
  if (sel.mercado === 'combo') return chanceCombo(sel.partes, j);
  if (ESTATISTICA.includes(sel.mercado)) {         // sem escanteio/cartão ao vivo: só antes do jogo, pela odd
    const o = parDe(j?.odds, sel.mercado, sel.linha);
    if (!o || (j.status !== 'NS' && j.status !== 'TBD')) return null;
    return (1 / o[sel.escolha]) / (1 / o.mais + 1 / o.menos);
  }
  const { G, s } = modelo(j?.odds);
  const vivo = j && j.status !== 'NS' && j.status !== 'TBD';
  const h0 = vivo ? Number(j.ao_vivo_casa) || 0 : 0, a0 = vivo ? Number(j.ao_vivo_fora) || 0 : 0;
  if (sel.mercado === 'ht') {
    if (j && DEPOIS_HT.includes(j.status)) return null;               // já decidido: o fechamento resolve
    const r1 = (vivo ? Math.max(1, 45 - (Number(j.minuto) || 0)) : 45) / 90;
    return dist(G * s * r1, G * (1 - s) * r1, h0, a0, (h, a) => acertou('1x2', sel.escolha, h, a));
  }
  const r = falta(j) / 90, lh = G * s * r, la = G * (1 - s) * r;
  if (sel.mercado === 'proximo') {
    const [bh, ba] = sel.base || [0, 0];
    if (h0 !== bh || a0 !== ba) return null;
    const pg = 1 - Math.exp(-(lh + la));
    return sel.escolha === 'nenhum' ? 1 - pg : (sel.escolha === 'casa' ? lh : la) / (lh + la) * pg;
  }
  if (sel.mercado === 'primeiro') {
    if (j?.primeiro) return null;
    if (h0 || a0) return null;
    const pg = 1 - Math.exp(-(lh + la));
    return sel.escolha === 'nenhum' ? 1 - pg : (sel.escolha === 'casa' ? lh : la) / (lh + la) * pg;
  }
  return dist(lh, la, h0, a0, (h, a) => acertou(sel.mercado, sel.escolha, h, a, sel.linha));
}
export const MARGEM_CASHOUT = 0.08;
// valor do cash out agora: null = não dá (algum palpite perdido, placar desatualizado, etc.)
export function cashOut(aposta, jogos, agora = Date.now(), margem = MARGEM_CASHOUT) {
  let odd = 1, p = 1, pend = 0;
  for (const sl of aposta.selecoes) {
    const j = jogos[sl.jogo];
    const st = sl.status || situacao(sl, j, agora);
    if (st === 'perdeu') return null;
    if (st === 'anulada') continue;
    odd *= Number(sl.odd);
    if (st === 'ganhou') continue;
    if (!j) return null;
    if (NO_JOGO.includes(j.status) && !AO_VIVO.includes(j.status)) return null;          // prorrogação, pênaltis, parado
    if (AO_VIVO.includes(j.status) && agora - Date.parse(j.atualizado) > 4 * 60 * 1000) return null;   // placar velho
    const c = chance(sl, j);
    if (c == null) return null;
    p *= c; pend++;
  }
  if (!pend) return null;
  const v = Math.floor(Number(aposta.valor) * odd * p * (1 - margem) * 100) / 100;
  return v >= 0.5 ? Math.min(v, premioDe(Number(aposta.valor), oddTotal([odd]))) : null;
}

// ---------- Criar aposta (vários palpites do mesmo jogo) ----------
export const COMBO_MIN = 2, COMBO_MAX = 6, MARGEM_COMBO = 0.10;
export const FORA_DO_COMBO = ['placar'];           // placar exato só em palpite normal
const GOLS = ['1x2', 'dc', 'gols', 'ambos', 'ht', 'primeiro', 'handicap', 'placar'];
// chance de TODOS os palpites de gols acontecerem juntos, a partir do placar/minuto atual
// (gols do 1º e do 2º tempo separados, pra valer também o resultado do intervalo e quem marca primeiro)
function juntos(partes, j) {
  const { G, s } = modelo(j?.odds);
  const st = j?.status || 'NS', m = Number(j?.minuto) || 0;
  const h0 = st === 'NS' || st === 'TBD' ? 0 : Number(j.ao_vivo_casa) || 0, a0 = st === 'NS' || st === 'TBD' ? 0 : Number(j.ao_vivo_fora) || 0;
  let r1, r2, ht = null;
  if (st === 'NS' || st === 'TBD') { r1 = .5; r2 = .5; }
  else if (st === '1H') { r1 = Math.max(1, 45 - m) / 90; r2 = .5; }
  else if (st === 'HT') { r1 = 0; r2 = .5; ht = [h0, a0]; }
  else if (st === '2H') { r1 = 0; r2 = Math.max(1, 90 - m) / 90; ht = [Number(j.ht_casa ?? h0), Number(j.ht_fora ?? a0)]; }
  else return null;
  const pri = j?.primeiro && j.primeiro !== '?' ? j.primeiro : (h0 || a0 ? null : 'aberto');
  if (pri === null && partes.some(p => p.mercado === 'primeiro')) return null;
  const L = [G * s * r1, G * (1 - s) * r1, G * s * r2, G * (1 - s) * r2];
  const P = L.map(l => { const v = []; for (let k = 0; k <= 7; k++) v.push(pois(l, k)); return v; });
  let tot = 0;
  for (let i1 = 0; i1 <= 7; i1++) for (let j1 = 0; j1 <= 7; j1++) {
    const p1 = P[0][i1] * P[1][j1]; if (p1 < 1e-10) continue;
    for (let i2 = 0; i2 <= 7; i2++) for (let j2 = 0; j2 <= 7; j2++) {
      const w = p1 * P[2][i2] * P[3][j2]; if (w < 1e-12) continue;
      const h = h0 + i1 + i2, a = a0 + j1 + j2, hh = ht ? ht[0] : h0 + i1, ha = ht ? ht[1] : a0 + j1;
      let peso = w;
      for (const p of partes) {
        if (p.mercado === 'ht') { if (!acertou('1x2', p.escolha, hh, ha)) { peso = 0; break; } }
        else if (p.mercado === 'primeiro') {
          const ja = pri === 'aberto' ? null : pri;
          let pc = ja ? (p.escolha === ja ? 1 : 0)
            : i1 + j1 ? (p.escolha === 'casa' ? i1 : p.escolha === 'fora' ? j1 : 0) / (i1 + j1)
            : i2 + j2 ? (p.escolha === 'casa' ? i2 : p.escolha === 'fora' ? j2 : 0) / (i2 + j2)
            : (p.escolha === 'nenhum' ? 1 : 0);
          peso *= pc; if (!peso) break;
        } else if (!acertou(p.mercado, p.escolha, h, a, p.linha)) { peso = 0; break; }
      }
      tot += peso;
    }
  }
  return tot;
}
const implicita = (m, e, odds, linha) => { const o = parDe(odds, m, linha); return o ? (1 / o[e]) / MERCADOS[m].ops.reduce((t, k) => t + 1 / o[k], 0) : null; };
// confere os palpites e calcula a odd do Criar aposta
export function oddCombo(partes, odds, margem = MARGEM_COMBO) {
  if (!Array.isArray(partes) || partes.length < COMBO_MIN) return { erro: `Escolha pelo menos ${COMBO_MIN} palpites` };
  if (partes.length > COMBO_MAX) return { erro: `No máximo ${COMBO_MAX} palpites no Criar aposta` };
  const vistos = new Set(), out = [];
  let prod = 1, pStat = 1;
  for (const p of partes) {
    const m = MERCADOS[p.mercado];
    if (!m) return { erro: 'Palpite inválido' };
    if (FORA_DO_COMBO.includes(p.mercado)) return { erro: 'Placar exato não entra no Criar aposta' };
    if (vistos.has(p.mercado)) return { erro: 'Um palpite de cada tipo' };
    vistos.add(p.mercado);
    const linha = COM_LINHA.includes(p.mercado) ? (p.linha != null ? Number(p.linha) : linhaPrincipal(odds, p.mercado)) : null;
    const odd = oddDe(odds, p.mercado, p.escolha, linha);
    if (!(odd > 1) || !(m.ops ? m.ops.includes(p.escolha) : /^\d:\d$/.test(p.escolha))) return { erro: 'Esse palpite não está disponível' };
    out.push({ mercado: p.mercado, escolha: p.escolha, odd, ...(linha != null ? { linha } : {}) });
    prod *= odd;
    if (ESTATISTICA.includes(p.mercado)) pStat *= implicita(p.mercado, p.escolha, odds, linha);
  }
  const gols = out.filter(p => GOLS.includes(p.mercado));
  const pg = gols.length ? juntos(gols, { status: 'NS', odds }) : 1;
  const pj = pg * pStat;
  if (!(pj > 0.002)) return { erro: 'Essa combinação é impossível ou improvável demais' };
  // nunca menos que o maior palpite sozinho (juntar só diminui a chance de ganhar)
  const maior = Math.max(...out.map(p => p.odd));
  const odd = Math.max(1.01, maior, Math.min(r2(prod), Math.floor(1 / pj * (1 - margem) * 100) / 100, 500));
  return { odd, partes: out };
}
// chance agora (pro cash out) de todos os palpites do Criar aposta acontecerem
export function chanceCombo(partes, j) {
  const pend = [];
  for (const p of partes) {
    const st = situacao(p, j);
    if (st === 'perdeu') return 0;
    if (st === 'anulada') return null;
    if (st === 'ganhou') continue;
    pend.push(p);
  }
  let pr = 1;
  const gols = pend.filter(p => GOLS.includes(p.mercado));
  for (const p of pend.filter(p => ESTATISTICA.includes(p.mercado))) { const c = chance(p, j); if (c == null) return null; pr *= c; }
  if (gols.length) { const c = juntos(gols, j); if (c == null) return null; pr *= c; }
  return pr;
}

// ---------- apostas com o jogo rolando ----------
export const VIVO_ESPERA_MS = 7000;            // espera antes de confirmar (pra ninguém apostar depois do gol)
export const VIVO_ODDS_VELHA_MS = 60 * 1000;   // odds ao vivo mais velhas que isso: sem aposta
export const VIVO_ULTIMO_MIN = 90;             // a partir do minuto 90 (acréscimos) não aceita mais
export const MERCADOS_VIVO = ['1x2', 'gols', 'ambos', 'proximo', 'escanteios', 'cartoes'];
// item de /odds/live → { '1x2': {...}, gols: { linha, mais, menos }, ambos, proximo, escanteios, cartoes } (sem as travadas)
export function lerOddsVivo(item, corte = 0) {
  const out = {};
  const val = v => { const n = Number(v.odd); return !v.suspended && n > 1 && n < 200 ? comCorte(n, corte) : null; };
  const linhaDe = v => { if (v.handicap != null && v.handicap !== '') return Number(v.handicap); const m = /([\d.]+)\s*$/.exec(String(v.value)); return m ? Number(m[1]) : null; };
  const ladoDe = v => /^over/i.test(String(v.value)) ? 'mais' : /^under/i.test(String(v.value)) ? 'menos' : null;
  function linhas(bet) {
    const por = {}; let main = null;
    for (const v of bet.values || []) {
      const l = linhaDe(v), lado = ladoDe(v), n = val(v);
      if (l == null || !lado || Math.abs(l % 1) !== 0.5) continue;
      if (n) (por[l] = por[l] || {})[lado] = n;
      if (v.main === true || v.main === 'true') main = l;
    }
    const ok = Object.entries(por).filter(([, o]) => o.mais && o.menos);
    const esc = ok.find(([l]) => Number(l) === main) || ok.sort((a, b) => Math.abs(a[1].mais - a[1].menos) - Math.abs(b[1].mais - b[1].menos))[0];
    return esc ? { linha: Number(esc[0]), ...esc[1] } : null;
  }
  for (const bet of item?.odds || []) {
    const nome = String(bet.name || '');
    if (!out['1x2'] && /^(fulltime result|match winner|1x2|full time result)$/i.test(nome)) {
      const o = {}; for (const v of bet.values || []) { const k = ({ Home: '1', '1': '1', Draw: 'X', X: 'X', Away: '2', '2': '2' })[String(v.value)]; const n = val(v); if (k && n) o[k] = n; }
      if (o['1'] && o.X && o['2']) out['1x2'] = o;
    } else if (!out.gols && /^(over\/under line|match goals|goals over\/under|over\/under|total goals)$/i.test(nome)) {
      const l = linhas(bet); if (l) out.gols = l;
    } else if (!out.ambos && /^both teams (to )?score$/i.test(nome)) {
      const o = {}; for (const v of bet.values || []) { const k = ({ Yes: 'sim', No: 'nao' })[String(v.value)]; const n = val(v); if (k && n) o[k] = n; }
      if (o.sim && o.nao) out.ambos = o;
    } else if (!out.proximo && /^next goal$/i.test(nome)) {
      const o = {}; for (const v of bet.values || []) { const k = /^(home|1)$/i.test(String(v.value)) ? 'casa' : /^(away|2)$/i.test(String(v.value)) ? 'fora' : /no ?goal|none|draw/i.test(String(v.value)) ? 'nenhum' : null; const n = val(v); if (k && n) o[k] = n; }
      if (o.casa && o.fora && o.nenhum) out.proximo = o;
    } else if (!out.escanteios && /corner/i.test(nome) && !/asian|home|away|team|1st|2nd|half|race|next|first|last|handicap/i.test(nome)) {
      const l = linhas(bet); if (l) out.escanteios = l;
    } else if (!out.cartoes && /(card|booking)/i.test(nome) && !/asian|home|away|team|1st|2nd|half|race|next|first|last|player|red|handicap/i.test(nome)) {
      const l = linhas(bet); if (l) out.cartoes = l;
    }
  }
  return Object.keys(out).length ? out : null;
}
// o jogo está aceitando aposta ao vivo agora?
export function vivoAberto(j, agora = Date.now()) {
  if (!j || !AO_VIVO.includes(j.status) || j.travado || !j.odds_vivo) return false;
  if (agora - Number(j.odds_vivo_em) > VIVO_ODDS_VELHA_MS) return false;
  return !(j.status === '2H' && Number(j.minuto) >= VIVO_ULTIMO_MIN);
}
// confere o bilhete ao vivo (só jogos rolando, odds frescas, sem trava)
export function conferirVivo(selecoes, jogos, agora = Date.now()) {
  if (!Array.isArray(selecoes) || !selecoes.length) return { erro: 'Escolha pelo menos um palpite' };
  if (selecoes.length > MAX_SELECOES) return { erro: `No máximo ${MAX_SELECOES} jogos por bilhete` };
  const vistos = new Set(), out = [];
  let mudou = false;
  for (const s of selecoes) {
    const id = Number(s.jogo), j = jogos[id];
    if (!j) return { erro: 'Jogo não encontrado' };
    if (vistos.has(id)) return { erro: 'Só dá pra fazer um palpite por jogo no mesmo bilhete' };
    vistos.add(id);
    if (!vivoAberto(j, agora)) return { erro: `${j.casa} x ${j.fora}: apostas travadas agora 🔒` };
    if (!MERCADOS_VIVO.includes(s.mercado)) return { erro: 'Palpite inválido' };
    const o = j.odds_vivo[s.mercado], odd = Number(o?.[s.escolha]);
    if (!(odd > 1)) return { erro: `${j.casa} x ${j.fora}: esse palpite está travado 🔒` };
    if (Math.abs(odd - Number(s.odd)) > 0.001) mudou = true;
    if (o.linha != null && Number(s.linha) !== Number(o.linha)) mudou = true;
    out.push({ jogo: id, casa: j.casa, fora: j.fora, inicio: j.inicio, liga: j.liga_nome, mercado: s.mercado, escolha: s.escolha, odd,
      ...(o.linha != null ? { linha: Number(o.linha) } : {}), vivo: true, base: [Number(j.ao_vivo_casa) || 0, Number(j.ao_vivo_fora) || 0], minuto: Number(j.minuto) || 0 });
  }
  if (mudou) return { erro: 'As odds mudaram. Confira o bilhete e aposte de novo', mudou: true };
  return { selecoes: out, odd: oddTotal(out.map(s => s.odd)) };
}
// depois da espera: o jogo continua igual? (placar igual, sem trava, odd não caiu)
export function confereEspera(sel, item, corte = 0) {
  if (!item) return 'Não deu pra conferir o jogo agora';
  const st = item.status || {};
  if (st.blocked || st.stopped || st.finished) return 'Apostas travadas nesse momento';
  const h = Number(item.teams?.home?.goals ?? sel.base[0]), a = Number(item.teams?.away?.goals ?? sel.base[1]);
  if (h !== sel.base[0] || a !== sel.base[1]) return 'Saiu gol durante a confirmação';
  const o = lerOddsVivo(item, corte)?.[sel.mercado];
  const odd = Number(o?.[sel.escolha]);
  if (!(odd > 1)) return 'Esse palpite travou durante a confirmação';
  if (o.linha != null && Number(o.linha) !== Number(sel.linha)) return 'A linha mudou durante a confirmação';
  if (odd < Number(sel.odd) - 0.001) return 'A odd caiu durante a confirmação';
  return null;
}

// esse palpite não acrescenta nada aos já escolhidos (ex.: "1" com "1 ou empate"), ou torna um deles inútil?
export function redundante(partes, nova, odds) {
  if (!GOLS.includes(nova.mercado)) return false;
  const gols = partes.filter(p => GOLS.includes(p.mercado));
  if (!gols.length) return false;
  const j = { status: 'NS', odds };
  const p0 = juntos(gols, j), pn = juntos([nova], j), pj = juntos([...gols, nova], j);
  if (!(pj > 0)) return false;
  return pj > p0 * 0.995 || gols.some(g => pj > juntos(gols.filter(x => x !== g).concat(nova), j) * 0.995);
}
