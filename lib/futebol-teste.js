// Futebol de TESTE (link de teste sem login): jogos de mentira no próprio celular, fichas de mentira.
// Pra dar tempo de ver o resultado, cada jogo dura 3 minutos (90' do jogo), com placar ao vivo, pagamento antecipado e cash out.
import { temAntecipa, conferirVivo, chance, VIVO_ESPERA_MS, AO_VIVO, MIN_APOSTA, MAX_APOSTA, conferirBilhete, fechar, premioDe, situacao, r2, antecipa, cashOut, oddsAmbosMais } from './futebol.js';

const TIMES = [['Flamengo', 'Palmeiras'], ['Corinthians', 'São Paulo'], ['Santos', 'Grêmio'], ['Atlético-MG', 'Cruzeiro'],
  ['Internacional', 'Fluminense'], ['Botafogo', 'Vasco'], ['Bahia', 'Fortaleza'], ['Boca Juniors', 'River Plate'],
  ['Real Madrid', 'Barcelona'], ['Bayern', 'PSG'], ['Sport', 'Ceará'], ['Coritiba', 'Goiás']];
const LG = [[71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'], [71, 'Brasileirão A'],
  [71, 'Brasileirão A'], [13, 'Libertadores'], [2, 'Champions'], [39, 'Inglês'], [72, 'Brasileirão B'], [98, 'Japonês']];
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
        dnb: { casa: o2(1 / (p1 / (p1 + p2)) / m), fora: o2(1 / (p2 / (p1 + p2)) / m) },
        htft: Object.fromEntries(['1', 'X', '2'].flatMap(x => ['1', 'X', '2'].map(y => {
          const ph = { 1: p1 * .8, X: .42, 2: p2 * .8 }[x], pf = { 1: p1, X: px, 2: p2 }[y], liga = x === y ? 1.6 : x === 'X' ? 1 : .25;
          return [`${x}/${y}`, o2(Math.min(80, 1 / Math.max(.012, ph * pf * liga) / m))];
        }))),
        primeiro: { casa: o2(1 / (p1 + .08) / m), nenhum: 9, fora: o2(1 / (p2 + .12) / m) },
        handicap: { linha: -0.5, casa: o2(1 / p1 / m), fora: o2(1 / (1 - p1) / m) },
        linhas: {
          gols: { 0.5: { mais: 1.08, menos: 7.5 }, 1.5: { mais: 1.33, menos: 3.2 }, 2.5: { mais: o2(1 / pm / m), menos: o2(1 / (1 - pm) / m) }, 3.5: { mais: 3.1, menos: 1.35 }, 4.5: { mais: 6, menos: 1.1 } },
          escanteios: { 7.5: { mais: 1.4, menos: 2.75 }, 8.5: { mais: 1.6, menos: 2.25 }, 9.5: { mais: 1.85, menos: 1.9 }, 10.5: { mais: 2.3, menos: 1.57 }, 11.5: { mais: 2.9, menos: 1.38 } },
          cartoes: { 3.5: { mais: 1.45, menos: 2.6 }, 4.5: { mais: 1.8, menos: 1.95 }, 5.5: { mais: 2.4, menos: 1.53 } },
          handicap: { '-1.5': { casa: 4, fora: 1.22 }, '-0.5': { casa: o2(1 / p1 / m), fora: o2(1 / (1 - p1) / m) }, 0.5: { casa: 1.4, fora: 2.8 } },
        },
        placar: { '0:0': 9, '1:0': 7, '0:1': 9.5, '1:1': 6.5, '2:0': 9, '0:2': 15, '2:1': 8.5, '1:2': 12, '2:2': 15, '3:0': 15, '3:1': 17, '1:3': 26 },
      },
    };
  });
  jogos.forEach(j => { const am = oddsAmbosMais(j.odds); if (am) j.odds.ambosMais = am; });
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
    for (const j of jogos) {
      if (!AO_VIVO.includes(j.status)) { j.odds_vivo = null; continue; }
      if (j.odds_vivo && a - j.odds_vivo_em < 10000 && j.ovPlacar === `${j.ao_vivo_casa}:${j.ao_vivo_fora}`) continue;   // muda a cada 10 s ou no gol
      const od = p => Math.min(50, Math.max(1.02, r2(0.94 / Math.max(p, 0.019))));
      const ch = (mercado, escolha, extra = {}) => chance({ mercado, escolha, ...extra }, j);
      const tot = j.ao_vivo_casa + j.ao_vivo_fora, L = [tot + 0.5, tot + 1.5].sort((x, y) => Math.abs(ch('gols', 'mais', { linha: x }) - .5) - Math.abs(ch('gols', 'mais', { linha: y }) - .5))[0];
      const base = [j.ao_vivo_casa, j.ao_vivo_fora];
      j.odds_vivo = {
        '1x2': { 1: od(ch('1x2', '1')), X: od(ch('1x2', 'X')), 2: od(ch('1x2', '2')) },
        gols: { linha: L, mais: od(ch('gols', 'mais', { linha: L })), menos: od(ch('gols', 'menos', { linha: L })) },
        ...(j.ao_vivo_casa && j.ao_vivo_fora ? {} : { ambos: { sim: od(ch('ambos', 'sim')), nao: od(ch('ambos', 'nao')) } }),
        proximo: { casa: od(ch('proximo', 'casa', { base })), nenhum: od(ch('proximo', 'nenhum', { base })), fora: od(ch('proximo', 'fora', { base })) },
        escanteios: { linha: 9.5, mais: 1.85, menos: 1.9 },
      };
      j.odds_vivo_em = a; j.ovPlacar = `${j.ao_vivo_casa}:${j.ao_vivo_fora}`; j.travado = false;
    }
    const J = porId();
    for (const x of apostas) if (x.status === 'pendente' && a - x.em >= VIVO_ESPERA_MS) {
      const mudou = x.selecoes.some(sl => { const j = J[sl.jogo]; return j.ao_vivo_casa !== sl.base[0] || j.ao_vivo_fora !== sl.base[1]; });
      if (mudou) { x.status = 'recusada'; x.motivo = 'Saiu gol durante a confirmação'; x.ganho = x.valor; coins = r2(coins + x.valor); } else x.status = 'aberta';
    }
    for (const x of apostas) if (x.status === 'aberta') {
      x.selecoes = x.selecoes.map(sl => !sl.status && antecipa(sl, J[sl.jogo]) ? { ...sl, status: 'ganhou', antecipado: true } : sl)
        .map(sl => { if (sl.status || !['proximo', 'ht', 'primeiro'].includes(sl.mercado)) return sl; const st = situacao(sl, J[sl.jogo], a); return st ? { ...sl, status: st } : sl; });
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
        const c = b.vivo ? conferirVivo(b.selecoes, porId(), a) : conferirBilhete(b.selecoes, porId(), a);
        if (c.erro) erro(c.erro);
        if (valor > coins) erro('Fichas insuficientes');
        coins = r2(coins - valor);
        apostas.unshift({ id: ++seq, valor, odd: c.odd, premio: premioDe(valor, c.odd), selecoes: c.selecoes, status: b.vivo ? 'pendente' : 'aberta', ganho: 0, em: a, vivo: !!b.vivo });
        return { ok: true, id: seq, coins, odd: c.odd, premio: premioDe(valor, c.odd), ...(b.vivo ? { pendente: true, espera: VIVO_ESPERA_MS } : {}) };
      }
      if (b.op === 'confirmar') {
        const x = apostas.find(y => y.id === b.id); if (!x) erro('Aposta não encontrada');
        if (x.status === 'pendente') return { espera: Math.max(0, VIVO_ESPERA_MS - (a - x.em)), coins };
        return { status: x.status === 'recusada' ? 'recusada' : 'aberta', motivo: x.motivo || null, coins };
      }
      if (b.op === 'vivo') {
        return { agora: a, coins, jogos: jogos.filter(j => AO_VIVO.includes(j.status)).map(j => ({ id: j.id, liga: j.liga, ligaNome: j.liga_nome, casa: j.casa, fora: j.fora, inicio: Date.parse(j.inicio), status: j.status, minuto: j.minuto, placar: [j.ao_vivo_casa, j.ao_vivo_fora], odds: j.status === '2H' && j.minuto >= 90 ? null : j.odds_vivo })) };
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
        agora: a, coins, abertas: apostas.filter(x => x.status === 'aberta').length, aoVivo: jogos.filter(j => AO_VIVO.includes(j.status)).length,
        jogos: jogos.filter(j => j.status === 'NS' && Date.parse(j.inicio) - a > MIN).map(j => ({ id: j.id, liga: j.liga, ligaNome: j.liga_nome, casa: j.casa, fora: j.fora, inicio: Date.parse(j.inicio), odds: j.odds, antecipa: temAntecipa(j) })),
      };
    },
  };
}
