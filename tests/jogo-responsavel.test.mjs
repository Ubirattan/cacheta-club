// Jogo responsável: limites que valem na hora / em 24 h, autoexclusão, limite de depósito e de tempo.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { jogoResponsavel as jr, checarJogo, checarDeposito, ESPERA_AUMENTO } from '../lib/jogo-responsavel.js';

const repo = memRepo();
await addUsers(repo, 1);
const [p] = await repo.sel('profiles', {});
const user = { id: p.id };
const t0 = Date.parse('2026-11-14T15:00:00-03:00');
const erro = async (f, re) => { await assert.rejects(f, e => re.test(e.message)); };

// sem nada definido: joga e deposita livre
await checarJogo(repo, user.id, t0); await checarDeposito(repo, user.id, 500, t0);

// limite de depósito por dia: vale na hora
let s = await jr(repo, user, { op: 'limites', deposito: { dia: 50 } }, t0);
assert.equal(s.deposito.dia.valor, 50);
await repo.ins('purchases', { user_id: user.id, item: 'pack-20', coins: 20, price_coins: 0, price_brl: 30, status: 'done', created_at: new Date(t0 - 60000).toISOString() });
await checarDeposito(repo, user.id, 20, t0);
await erro(() => checarDeposito(repo, user.id, 21, t0), /Ainda dá pra depositar R\$ 20,00/);
// compra de item com fichas (sem R$) não conta
await repo.ins('purchases', { user_id: user.id, item: 'av-x', coins: 0, price_coins: 10, price_brl: null, status: 'done', created_at: new Date(t0).toISOString() });
await checarDeposito(repo, user.id, 20, t0);
// no dia seguinte zera o diário
await checarDeposito(repo, user.id, 50, t0 + 24 * 3600 * 1000);

// aumentar: só depois de 24 h
s = await jr(repo, user, { op: 'limites', deposito: { dia: 200 } }, t0);
assert.equal(s.deposito.dia.valor, 50); assert.equal(s.deposito.dia.pendente.valor, 200);
await erro(() => checarDeposito(repo, user.id, 100, t0 + 3600e3), /limite de depósito por dia/);
s = await jr(repo, user, { op: 'status' }, t0 + ESPERA_AUMENTO + 1);
assert.equal(s.deposito.dia.valor, 200); assert.equal(s.deposito.dia.pendente, null);
// tirar o limite também espera 24 h; diminuir vale na hora
s = await jr(repo, user, { op: 'limites', deposito: { dia: null } }, t0 + ESPERA_AUMENTO + 2);
assert.equal(s.deposito.dia.valor, 200); assert.equal(s.deposito.dia.pendente.valor, null);
s = await jr(repo, user, { op: 'limites', deposito: { dia: 40 } }, t0 + ESPERA_AUMENTO + 3);
assert.equal(s.deposito.dia.valor, 40); assert.equal(s.deposito.dia.pendente, null);
await erro(() => jr(repo, user, { op: 'limites', deposito: { semana: -3 } }, t0), /inválido/);

// limite de tempo: conta 1 min por ping (no máximo 1 a cada 50 s) e bloqueia o jogo
const t1 = Date.parse('2026-11-20T10:00:00-03:00');
s = await jr(repo, user, { op: 'limites', tempo: 5 }, t1);
assert.equal(s.tempo.valor, 5);
let r;
for (let i = 0; i < 5; i++) r = await jr(repo, user, { op: 'ping' }, t1 + i * 60000);
assert.equal((await jr(repo, user, { op: 'ping' }, t1 + 4 * 60000 + 10000)).usoHoje, 5, 'ping repetido não conta');
assert.equal(r.acabou, true);
await erro(() => checarJogo(repo, user.id, t1 + 5 * 60000), /limite de 5 min/);
await checarJogo(repo, user.id, t1 + 24 * 3600e3);   // amanhã libera

// autoexclusão: bloqueia jogo e depósito e não dá pra encurtar
const t2 = Date.parse('2026-12-01T10:00:00-03:00');
s = await jr(repo, user, { op: 'excluir', dias: 7 }, t2);
assert.ok(s.exclusaoAte > t2);
await erro(() => checarJogo(repo, user.id, t2 + 1000), /autoexclusão/);
await erro(() => checarDeposito(repo, user.id, 10, t2 + 1000), /autoexclusão/);
s = await jr(repo, user, { op: 'excluir', dias: 1 }, t2 + 1000);
assert.ok(s.exclusaoAte >= t2 + 7 * 24 * 3600e3, 'não encurta');
await erro(() => jr(repo, user, { op: 'excluir', dias: 3 }, t2), /período/);
await checarJogo(repo, user.id, t2 + 8 * 24 * 3600e3);
console.log('OK — jogo responsável: limites (na hora / 24 h), depósito, tempo e autoexclusão');
