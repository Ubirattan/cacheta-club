// Futebol: leitura da API, odds, bilhete simples e múltiplo, odds que mudam, jogo começado,
// resultado (tempo normal), anulado, cota de chamadas e pagamento uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { lerOdds, lerJogo, acertou, fechar, conferirBilhete, premioDe, oddTotal, MAX_PREMIO, r2 } from '../lib/futebol.js';
import { futebol as fb, usarApi, sincronizar, CFG } from '../lib/futebol-service.js';
// como o celular faz: manda 'atualizar' e depois lê
const futebol = async (R, u, b, t) => { if (b.op !== 'apostar') await fb(R, u, { op: 'atualizar' }, t); return fb(R, u, b, t); };

// ---- regras puras ----
assert.equal(acertou('1x2', '1', 2, 1), true); assert.equal(acertou('1x2', 'X', 1, 1), true); assert.equal(acertou('1x2', '2', 1, 1), false);
assert.equal(acertou('dc', '1X', 1, 1), true); assert.equal(acertou('dc', '12', 1, 1), false); assert.equal(acertou('dc', 'X2', 0, 3), true);
assert.equal(acertou('gols', 'mais', 2, 1), true); assert.equal(acertou('gols', 'menos', 1, 1), true);
assert.equal(acertou('ambos', 'sim', 1, 1), true); assert.equal(acertou('ambos', 'nao', 2, 0), true);
assert.equal(oddTotal([2, 1.5, 1.8]), 5.4); assert.equal(premioDe(10, 5.4), 54); assert.equal(premioDe(1000, 999), MAX_PREMIO);

const bk = (id, bets) => ({ id, name: 'bk' + id, bets });
const v = (value, odd) => ({ value, odd: String(odd) });
const ODDS = [bk(6, [{ id: 1, name: 'Match Winner', values: [v('Home', 9), v('Draw', 9), v('Away', 9)] }]),
  bk(8, [{ id: 1, name: 'Match Winner', values: [v('Home', 2.1), v('Draw', 3.2), v('Away', 3.6)] },
    { id: 12, name: 'Double Chance', values: [v('Home/Draw', 1.3), v('Home/Away', 1.35), v('Draw/Away', 1.7)] },
    { id: 5, name: 'Goals Over/Under', values: [v('Over 1.5', 1.3), v('Over 2.5', 1.95), v('Under 2.5', 1.85)] },
    { id: 8, name: 'Both Teams Score', values: [v('Yes', 1.8), v('No', 1.95)] }])];
const o = lerOdds({ bookmakers: ODDS });
assert.deepEqual(o['1x2'], { 1: 2.1, X: 3.2, 2: 3.6 }, 'usa a Bet365 primeiro');
assert.deepEqual(o.gols, { mais: 1.95, menos: 1.85 }); assert.deepEqual(o.ambos, { sim: 1.8, nao: 1.95 }); assert.equal(o.dc['12'], 1.35);
assert.equal(lerOdds({ bookmakers: [] }), null);
assert.equal(lerOdds({ bookmakers: ODDS }, 0.1)['1x2']['1'], 1.89, 'corte de 10%');

// ---- servidor com API de mentira ----
const T0 = Date.UTC(2026, 10, 15, 12, 0);        // 15/11 9h em Brasília
const H = 3600e3;
const fx = (id, liga, casa, fora, inicio, status = 'NS', ft = [null, null]) => ({
  fixture: { id, date: new Date(inicio).toISOString(), status: { short: status } }, league: { id: liga, name: 'Liga ' + liga, logo: '' },
  teams: { home: { name: casa, logo: '' }, away: { name: fora, logo: '' } }, goals: { home: ft[0], away: ft[1] }, score: { fulltime: { home: ft[0], away: ft[1] } },
});
const mundo = {
  1: fx(1, 71, 'Flamengo', 'Palmeiras', T0 + 5 * H), 2: fx(2, 71, 'Santos', 'Grêmio', T0 + 6 * H),
  3: fx(3, 13, 'Boca', 'River', T0 + 30 * H), 4: fx(4, 999, 'Fora', 'Da lista', T0 + 5 * H),
};
const chamadas = [];
usarApi(async (caminho, p) => {
  chamadas.push(caminho);
  if (caminho === 'fixtures' && p.date) return { '2026-11-15': [mundo[1], mundo[2], mundo[4]], '2026-11-16': [mundo[3]] }[p.date] || [];
  if (caminho === 'fixtures' && p.ids) return p.ids.split('-').map(id => mundo[id]).filter(Boolean);
  if (caminho === 'odds') return [{ fixture: { id: p.fixture }, bookmakers: ODDS }];
  return [];
});
process.env.APIFOOTBALL_KEY = 'teste';
const R = memRepo(); Object.assign(R.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [] });
const [u0, u1] = addUsers(R, 2, 1000);
const coins = i => R.T.profiles[i].coins;

let l = await futebol(R, u1, { op: 'jogos' }, T0);
assert.deepEqual(l.jogos.map(j => j.id).sort(), [1, 2, 3], 'só as ligas da lista, com odds');
assert.equal(l.admin, undefined, 'só o admin vê a cota');
assert.equal(chamadas.filter(c => c === 'fixtures').length, 2, 'só hoje e amanhã'); assert.equal(chamadas.filter(c => c === 'odds').length, 3);
// segunda visita logo depois: não chama a API de novo
const antes = chamadas.length;
l = await futebol(R, u0, { op: 'jogos' }, T0 + 60e3);
assert.equal(chamadas.length, antes); assert.equal(l.admin.chamadasHoje, 5);

// bilhetes
const sel = (jogo, mercado, escolha, odd) => ({ jogo, mercado, escolha, odd });
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 4, selecoes: [sel(1, '1x2', '1', 2.1)] }, T0), /de 5 a 1000/);
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 1001, selecoes: [sel(1, '1x2', '1', 2.1)] }, T0), /de 5 a 1000/);
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 10, selecoes: [sel(1, '1x2', '1', 2.5)] }, T0), /odds mudaram/);
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 10, selecoes: [sel(1, '1x2', '1', 2.1), sel(1, 'gols', 'mais', 1.95)] }, T0), /um palpite por jogo/);
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 10, selecoes: [] }, T0), /pelo menos um/);
assert.equal(coins(1), 1000, 'nada foi cobrado');

const s1 = await futebol(R, u1, { op: 'apostar', valor: 100, selecoes: [sel(1, '1x2', '1', 2.1)] }, T0);          // simples: ganha
assert.equal(s1.premio, 210); assert.equal(coins(1), 900);
const m1 = await futebol(R, u1, { op: 'apostar', valor: 10, selecoes: [sel(1, 'ambos', 'sim', 1.8), sel(2, 'gols', 'mais', 1.95), sel(3, 'dc', '1X', 1.3)] }, T0);
assert.equal(m1.odd, oddTotal([1.8, 1.95, 1.3])); assert.equal(coins(1), 890);
const m2 = await futebol(R, u1, { op: 'apostar', valor: 20, selecoes: [sel(1, '1x2', 'X', 3.2), sel(2, '1x2', '1', 2.1)] }, T0); // perde no jogo 1
// jogo começado não aceita aposta
await assert.rejects(futebol(R, u1, { op: 'apostar', valor: 10, selecoes: [sel(1, '1x2', '1', 2.1)] }, T0 + 5 * H - 30e3), /já começou/);
// sem fichas
R.T.profiles[0].coins = 3;
await assert.rejects(futebol(R, u0, { op: 'apostar', valor: 5, selecoes: [sel(1, '1x2', '1', 2.1)] }, T0), /insuficientes/);

// jogo 1 acaba 2x1 na prorrogação? não: tempo normal 2x1 (AET com fulltime 1x1 conta 1x1)
mundo[1] = fx(1, 71, 'Flamengo', 'Palmeiras', T0 + 5 * H, 'FT', [2, 1]);
mundo[2] = fx(2, 71, 'Santos', 'Grêmio', T0 + 6 * H, 'AET', [1, 1]); mundo[2].goals = { home: 3, away: 1 };
let mi = await futebol(R, u1, { op: 'minhas' }, T0 + 5 * H + 20 * 60e3);
assert.equal(mi.apostas.find(a => a.id === s1.id).status, 'aberta', 'ainda no tempo de jogo: não confere');
mi = await futebol(R, u1, { op: 'minhas' }, T0 + 8 * H + 5 * 60e3);
const b = id => mi.apostas.find(a => a.id === id);
assert.equal(b(s1.id).status, 'ganhou'); assert.equal(b(s1.id).ganho, 210);
assert.equal(b(m2.id).status, 'perdeu', 'perdeu no primeiro jogo');
assert.equal(b(m1.id).status, 'perdeu', 'múltipla com um palpite perdido fecha na hora, mesmo faltando o jogo 3');
assert.deepEqual(b(m1.id).selecoes.map(s => s.status), ['ganhou', 'perdeu', null], 'jogo 2: 1x1 no tempo normal, menos de 2,5');
await sincronizar(R, T0 + 9 * H);
assert.equal(coins(1), 890 - 20 + 210);
// pagou uma vez só
await futebol(R, u1, { op: 'minhas' }, T0 + 10 * H);
assert.equal(coins(1), 1080);

// jogo cancelado: aposta simples devolvida, múltipla conta odd 1
const m3 = await futebol(R, u1, { op: 'apostar', valor: 50, selecoes: [sel(3, '1x2', '2', 3.6)] }, T0 + 10 * H);
assert.equal(coins(1), 1030);
mundo[3] = fx(3, 13, 'Boca', 'River', T0 + 30 * H, 'CANC');
await futebol(R, u1, { op: 'minhas' }, T0 + 33 * H);
assert.equal(R.T.futebol_apostas.find(a => a.id === m3.id).status, 'devolvida'); assert.equal(coins(1), 1080);
const f = fechar({ valor: 10, selecoes: [sel(5, '1x2', '1', 2), sel(6, '1x2', '1', 3)] }, { 5: { status: 'FT', gols_casa: 1, gols_fora: 0, inicio: '' }, 6: { status: 'CANC', inicio: '' } });
assert.equal(f.status, 'ganhou'); assert.equal(f.ganho, 20);

// cota do dia: passou do limite, não chama mais
const R2 = memRepo(); Object.assign(R2.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [{ chave: 'cota', v: 1, em: 0, valor: { dia: '2026-11-15', n: 95, lim: 100 } }] });
addUsers(R2, 1); const n0 = chamadas.length;
await futebol(R2, { id: 'u0' }, { op: 'jogos' }, T0);
assert.equal(chamadas.length, n0, 'cota acabou: nenhuma chamada');
// erro da API fica guardado pro admin
usarApi(async () => { throw new Error('API de futebol: Free plans do not have access to this season'); });
const R3 = memRepo(); Object.assign(R3.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [] }); addUsers(R3, 1);
const l3 = await futebol(R3, { id: 'u0' }, { op: 'jogos' }, T0);
assert.match(l3.admin.erro.msg, /Free plans/); assert.deepEqual(l3.jogos, []);
usarApi(null);
// leitura de um jogo da API
assert.equal(lerJogo(fx(9, 71, 'A', 'B', T0, 'PEN', [1, 1])).gols_casa, 1);
assert.equal(conferirBilhete([sel(1, 'xx', '1', 2)], { 1: { status: 'NS', inicio: new Date(T0 + H).toISOString(), odds: {} } }, T0).erro, 'Palpite inválido');
console.log('OK — futebol: odds da API, simples e múltipla, odds mudaram, jogo começado, tempo normal, cancelado, cota e pagamento único');

// ---- plano Pro: placar ao vivo, pagamento antecipado (2 gols) e cash out ----
{
  const { antecipa, cashOut, chance } = await import('../lib/futebol.js');
  const T = Date.UTC(2026, 10, 15, 12, 0), H = 3600e3, odds = { bookmakers: ODDS };
  const vivo = {
    10: fx(10, 71, 'Flamengo', 'Palmeiras', T + 2 * H), 11: fx(11, 71, 'Santos', 'Grêmio', T + 2 * H), 12: fx(12, 71, 'Bahia', 'Vitória', T + 2 * H),
  };
  let chamadasPro = 0;
  usarApi(async (caminho, p) => {
    chamadasPro++;
    let r = [];
    if (caminho === 'fixtures' && p.date) r = p.date === '2026-11-15' ? Object.values(vivo) : [];
    if (caminho === 'fixtures' && p.ids) r = p.ids.split('-').map(id => vivo[id]).filter(Boolean);
    if (caminho === 'odds') r = [{ fixture: { id: p.fixture }, bookmakers: odds.bookmakers }];
    r.limite = 7500; return r;
  });
  const R = memRepo(); Object.assign(R.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [] });
  const [u] = addUsers(R, 1, 1000);
  const fb2 = async (b, t) => { if (b.op !== 'apostar' && b.op !== 'cashout') await fb(R, u, { op: 'atualizar' }, t); return fb(R, u, b, t); };
  let l = await fb2({ op: 'jogos' }, T);
  l = await fb2({ op: 'jogos' }, T + 4 * 60e3);            // 2ª rodada de odds/ plano detectado
  assert.equal(l.admin.pro, true, 'detecta o plano Pro pela resposta da API');
  assert.ok(l.admin.limite > 7000);
  const sim = await fb2({ op: 'apostar', valor: 100, selecoes: [sel(10, '1x2', '1', 2.1)] }, T + 5 * 60e3);
  const mul = await fb2({ op: 'apostar', valor: 10, selecoes: [sel(10, '1x2', '1', 2.1), sel(11, '1x2', '2', 3.6)] }, T + 5 * 60e3);
  const co = await fb2({ op: 'apostar', valor: 50, selecoes: [sel(12, 'gols', 'mais', 1.95)] }, T + 5 * 60e3);
  // antes do jogo: cash out abaixo da aposta
  let m = await fb2({ op: 'minhas' }, T + 6 * 60e3);
  const c0 = m.apostas.find(a => a.id === sim.id).cashout;
  assert.ok(c0 > 70 && c0 < 100, 'cash out antes do jogo: ' + c0);
  // jogo rolando: Flamengo 2x0 aos 30' → pagamento antecipado
  const rola = (id, st, min, h, a) => { vivo[id] = fx(id, 71, vivo[id].teams.home.name, vivo[id].teams.away.name, T + 2 * H, st); vivo[id].fixture.status.elapsed = min; vivo[id].goals = { home: h, away: a }; };
  rola(10, '1H', 30, 2, 0); rola(11, '1H', 30, 0, 0); rola(12, '1H', 30, 1, 1);
  const antes = R.T.profiles[0].coins;
  m = await fb2({ op: 'minhas' }, T + 2 * H + 31 * 60e3);
  const bs = id => m.apostas.find(a => a.id === id);
  assert.equal(bs(sim.id).status, 'ganhou', 'simples paga na hora com 2 gols de vantagem');
  assert.equal(R.T.profiles[0].coins, antes + 210);
  assert.equal(bs(mul.id).status, 'aberta'); assert.equal(bs(mul.id).selecoes[0].status, 'ganhou'); assert.equal(bs(mul.id).selecoes[0].antecipado, true);
  assert.equal(bs(mul.id).selecoes[1].minuto, 30);
  // depois o Palmeiras empata: o palpite antecipado continua ganho
  rola(10, '2H', 80, 2, 2); rola(11, '2H', 80, 0, 1); rola(12, '2H', 80, 1, 1);
  m = await fb2({ op: 'minhas' }, T + 2 * H + 82 * 60e3);
  assert.equal(bs(mul.id).selecoes[0].status, 'ganhou', 'antecipado não volta atrás');
  // cash out: 1x1 aos 80' com "mais de 2,5" precisa de mais 1 gol → vale menos que a aposta
  const cv = bs(co.id).cashout;
  assert.ok(cv > 0 && cv < 50, 'cash out ' + cv);
  await assert.rejects(fb2({ op: 'cashout', id: co.id, valor: cv * 1.2 }, T + 2 * H + 82 * 60e3), /valor mudou/);
  const cAntes = R.T.profiles[0].coins;
  const pago = await fb2({ op: 'cashout', id: co.id, valor: cv }, T + 2 * H + 82 * 60e3);
  assert.equal(pago.ganho, cv); assert.equal(R.T.profiles[0].coins, r2(cAntes + cv));
  await assert.rejects(fb2({ op: 'cashout', id: co.id, valor: cv }, T + 2 * H + 82 * 60e3), /já foi encerrada/);
  // o jogo termina 3x1 (teria ganho): o cash out não paga de novo
  rola(12, 'FT', 90, 3, 1); vivo[12].score.fulltime = { home: 3, away: 1 };
  rola(11, 'FT', 90, 0, 1); vivo[11].score.fulltime = { home: 0, away: 1 };
  rola(10, 'FT', 90, 2, 2); vivo[10].score.fulltime = { home: 2, away: 2 };
  const fim = R.T.profiles[0].coins;
  m = await fb2({ op: 'minhas' }, T + 2 * H + 120 * 60e3);
  assert.equal(bs(co.id).status, 'cashout');
  assert.equal(bs(mul.id).status, 'ganhou', 'múltipla: 1º jogo antecipado + 2º acertado');
  assert.equal(R.T.profiles[0].coins, r2(fim + 10 * oddTotal([2.1, 3.6])));
  // regras puras
  assert.equal(antecipa({ mercado: '1x2', escolha: '2', antecipa: true }, { status: '2H', ao_vivo_casa: 0, ao_vivo_fora: 2 }), true);
  assert.equal(antecipa({ mercado: '1x2', escolha: '2' }, { status: '2H', ao_vivo_casa: 0, ao_vivo_fora: 2 }), false, 'campeonato sem antecipado');
  const { ligaDe, temAntecipa, conferirBilhete: cb } = await import('../lib/futebol.js');
  assert.equal(ligaDe({ id: 39, name: 'Premier League', country: 'England' }).nome, 'Inglês');
  assert.equal(ligaDe({ id: 9999, name: 'Paulista - A1', country: 'Brazil' }).nome, 'Paulistão');
  assert.equal(ligaDe({ id: 9998, name: 'Paulista - A2', country: 'Brazil' }), null);
  assert.equal(ligaDe({ id: 9997, name: 'Carioca - 1', country: 'Brazil' }).nome, 'Carioca');
  assert.equal(ligaDe({ id: 5, name: 'Outra', country: 'Peru' }), null);
  assert.equal(temAntecipa({ liga: 72 }), false); assert.equal(temAntecipa({ liga: 169 }), true); assert.equal(temAntecipa({ liga: 9999, liga_nome: 'Paulistão' }), true);
  const jb = { status: 'NS', inicio: new Date(T + 5 * H).toISOString(), odds: { '1x2': { 1: 2, X: 3, 2: 4 } }, casa: 'A', fora: 'B', liga: 72 };
  assert.equal(cb([{ jogo: 1, mercado: '1x2', escolha: '1', odd: 2 }], { 1: jb }, T).selecoes[0].antecipa, undefined, 'Série B sem antecipado');
  assert.equal(cb([{ jogo: 1, mercado: '1x2', escolha: '1', odd: 2 }], { 1: { ...jb, liga: 71 } }, T).selecoes[0].antecipa, true);
  assert.equal(cb([{ jogo: 1, mercado: '1x2', escolha: 'X', odd: 3 }], { 1: { ...jb, liga: 71 } }, T).selecoes[0].antecipa, undefined);
  assert.equal(antecipa({ mercado: '1x2', escolha: '1' }, { status: 'ET', ao_vivo_casa: 3, ao_vivo_fora: 1 }), false, 'prorrogação não conta');
  assert.equal(antecipa({ mercado: 'dc', escolha: '1X' }, { status: '2H', ao_vivo_casa: 2, ao_vivo_fora: 0 }), false, 'só resultado final');
  assert.equal(cashOut({ valor: 10, selecoes: [{ jogo: 1, mercado: '1x2', escolha: '1', odd: 2, status: 'perdeu' }] }, {}), null);
  usarApi(null);
  console.log('OK — futebol Pro: placar ao vivo, pagamento antecipado com 2 gols e cash out (' + chamadasPro + ' chamadas)');
}

// ---- escanteios e cartões ----
{
  const { lerOdds: lo, situacao: si, rotulo: ro } = await import('../lib/futebol.js');
  const bkx = [{ id: 8, bets: [{ id: 1, name: 'Match Winner', values: [v('Home', 2), v('Draw', 3), v('Away', 4)] },
    { id: 45, name: 'Corners Over Under', values: [v('Over 8.5', 1.5), v('Under 8.5', 2.5), v('Over 9.5', 1.85), v('Under 9.5', 1.9), v('Over 10.5', 2.4), v('Under 10.5', 1.5)] },
    { id: 57, name: 'Home Corners Over/Under', values: [v('Over 4.5', 1.9), v('Under 4.5', 1.9)] },
    { id: 80, name: 'Cards Over/Under', values: [v('Over 4.5', 1.8), v('Under 4.5', 1.95)] }] }];
  const ox = lo({ bookmakers: bkx });
  assert.deepEqual(ox.escanteios, { linha: 9.5, mais: 1.85, menos: 1.9 }, 'linha mais equilibrada do jogo todo');
  assert.deepEqual(ox.cartoes, { linha: 4.5, mais: 1.8, menos: 1.95 });
  assert.equal(ro('escanteios', 'mais', 'a', 'b', 9.5), 'Mais de 9,5 escanteios');
  const T = Date.UTC(2026, 10, 15, 12, 0), H = 3600e3;
  const g = { 20: fx(20, 71, 'Grêmio', 'Inter', T + 2 * H) };
  let stats = 0;
  usarApi(async (c, p) => {
    let r = [];
    if (c === 'fixtures' && p.date) r = p.date === '2026-11-15' ? [g[20]] : [];
    if (c === 'fixtures' && p.ids) r = [g[20]];
    if (c === 'odds') r = [{ fixture: { id: p.fixture }, bookmakers: bkx }];
    if (c === 'fixtures/statistics') { stats++; r = [{ statistics: [{ type: 'Corner Kicks', value: 6 }, { type: 'Yellow Cards', value: 2 }, { type: 'Red Cards', value: null }] },
      { statistics: [{ type: 'Corner Kicks', value: 5 }, { type: 'Yellow Cards', value: 3 }, { type: 'Red Cards', value: 1 }] }]; }
    r.limite = 7500; return r;
  });
  const R = memRepo(); Object.assign(R.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [] });
  const [u] = addUsers(R, 1, 1000);
  const go = async (b, t) => { if (b.op !== 'apostar') await fb(R, u, { op: 'atualizar' }, t); return fb(R, u, b, t); };
  await go({ op: 'jogos' }, T);
  await assert.rejects(go({ op: 'apostar', valor: 10, selecoes: [{ jogo: 20, mercado: 'escanteios', escolha: 'mais', odd: 1.85, linha: 8.5 }] }, T), /odds mudaram/, 'linha diferente');
  const e1 = await go({ op: 'apostar', valor: 10, selecoes: [{ jogo: 20, mercado: 'escanteios', escolha: 'mais', odd: 1.85, linha: 9.5 }] }, T);
  const c1 = await go({ op: 'apostar', valor: 10, selecoes: [{ jogo: 20, mercado: 'cartoes', escolha: 'mais', odd: 1.8, linha: 4.5 }] }, T);
  let m = await go({ op: 'minhas' }, T + 60e3);
  assert.ok(m.apostas.find(a => a.id === e1.id).cashout > 0, 'cash out antes do jogo');
  g[20] = fx(20, 71, 'Grêmio', 'Inter', T + 2 * H, '1H'); g[20].fixture.status.elapsed = 20; g[20].goals = { home: 0, away: 0 };
  m = await go({ op: 'minhas' }, T + 2 * H + 21 * 60e3);
  assert.equal(m.apostas.find(a => a.id === e1.id).cashout, null, 'sem cash out com o jogo rolando');
  g[20] = fx(20, 71, 'Grêmio', 'Inter', T + 2 * H, 'FT', [1, 0]);
  const antes = R.T.profiles[0].coins;
  m = await go({ op: 'minhas' }, T + 4 * H);
  assert.equal(m.apostas.find(a => a.id === e1.id).status, 'ganhou', '11 escanteios > 9,5');
  assert.equal(m.apostas.find(a => a.id === e1.id).selecoes[0].total, 11);
  assert.equal(m.apostas.find(a => a.id === c1.id).status, 'ganhou', '6 cartões > 4,5');
  assert.equal(R.T.profiles[0].coins, r2(antes + 18.5 + 18)); assert.equal(stats, 1);
  assert.equal(si({ mercado: 'escanteios', escolha: 'mais', linha: 9.5 }, { status: 'AET', inicio: '' }), 'anulada', 'prorrogação anula');
  assert.equal(si({ mercado: 'cartoes', escolha: 'menos', linha: 4.5 }, { status: 'FT', inicio: new Date(T).toISOString(), cartoes: null }, T + 31 * H), 'anulada', 'sem estatística por 30 h anula');
  usarApi(null);
  console.log('OK — futebol: escanteios e cartões (linha, estatística do jogo, prorrogação anula)');
}

// ---- 1º tempo, quem marca primeiro, handicap e placar exato ----
{
  const F = await import('../lib/futebol.js');
  const bky = [{ id: 8, bets: [{ id: 1, name: 'Match Winner', values: [v('Home', 2), v('Draw', 3.3), v('Away', 3.8)] },
    { id: 13, name: 'First Half Winner', values: [v('Home', 2.7), v('Draw', 2.1), v('Away', 4.5)] },
    { id: 14, name: 'Team To Score First', values: [v('Home', 1.7), v('Draw', 9), v('Away', 2.6)] },
    { id: 4, name: 'Asian Handicap', values: [v('Home -1', 2.9), v('Away +1', 1.4), v('Home -0.5', 2.0), v('Away +0.5', 1.85), v('Home -1.5', 3.6), v('Away +1.5', 1.3), v('Home -0.25', 1.7), v('Away +0.25', 2.1)] },
    { id: 10, name: 'Exact Score', values: ['1:0', '0:0', '1:1', '2:1', '0:1', '2:0', '1:2', '2:2', '3:0', '3:1', '0:2', '3:2', '4:0', '0:3', '4:1', '1:3', '5:0', '9:9'].map((k, i) => v(k, 6 + i * 2)) }] }];
  const oy = F.lerOdds({ bookmakers: bky });
  assert.deepEqual(oy.ht, { 1: 2.7, X: 2.1, 2: 4.5 }); assert.deepEqual(oy.primeiro, { casa: 1.7, nenhum: 9, fora: 2.6 });
  assert.deepEqual(oy.handicap, { linha: -0.5, casa: 2, fora: 1.85 }, 'só linhas ,5 e a mais equilibrada');
  assert.equal(Object.keys(oy.placar).length, 16); assert.ok(!oy.placar['9:9']);
  assert.equal(F.rotulo('handicap', 'casa', 'Fla', 'Pal', -1.5), 'Fla -1,5'); assert.equal(F.rotulo('handicap', 'fora', 'Fla', 'Pal', -1.5), 'Pal +1,5');
  assert.equal(F.acertou('handicap', 'casa', 2, 0, -1.5), true); assert.equal(F.acertou('handicap', 'casa', 1, 0, -1.5), false);
  assert.equal(F.acertou('handicap', 'fora', 1, 0, -1.5), true);
  assert.equal(F.acertou('placar', '2:1', 2, 1), true);
  const T = Date.UTC(2026, 10, 15, 12, 0), H = 3600e3;
  const s = (mercado, escolha, extra = {}) => ({ jogo: 1, mercado, escolha, odd: 2, ...extra });
  // 1º tempo decide no intervalo
  assert.equal(F.situacao(s('ht', '1'), { status: '1H', ht_casa: null }), null);
  assert.equal(F.situacao(s('ht', '1'), { status: 'HT', ht_casa: 1, ht_fora: 0 }), 'ganhou');
  assert.equal(F.situacao(s('ht', 'X'), { status: '2H', ht_casa: 1, ht_fora: 0 }), 'perdeu');
  // quem marca primeiro (acompanhando o placar)
  assert.equal(F.primeiroGol(null, { status: '1H', ao_vivo_casa: 0, ao_vivo_fora: 1 }), 'fora');
  assert.equal(F.primeiroGol({ primeiro: 'fora' }, { status: '2H', ao_vivo_casa: 3, ao_vivo_fora: 1 }), 'fora', 'não muda depois');
  assert.equal(F.primeiroGol(null, { status: '2H', ao_vivo_casa: 1, ao_vivo_fora: 1 }), '?');
  assert.equal(F.situacao(s('primeiro', 'fora'), { status: '2H', primeiro: 'fora' }), 'ganhou', 'paga quando sai o 1º gol');
  assert.equal(F.situacao(s('primeiro', 'nenhum'), { status: 'FT', gols_casa: 0, gols_fora: 0 }), 'ganhou');
  assert.equal(F.situacao(s('primeiro', 'casa'), { status: 'FT', gols_casa: 2, gols_fora: 0 }), 'ganhou', 'sem acompanhar: 2x0 foi a casa');
  assert.equal(F.situacao(s('primeiro', 'casa'), { status: '2H', primeiro: '?' }), 'anulada');
  assert.equal(F.situacao(s('handicap', 'casa', { linha: -1.5 }), { status: 'FT', gols_casa: 3, gols_fora: 1 }), 'ganhou');
  // cash out com os novos palpites (chance entre 0 e 1)
  const j = { status: '1H', minuto: 20, ao_vivo_casa: 0, ao_vivo_fora: 0, odds: oy, atualizado: new Date(T).toISOString(), inicio: '' };
  for (const sl of [s('ht', '1'), s('primeiro', 'casa'), s('handicap', 'casa', { linha: -0.5 }), s('placar', '1:0')]) {
    const c = F.chance(sl, j); assert.ok(c > 0 && c < 1, sl.mercado + ' ' + c);
  }
  assert.equal(F.conferirBilhete([{ jogo: 1, mercado: 'placar', escolha: '1:0', odd: oy.placar['1:0'] }], { 1: { status: 'NS', inicio: new Date(T + H).toISOString(), odds: oy, casa: 'A', fora: 'B' } }, T).odd, oy.placar['1:0']);
  console.log('OK — futebol: 1º tempo, quem marca primeiro, handicap e placar exato');
}

// ---- Criar aposta ----
{
  const F = await import('../lib/futebol.js');
  const T = Date.UTC(2026, 10, 15, 12, 0), H = 3600e3;
  const odds = { '1x2': { 1: 2.1, X: 3.3, 2: 3.6 }, gols: { mais: 1.95, menos: 1.85 }, ambos: { sim: 1.8, nao: 1.95 }, ht: { 1: 2.8, X: 2.1, 2: 4.2 }, escanteios: { linha: 9.5, mais: 1.85, menos: 1.9 } };
  const P = (mercado, escolha, linha) => ({ mercado, escolha, ...(linha ? { linha } : {}) });
  const c = F.oddCombo([P('1x2', '1'), P('gols', 'mais')], odds);
  assert.ok(c.odd > 2.5 && c.odd < 2.1 * 1.95, 'odd do combo menor que a multiplicação: ' + c.odd);
  assert.match(F.oddCombo([P('1x2', '1')], odds).erro, /pelo menos 2/);
  assert.match(F.oddCombo([P('1x2', '1'), P('1x2', 'X')], odds).erro, /um palpite de cada tipo/i);
  assert.ok(F.oddCombo([P('1x2', '1'), P('ht', '2'), P('gols', 'mais')], odds).odd > 10, 'virada: improvável mas possível');
  assert.match(F.oddCombo([P('1x2', '1'), P('ht', '2'), P('ambos', 'nao')], odds).erro, /impossível/, 'casa vence virando sem os dois marcarem');
  assert.match(F.oddCombo([P('gols', 'menos'), P('1x2', '1'), P('placar', '3:0')], { ...odds, placar: { '3:0': 15 } }).erro, /Placar exato não entra/);
  const jogo = { status: 'NS', inicio: new Date(T + H).toISOString(), odds, casa: 'A', fora: 'B', liga_nome: 'L' };
  const sel = { jogo: 1, mercado: 'combo', escolha: 'combo', odd: c.odd, partes: [P('1x2', '1'), P('gols', 'mais')] };
  const b = F.conferirBilhete([sel], { 1: jogo }, T);
  assert.equal(b.odd, c.odd); assert.equal(b.selecoes[0].partes.length, 2);
  assert.ok(F.conferirBilhete([{ ...sel, odd: c.odd + 0.2 }], { 1: jogo }, T).mudou, 'odd diferente');
  const ss = b.selecoes[0];
  assert.equal(F.situacao(ss, { status: 'FT', gols_casa: 2, gols_fora: 1 }), 'ganhou');
  assert.equal(F.situacao(ss, { status: 'FT', gols_casa: 1, gols_fora: 0 }), 'perdeu');
  assert.equal(F.situacao(ss, { status: '2H', ao_vivo_casa: 0, ao_vivo_fora: 3 }), null);
  const comEsc = F.oddCombo([P('1x2', '1'), P('escanteios', 'mais', 9.5)], odds);
  assert.equal(F.situacao({ mercado: 'combo', partes: comEsc.partes }, { status: 'AET', gols_casa: 1, gols_fora: 0 }), 'anulada', 'escanteio com prorrogação anula o combo');
  // cash out do combo com o jogo rolando: 2x0 aos 60' → chance alta de "casa + mais de 2,5"? precisa de mais 1 gol
  const vivo = { status: '2H', minuto: 60, ao_vivo_casa: 2, ao_vivo_fora: 0, ht_casa: 1, ht_fora: 0, odds, atualizado: new Date(T).toISOString(), inicio: '' };
  const cv = F.cashOut({ valor: 10, selecoes: [ss] }, { 1: vivo }, T);
  assert.ok(cv > 3 && cv < 10 * c.odd, 'cash out do combo: ' + cv);
  assert.equal(F.cashOut({ valor: 10, selecoes: [{ ...ss, partes: comEsc.partes }] }, { 1: vivo }, T), null, 'escanteio rolando: sem cash out');
  console.log('OK — futebol: Criar aposta (odd do combo, impossível, conferência, anulação e cash out)');
}

// ---- apostas ao vivo ----
{
  const F = await import('../lib/futebol.js');
  const T = Date.UTC(2026, 10, 15, 18, 0), H = 3600e3, S = 1000;
  const live = (id, h, a, min, extra = {}) => { const f = fx(id, 71, 'Fla', 'Pal', T - min * 60e3, min > 45 ? '2H' : '1H'); f.fixture.status.elapsed = min; f.goals = { home: h, away: a }; return f; };
  let jogo = live(30, 1, 0, 30), travado = false;
  const oddsVivo = () => ({ fixture: { id: 30 }, status: { blocked: travado }, teams: { home: { goals: jogo.goals.home }, away: { goals: jogo.goals.away } }, odds: [
    { id: 59, name: 'Fulltime Result', values: [{ value: 'Home', odd: '1.50' }, { value: 'Draw', odd: '3.80' }, { value: 'Away', odd: '7.00' }] },
    { id: 36, name: 'Over/Under Line', values: [{ value: 'Over', handicap: '2.5', odd: '1.90', main: true }, { value: 'Under', handicap: '2.5', odd: '1.85', main: true }] },
    { id: 41, name: 'Next Goal', values: [{ value: '1', odd: '1.90' }, { value: 'No goal', odd: '4.00' }, { value: '2', odd: '2.60' }] }] });
  let chamadasVivo = [];
  usarApi(async (c, p) => {
    chamadasVivo.push(c); let r = [];
    if (c === 'fixtures' && p.live) r = [jogo, { ...live(31, 0, 0, 10), league: { id: 5, name: 'Outra', country: 'Peru' } }];
    if (c === 'fixtures' && p.ids) r = [jogo];
    if (c === 'fixtures' && p.date) r = [];
    if (c === 'odds/live') r = [oddsVivo()];
    if (c === 'odds') r = [];
    r.limite = 7500; return r;
  });
  const R = memRepo(); Object.assign(R.T, { futebol_jogos: [{ id: 30, liga: 71, liga_nome: 'Brasileirão A', casa: 'Fla', fora: 'Pal', inicio: new Date(T - 30 * 60e3).toISOString(), status: 'NS', odds: { '1x2': { 1: 2, X: 3.3, 2: 3.8 } }, atualizado: new Date(T - H).toISOString() }], futebol_apostas: [], futebol_sync: [{ chave: 'cota', v: 1, em: 0, valor: { dia: '2026-11-15', n: 0, lim: 7500 } }] });
  const [u] = addUsers(R, 1, 1000);
  const go = async (b, t) => { if (!['apostar', 'confirmar'].includes(b.op)) await fb(R, u, { op: 'atualizar' }, t); return fb(R, u, b, t); };
  let v = await go({ op: 'vivo' }, T);
  assert.equal(v.jogos.length, 1, 'só jogos dos nossos campeonatos'); assert.deepEqual(v.jogos[0].placar, [1, 0]); assert.equal(v.jogos[0].minuto, 30);
  assert.equal(v.jogos[0].odds['1x2']['1'], 1.5); assert.deepEqual(v.jogos[0].odds.gols, { linha: 2.5, mais: 1.9, menos: 1.85 });
  assert.equal((await fb(R, u, { op: 'jogos' }, T)).aoVivo, 1);
  // aposta vivo: fica pendente e desconta
  const sel = { jogo: 30, mercado: 'proximo', escolha: 'casa', odd: 1.9 };
  const ap = await go({ op: 'apostar', vivo: true, valor: 100, selecoes: [sel] }, T + S);
  assert.equal(ap.pendente, true); assert.equal(R.T.profiles[0].coins, 900);
  assert.deepEqual(R.T.futebol_apostas[0].selecoes[0].base, [1, 0]);
  assert.ok((await fb(R, u, { op: 'confirmar', id: ap.id }, T + 3 * S)).espera > 0, 'ainda esperando');
  let c = await fb(R, u, { op: 'confirmar', id: ap.id }, T + 8 * S);
  assert.equal(c.status, 'aberta', 'confirmada sem gol');
  // gol durante a espera: recusada e devolvida
  const ap2 = await go({ op: 'apostar', vivo: true, valor: 50, selecoes: [{ jogo: 30, mercado: '1x2', escolha: '1', odd: 1.5 }] }, T + 20 * S);
  jogo = live(30, 2, 0, 31);
  c = await fb(R, u, { op: 'confirmar', id: ap2.id }, T + 28 * S);
  assert.equal(c.status, 'recusada'); assert.match(c.motivo, /gol/); assert.equal(R.T.profiles[0].coins, 850 + 50);
  // a primeira (próximo gol: casa) ganhou com o 2x0
  const m = await go({ op: 'minhas' }, T + 70 * S);
  assert.equal(m.apostas.find(a => a.id === ap.id).status, 'ganhou'); assert.equal(R.T.profiles[0].coins, 900 + 190);
  // travado: não aceita
  travado = true; await go({ op: 'vivo' }, T + 100 * S);
  await assert.rejects(go({ op: 'apostar', vivo: true, valor: 10, selecoes: [{ jogo: 30, mercado: '1x2', escolha: '1', odd: 1.5 }] }, T + 101 * S), /travad/);
  travado = false; await go({ op: 'vivo' }, T + 130 * S);
  // odd caiu durante a espera: recusa
  const ap3 = await go({ op: 'apostar', vivo: true, valor: 10, selecoes: [{ jogo: 30, mercado: 'gols', escolha: 'mais', odd: 1.9, linha: 2.5 }] }, T + 131 * S);
  const antes = R.T.profiles[0].coins;
  const sv = oddsVivo; // odd do "mais" cai pra 1.70
  usarApi(async (cc, p) => { const r = cc === 'odds/live' ? [{ ...sv(), odds: [{ id: 36, name: 'Over/Under Line', values: [{ value: 'Over', handicap: '2.5', odd: '1.70', main: true }, { value: 'Under', handicap: '2.5', odd: '2.10', main: true }] }] }] : []; r.limite = 7500; return r; });
  c = await fb(R, u, { op: 'confirmar', id: ap3.id }, T + 140 * S);
  assert.equal(c.status, 'recusada'); assert.match(c.motivo, /odd caiu/); assert.equal(R.T.profiles[0].coins, antes + 10);
  // pendente esquecida: o sincronizar confirma sozinho
  usarApi(async (cc) => { const r = cc === 'odds/live' ? [oddsVivo()] : cc === 'fixtures' ? [jogo] : []; r.limite = 7500; return r; });
  await go({ op: 'vivo' }, T + 199 * S);
  const ap4 = await go({ op: 'apostar', vivo: true, valor: 10, selecoes: [{ jogo: 30, mercado: '1x2', escolha: 'X', odd: 3.8 }] }, T + 200 * S);
  await sincronizar(R, T + 215 * S);
  assert.equal(R.T.futebol_apostas.find(a => a.id === ap4.id).status, 'aberta');
  // linha de gols ao vivo vale no fim: 2x0 com "mais de 2,5" perde
  assert.equal(F.acertou('gols', 'mais', 2, 0, 2.5), false); assert.equal(F.acertou('gols', 'mais', 3, 1, 3.5), true);
  assert.equal(F.situacao({ mercado: 'proximo', escolha: 'nenhum', base: [1, 0] }, { status: 'FT', gols_casa: 1, gols_fora: 0 }), 'ganhou');
  assert.equal(F.situacao({ mercado: 'proximo', escolha: 'casa', base: [1, 0] }, { status: '2H', ao_vivo_casa: 2, ao_vivo_fora: 1 }), 'anulada');
  usarApi(null);
  console.log('OK — futebol ao vivo: odds ao vivo, espera de 7 s, gol/odd caiu/trava recusam e devolvem, próximo gol');
}
