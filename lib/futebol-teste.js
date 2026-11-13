// Futebol de TESTE (link de teste sem login): jogos de mentira no próprio celular, fichas de mentira.
// Pra dar tempo de ver o resultado, cada jogo dura 3 minutos (90' do jogo), com placar ao vivo, pagamento antecipado e cash out.
import { MIN_APOSTA, MAX_APOSTA, conferirBilhete, fechar, premioDe, situacao, r2, antecipa, cashOut } from './futebol.js';

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
      inicio: new Date(t0 + [3, 5, 8, 60, 120, 180, 300, 600, 1440, 1500, 1560, 2900][i] * MIN).toISOString(),
      odds: {
        '1x2': { 1: o2(1 / p1 / m), X: o2(1 / px / m), 2: o2(1 / p2 / m) },
        dc: { '1X': o2(1 / (p1 + px) / m), '12': o2(1 / (p1 + p2) / m), X2: o2(1 / (px + p2) / m) },
        gols: { mais: o2(1 / pm / m), menos: o2(1 / (1 - pm) / m) }, ambos: { sim: o2(1 / pa / m), nao: o2(1 / (1 - pa) / m) },
        escanteios: { linha: 9.5, mais: 1.85, menos: 1.9 }, cartoes: { linha: 4.5, mais: 1.8, menos: 1.95 },
        ht: { 1: o2(1 / (p1 * .8) / m), X: o2(1 / .42 / m), 2: o2(1 / (p2 * .8) / m) },
        primeiro: { casa: o2(1 / (p1 + .08) / m), nenhum: 9, fora: o2(1 / (p2 + .12) / m) },
        handicap: { linha: -0.5, casa: o2(1 / p1 / m), fora: o2(1 / (1 - p1) / m) },
        placar: { '0:0': 9, '1:0': 7, '0:1': 9.5, '1:1': 6.5, '2:0': 9, '0:2': 15, '2:1': 8.5, '1:2': 12, '2:2': 15, '3:0': 15, '3:1': 17, '1:3': 26 },
      },
    };
  });
  const porId = () => Object.fromEntries(jogos.map(j => [j.id, j]));
  const gol = () => [0, 0, 1, 1, 1, 2, 2, 3, 4][Math.floor(Math.random() * 9)];
  function anda(a) {
    for (const j of jogos) {
      const ini = Date.parse(j.inicio);
      if (j.status === 'NS' && a >= ini) { j.status = '1H'; j.gm = [...Array(gol())].map(() => Math.random() * 90); j.ga = [...Array(gol())].map(() => Math.random() * 90); }
      if (['1H', '2H'].includes(j.status)) {
        const m = Math.min(90, Math.floor((a - ini) / (3 * MIN) * 90) + 1);
        j.minuto = m; j.status = m <= 45 ? '1H' : '2H';
        j.ao_vivo_casa = j.gm.filter(x => x < m).length; j.ao_vivo_fora = j.ga.filter(x => x < m).length;
        if (m > 45 && j.ht_casa == null) { j.ht_casa = j.gm.filter(x => x < 45).length; j.ht_fora = j.ga.filter(x => x < 45).length; }
        if (!j.primeiro && (j.ao_vivo_casa || j.ao_vivo_fora)) j.primeiro = Math.min(...j.gm, 99) < Math.min(...j.ga, 99) ? 'casa' : 'fora';
        if (a >= ini + 3 * MIN) { j.status = 'FT'; if (j.ht_casa == null) { j.ht_casa = j.gm.filter(x => x < 45).length; j.ht_fora = j.ga.filter(x => x < 45).length; } j.escanteios = 5 + Math.floor(Math.random() * 10); j.cartoes = 1 + Math.floor(Math.random() * 8); j.gols_casa = j.gm.length; j.gols_fora = j.ga.length; j.ao_vivo_casa = j.gols_casa; j.ao_vivo_fora = j.gols_fora; }
      }
      j.atualizado = new Date(a).toISOString();
    }
    const J = porId();
    for (const x of apostas) if (x.status === 'aberta') {
      x.selecoes = x.selecoes.map(sl => !sl.status && antecipa(sl, J[sl.jogo]) ? { ...sl, status: 'ganhou', antecipado: true } : sl);
      const f = fechar(x, J, a);
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
      if (b.op === 'cashout') {
        const x = apostas.find(y => y.id === b.id && y.status === 'aberta'); if (!x) erro('Essa aposta já foi encerrada');
        const v = cashOut(x, porId(), a); if (v == null) erro('Cash out indisponível agora');
        if (v < r2(Number(b.valor) * 0.99)) erro(`O valor mudou para ${v.toFixed(2).replace('.', ',')} fichas. Confira e tente de novo`);
        const pago = Math.min(v, Number(b.valor)); x.status = 'cashout'; x.ganho = pago; coins = r2(coins + pago);
        return { ok: true, ganho: pago, coins };
      }
      if (b.op === 'minhas') {
        const J = porId();
        return { coins, apostas: apostas.map(x => ({ ...x, cashout: x.status === 'aberta' ? cashOut(x, J, a) : null, selecoes: x.selecoes.map(s => {
          const j = J[s.jogo];
          return { ...s, inicio: Date.parse(s.inicio), status: s.status || situacao(s, j, a), jogoStatus: j.status, minuto: j.minuto, total: s.total ?? (j.status === 'FT' && j[s.mercado] != null ? j[s.mercado] : undefined), placar: j.status !== 'NS' ? [j.ao_vivo_casa, j.ao_vivo_fora] : null };
        }) })) };
      }
      return {
        agora: a, coins, abertas: apostas.filter(x => x.status === 'aberta').length,
        jogos: jogos.filter(j => j.status === 'NS' && Date.parse(j.inicio) - a > MIN).map(j => ({ id: j.id, liga: j.liga, ligaNome: j.liga_nome, casa: j.casa, fora: j.fora, inicio: Date.parse(j.inicio), odds: j.odds })),
      };
    },
  };
}
