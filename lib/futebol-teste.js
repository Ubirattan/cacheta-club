// Futebol de TESTE (link de teste sem login): jogos de mentira no próprio celular, fichas de mentira.
// Pra dar tempo de ver o resultado, cada jogo "acaba" 3 minutos depois de começar.
import { MIN_APOSTA, MAX_APOSTA, conferirBilhete, fechar, premioDe, situacao, r2 } from './futebol.js';

const TIMES = [['Flamengo', 'Palmeiras'], ['Corinthians', 'São Paulo'], ['Santos', 'Grêmio'], ['Atlético-MG', 'Cruzeiro'],
  ['Internacional', 'Fluminense'], ['Botafogo', 'Vasco'], ['Bahia', 'Fortaleza'], ['Boca Juniors', 'River Plate'],
  ['Real Madrid', 'Barcelona'], ['Bayern', 'PSG'], ['Sport', 'Ceará'], ['Coritiba', 'Goiás']];
const LG = [[71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'],
  [71, 'Brasileirão A'], [13, 'Libertadores'], [2, 'Champions'], [2, 'Champions'], [72, 'Brasileirão B'], [72, 'Brasileirão B']];
const MIN = 60e3;
const o2 = x => r2(Math.max(1.05, x));

export function criarTeste() {
  const t0 = Date.now();
  let coins = 1000, seq = 0;
  const apostas = [];
  const jogos = TIMES.map(([casa, fora], i) => {
    const forca = Math.random() * 1.6 - .8;                       // + casa favorita
    const p1 = .45 + forca * .3, p2 = .3 - forca * .25, px = 1 - p1 - p2, m = 1.06;
    const pm = .5 + (Math.random() - .5) * .3, pa = .5 + (Math.random() - .5) * .3;
    return {
      id: 9000 + i, liga: LG[i][0], liga_nome: LG[i][1], casa, fora, status: 'NS', gols_casa: null, gols_fora: null,
      inicio: new Date(t0 + [2, 4, 25, 60, 120, 180, 300, 600, 1440, 1500, 1560, 2900][i] * MIN).toISOString(),
      odds: {
        '1x2': { 1: o2(1 / p1 / m), X: o2(1 / px / m), 2: o2(1 / p2 / m) },
        dc: { '1X': o2(1 / (p1 + px) / m), '12': o2(1 / (p1 + p2) / m), X2: o2(1 / (px + p2) / m) },
        gols: { mais: o2(1 / pm / m), menos: o2(1 / (1 - pm) / m) }, ambos: { sim: o2(1 / pa / m), nao: o2(1 / (1 - pa) / m) },
      },
    };
  });
  const porId = () => Object.fromEntries(jogos.map(j => [j.id, j]));
  const gol = () => [0, 0, 1, 1, 1, 2, 2, 3, 4][Math.floor(Math.random() * 9)];
  function anda(a) {
    for (const j of jogos) {
      const ini = Date.parse(j.inicio);
      if (j.status === 'NS' && a >= ini) { j.status = '1H'; j.gols_casa = gol(); j.gols_fora = gol(); }
      if (j.status === '1H' && a >= ini + 3 * MIN) j.status = 'FT';
    }
    for (const x of apostas) if (x.status === 'aberta') {
      const f = fechar(x, porId(), a);
      if (f) { Object.assign(x, f); if (f.ganho) coins = r2(coins + f.ganho); }
    }
  }
  const erro = m => { throw new Error(m); };
  return {
    async chamar(b) {
      const a = Date.now(); anda(a);
      if (b.op === 'apostar') {
        const valor = Math.floor(Number(b.valor));
        if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) erro(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
        const c = conferirBilhete(b.selecoes, porId(), a);
        if (c.erro) erro(c.erro);
        if (valor > coins) erro('Fichas insuficientes');
        coins = r2(coins - valor);
        apostas.unshift({ id: ++seq, valor, odd: c.odd, premio: premioDe(valor, c.odd), selecoes: c.selecoes, status: 'aberta', ganho: 0, em: a });
        return { ok: true, coins, odd: c.odd, premio: premioDe(valor, c.odd) };
      }
      if (b.op === 'minhas') {
        const J = porId();
        return { coins, apostas: apostas.map(x => ({ ...x, selecoes: x.selecoes.map(s => {
          const j = J[s.jogo];
          return { ...s, inicio: Date.parse(s.inicio), status: s.status || situacao(s, j, a), jogoStatus: j.status, placar: j.status !== 'NS' ? [j.gols_casa, j.gols_fora] : null };
        }) })) };
      }
      return {
        agora: a, coins, abertas: apostas.filter(x => x.status === 'aberta').length,
        jogos: jogos.filter(j => j.status === 'NS' && Date.parse(j.inicio) - a > MIN).map(j => ({ id: j.id, liga: j.liga, ligaNome: j.liga_nome, casa: j.casa, fora: j.fora, inicio: Date.parse(j.inicio), odds: j.odds })),
      };
    },
  };
}
