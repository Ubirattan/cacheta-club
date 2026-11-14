// Jogo do bicho: grupos, conferência, pagamento na cabeça e do 1º ao 5º, horários e liquidação.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { grupoDe, dezenasDo, conferir, ganho, proximoSorteio, chaveDe, FECHA_ANTES_MS } from '../lib/bicho.js';
import { jogoDoBicho, liquidar } from '../lib/bicho-service.js';

assert.equal(grupoDe(1), 1); assert.equal(grupoDe(4), 1); assert.equal(grupoDe(5), 2); assert.equal(grupoDe(9900), 25); assert.equal(grupoDe(1297), 25); assert.equal(grupoDe(4366), 17);
assert.deepEqual(dezenasDo(25), ['97', '98', '99', '00']); assert.deepEqual(dezenasDo(1), ['01', '02', '03', '04']);
assert.ok(conferir({ tipo: 'dezena', palpite: '7', pos: 'cabeca', valor: 5 }).erro);
assert.deepEqual(conferir({ tipo: 'milhar', palpite: '0042', pos: 'todos', valor: 2 }), { tipo: 'milhar', palpite: '0042', pos: 'todos', valor: 2 });
const P = [4366, 1297, 42, 5501, 8817];
assert.equal(ganho({ tipo: 'grupo', palpite: '17', pos: 'cabeca', valor: 10 }, P), 180);
assert.equal(ganho({ tipo: 'grupo', palpite: '25', pos: 'cabeca', valor: 10 }, P), 0);
assert.equal(ganho({ tipo: 'grupo', palpite: '25', pos: 'todos', valor: 10 }, P), 36);   // 2º prêmio: 10×18/5
assert.equal(ganho({ tipo: 'dezena', palpite: '66', pos: 'cabeca', valor: 2 }, P), 120);
assert.equal(ganho({ tipo: 'centena', palpite: '042', pos: 'todos', valor: 5 }, P), 600);
assert.equal(ganho({ tipo: 'milhar', palpite: '4366', pos: 'cabeca', valor: 5 }, P), 4000, 'prêmio máximo 4 mil');

// horários: 13/11/2026 10:00 de Brasília (13:00 UTC) → próximo é 11h; às 10:59:30 já fechou, vai pras 14h
const dez = Date.UTC(2026, 10, 13, 13, 0);
assert.equal(chaveDe(proximoSorteio(dez)), '2026-11-13 11h');
assert.equal(chaveDe(proximoSorteio(dez + 59 * 60e3 + 30e3)), '2026-11-13 14h');
assert.equal(chaveDe(proximoSorteio(Date.UTC(2026, 10, 14, 1, 0))), '2026-11-14 11h', '22h → amanhã 11h');

const repo = memRepo(); addUsers(repo, 2, 1000);
let s = await jogoDoBicho(repo, { id: 'u0' }, { op: 'estado' }, dez);
assert.equal(s.proximo.hora, Date.UTC(2026, 10, 13, 14, 0));
await jogoDoBicho(repo, { id: 'u0' }, { op: 'apostar', aposta: { tipo: 'grupo', palpite: 17, pos: 'cabeca', valor: 10 } }, dez);
await jogoDoBicho(repo, { id: 'u1' }, { op: 'apostar', aposta: { tipo: 'milhar', palpite: '1234', pos: 'cabeca', valor: 3 } }, dez);
await assert.rejects(() => jogoDoBicho(repo, { id: 'u1' }, { op: 'apostar', aposta: { tipo: 'grupo', palpite: 3, pos: 'cabeca', valor: 998 } }, dez), /No máximo 1000/);
assert.equal((await repo.getProfile('u0')).coins, 990);
const hora = Date.UTC(2026, 10, 13, 14, 0);   // 11h de Brasília
s = await jogoDoBicho(repo, { id: 'u0' }, { op: 'estado' }, hora - FECHA_ANTES_MS + 1000);
assert.equal(chaveDe(s.proximo.hora), '2026-11-13 14h', 'faltando menos de 1 min, a aposta vai pro próximo');
await liquidar(repo, hora + 1000, () => P);
assert.equal((await repo.getProfile('u0')).coins, 990 + 180);
assert.equal((await repo.getProfile('u1')).coins, 997);
s = await jogoDoBicho(repo, { id: 'u0' }, { op: 'estado' }, hora + 2000);
assert.equal(s.minhas[0].status, 'ganhou'); assert.equal(s.minhas[0].ganho, 180);
assert.ok(s.resultados.some(r => r.premios.length === 5));
assert.equal(repo.T.jogadas.filter(j => j.jogo === 'bicho').length, 2, 'entra no relatório');
console.log('OK — jogo do bicho: grupos, pagamentos, horários e sorteio');
