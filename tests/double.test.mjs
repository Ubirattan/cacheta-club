// Double: cores, pagamento 2x/14x, retorno ~93%, rodada ao vivo, apostas e resultado escondido.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { corDe, FAIXA, PAGA, CASAS, APOSTAS_MS, GIRO_MS, PAUSA_MS } from '../lib/double.js';
import { double, rodadaAtual } from '../lib/double-service.js';

assert.equal(corDe(0), 'branco'); assert.equal(corDe(7), 'vermelho'); assert.equal(corDe(8), 'preto');
assert.deepEqual([...FAIXA].sort((a, b) => a - b), [...Array(CASAS).keys()], 'faixa tem as 15 casas');
const cont = c => [...Array(CASAS).keys()].filter(n => corDe(n) === c).length;
for (const c of ['vermelho', 'preto', 'branco']) { const rtp = cont(c) / CASAS * PAGA[c]; assert.ok(Math.abs(rtp - 14 / 15) < 1e-9, c + ' ' + rtp); }

const R = memRepo(); R.T.double_rodadas = []; R.T.double_apostas = [];
const [u0, u1] = addUsers(R, 2, 1000);
const coins = i => R.T.profiles[i].coins;
let t = 1_000_000_000_000;
await rodadaAtual(R, t, () => 3);          // vai cair no 3 (vermelho)
let st = await double(R, u0, { op: 'estado' }, t);
assert.equal(st.rodada.fase, 'apostas'); assert.equal(st.rodada.resultado, undefined, 'não mostra o resultado antes');
await double(R, u0, { op: 'apostar', cor: 'vermelho', valor: 100 }, t + 10);
await double(R, u0, { op: 'apostar', cor: 'vermelho', valor: 50 }, t + 20);   // soma
await double(R, u0, { op: 'apostar', cor: 'branco', valor: 10 }, t + 30);
await double(R, u1, { op: 'apostar', cor: 'preto', valor: 40 }, t + 40);
await assert.rejects(double(R, u0, { op: 'apostar', cor: 'azul', valor: 5 }, t + 50), /Escolha/);
await assert.rejects(double(R, u0, { op: 'apostar', cor: 'preto', valor: 9999 }, t + 50), /Aposte de/);
await assert.rejects(double(R, u0, { op: 'apostar', cor: 'vermelho', valor: 400 }, t + 50), /No máximo/);
assert.equal(coins(0), 840); assert.equal(coins(1), 960);
st = await double(R, u0, { op: 'estado' }, t + 60);
assert.equal(st.minhas.find(m => m.cor === 'vermelho').valor, 150); assert.equal(st.totais.vermelho.soma, 150); assert.equal(st.totais.preto.qtd, 1);
// girando: mostra o resultado e não aceita aposta
const g = t + APOSTAS_MS + 100;
st = await double(R, u0, { op: 'estado' }, g);
assert.equal(st.rodada.fase, 'girando'); assert.equal(st.rodada.resultado, 3);
await assert.rejects(double(R, u0, { op: 'apostar', cor: 'preto', valor: 5 }, g), /girando/);
// parou: paga vermelho 2x
st = await double(R, u0, { op: 'estado' }, t + APOSTAS_MS + GIRO_MS + 10);
assert.equal(st.rodada.fase, 'resultado');
assert.equal(coins(0), 840 + 300); assert.equal(coins(1), 960);
assert.equal(st.minhas.find(m => m.cor === 'vermelho').status, 'ganhou'); assert.equal(st.minhas.find(m => m.cor === 'branco').status, 'perdeu');
// próxima rodada e histórico; branco paga 14x
const t2 = t + APOSTAS_MS + GIRO_MS + PAUSA_MS + 10;
await rodadaAtual(R, t2, () => 0);
st = await double(R, u1, { op: 'estado' }, t2 + 5);
assert.equal(st.rodada.num, 2); assert.deepEqual(st.historico, [3]);
await double(R, u1, { op: 'apostar', cor: 'branco', valor: 10 }, t2 + 10);
await double(R, u1, { op: 'estado' }, t2 + 5 + APOSTAS_MS + GIRO_MS + 100);
assert.equal(coins(1), 960 - 10 + 140);
console.log('OK — Double: 2x/14x, retorno ~93%, rodada ao vivo, apostas somam, resultado escondido');
