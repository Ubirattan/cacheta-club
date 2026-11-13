// Apostas de futebol: regras que valem no servidor e no celular.
// Os jogos e as odds vêm da API-Football (api-sports.io); aqui só tem conta e conferência.

export const MIN_APOSTA = 5, MAX_APOSTA = 1000;
export const MAX_SELECOES = 10;            // jogos num bilhete múltiplo
export const MAX_PREMIO = 50000;           // prêmio máximo de um bilhete
export const FECHA_ANTES_MS = 60 * 1000;   // aposta fecha 1 minuto antes do jogo começar

// campeonatos (id da API-Football → nome curto). A ordem é a ordem das abas.
export const LIGAS = [
  [71, 'Brasileirão A'], [72, 'Brasileirão B'], [73, 'Copa do Brasil'],
  [13, 'Libertadores'], [11, 'Sul-Americana'], [2, 'Champions'],
];
export const nomeLiga = (id, padrao) => (LIGAS.find(l => l[0] === Number(id)) || [])[1] || padrao || 'Futebol';

export const MERCADOS = {
  '1x2': { nome: 'Resultado final', ops: ['1', 'X', '2'] },
  dc: { nome: 'Dupla chance', ops: ['1X', '12', 'X2'] },
  gols: { nome: 'Total de gols', ops: ['mais', 'menos'] },
  ambos: { nome: 'Ambos marcam', ops: ['sim', 'nao'] },
};
// texto da escolha, com o nome dos times
export function rotulo(mercado, escolha, casa = 'Casa', fora = 'Fora') {
  return ({
    '1': casa, X: 'Empate', '2': fora,
    '1X': `${casa} ou empate`, '12': `${casa} ou ${fora}`, X2: `Empate ou ${fora}`,
    mais: 'Mais de 2,5 gols', menos: 'Menos de 2,5 gols',
    sim: 'Ambos marcam: sim', nao: 'Ambos marcam: não',
  })[escolha] || escolha;
}
export const curto = e => ({ mais: '+2,5', menos: '-2,5', sim: 'Sim', nao: 'Não' })[e] || e;

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
  const out = {};
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
  return out['1x2'] ? out : null;    // sem resultado final, o jogo não entra
}

// item de /fixtures → linha da tabela futebol_jogos
export function lerJogo(f) {
  const ft = f.score?.fulltime || {};
  return {
    id: f.fixture.id, liga: f.league.id, liga_nome: nomeLiga(f.league.id, f.league.name), liga_logo: f.league.logo || null,
    casa: f.teams.home.name, fora: f.teams.away.name, casa_logo: f.teams.home.logo || null, fora_logo: f.teams.away.logo || null,
    inicio: new Date(f.fixture.date).toISOString(), status: f.fixture.status?.short || 'NS',
    // placar do tempo normal (90 min): prorrogação e pênaltis não contam
    gols_casa: ft.home ?? (FIM.includes(f.fixture.status?.short) ? f.goals?.home : null) ?? null,
    gols_fora: ft.away ?? (FIM.includes(f.fixture.status?.short) ? f.goals?.away : null) ?? null,
    ao_vivo_casa: f.goals?.home ?? null, ao_vivo_fora: f.goals?.away ?? null,
  };
}

// ---------- resultado ----------
export const FIM = ['FT', 'AET', 'PEN'];
export const CANCELADO = ['CANC', 'ABD', 'AWD', 'WO'];
export const ADIADO = ['PST', 'TBD', 'SUSP', 'INT'];
export const ADIADO_ANULA_MS = 48 * 3600 * 1000;   // adiado há mais de 2 dias: aposta anulada

export function acertou(mercado, escolha, h, a) {
  if (mercado === '1x2') return escolha === (h > a ? '1' : h === a ? 'X' : '2');
  if (mercado === 'dc') return escolha === '1X' ? h >= a : escolha === '12' ? h !== a : h <= a;
  if (mercado === 'gols') return (h + a > 2.5) === (escolha === 'mais');
  if (mercado === 'ambos') return (h > 0 && a > 0) === (escolha === 'sim');
  return false;
}
// 'ganhou' | 'perdeu' | 'anulada' | null (ainda não acabou)
export function situacao(sel, jogo, agora = Date.now()) {
  if (!jogo) return null;
  if (FIM.includes(jogo.status) && jogo.gols_casa != null && jogo.gols_fora != null)
    return acertou(sel.mercado, sel.escolha, Number(jogo.gols_casa), Number(jogo.gols_fora)) ? 'ganhou' : 'perdeu';
  if (CANCELADO.includes(jogo.status)) return 'anulada';
  if (ADIADO.includes(jogo.status) && agora - Date.parse(jogo.inicio) > ADIADO_ANULA_MS) return 'anulada';
  return null;
}
// confere o bilhete inteiro: devolve o fechamento ou null se ainda tem jogo rolando
export function fechar(aposta, jogos, agora = Date.now()) {
  const sels = aposta.selecoes.map(s => {
    const j = jogos[s.jogo], st = situacao(s, j, agora);
    return { ...s, status: st, ...(st && st !== 'anulada' ? { placar: [Number(j.gols_casa), Number(j.gols_fora)] } : {}) };
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
    const m = MERCADOS[s.mercado];
    if (!m || !m.ops.includes(s.escolha)) return { erro: 'Palpite inválido' };
    const odd = Number(j.odds?.[s.mercado]?.[s.escolha]);
    if (!(odd > 1)) return { erro: `Esse palpite saiu de ${j.casa} x ${j.fora}. Tire do bilhete` };
    if (Math.abs(odd - Number(s.odd)) > 0.001) mudou = true;
    out.push({ jogo: id, casa: j.casa, fora: j.fora, inicio: j.inicio, liga: j.liga_nome, mercado: s.mercado, escolha: s.escolha, odd });
  }
  if (mudou) return { erro: 'As odds mudaram. Confira o bilhete e aposte de novo', mudou: true };
  return { selecoes: out, odd: oddTotal(out.map(s => s.odd)) };
}

// dia no horário de Brasília (AAAA-MM-DD)
export const diaBR = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t));
