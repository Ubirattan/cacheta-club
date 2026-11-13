// Futebol: leitura da API, odds, bilhete simples e múltiplo, odds que mudam, jogo começado,
// resultado (tempo normal), anulado, cota de chamadas e pagamento uma vez só.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { lerOdds, lerJogo, acertou, fechar, conferirBilhete, premioDe, oddTotal, MAX_PREMIO } from '../lib/futebol.js';
import { futebol, usarApi, sincronizar, CFG } from '../lib/futebol-service.js';

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
const R2 = memRepo(); Object.assign(R2.T, { futebol_jogos: [], futebol_apostas: [], futebol_sync: [{ chave: 'cota', v: 1, em: 0, valor: { dia: '2026-11-15', n: CFG.limiteDia() } }] });
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
