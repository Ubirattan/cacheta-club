// Mesas abandonadas: fecham depois de 10 min sem ninguém e sem jogada; pote volta para quem estava na mesa.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as S from '../lib/service.js';

const R = memRepo(); const U = addUsers(R, 4, 100);
const coins = async u => (await R.getProfile(u)).coins;
// sala esperando (1 jogador) e sala jogando valendo 10 de entrada (2 jogadores)
const espera = await S.createRoom(R, U[0], { mode: 'cacheta', maxPlayers: 2, points: 3, entry: 1 });
const jogo = await S.createRoom(R, U[1], { mode: 'cacheta', maxPlayers: 2, points: 3, entry: 10 });
await S.joinRoom(R, U[2], { id: jogo.id });
await S.setReady(R, U[1], jogo.id, true); await S.setReady(R, U[2], jogo.id, true);
assert.equal((await R.getRoom(jogo.id)).status, 'playing'); assert.equal(await coins('u1'), 90);
const agora = Date.now();
// ainda com movimento: nada fecha
assert.equal((await S.cleanupRooms(R, agora, true)).closed, 0);
// "estou aqui" segura a sala de espera; 11 min depois a de jogo (sem jogadas) fecha e devolve o pote
await S.ping(R, U[0], espera.id);
const r = await S.cleanupRooms(R, agora + 11 * 60000, true);
assert.equal(r.closed, 2, 'sala de espera também: o ping foi há 11 min');
assert.equal(await R.getRoom(jogo.id), null); assert.equal(await R.getRoom(espera.id), null);
assert.equal(await coins('u1'), 100); assert.equal(await coins('u2'), 100);
// sala com alguém dando "estou aqui" recente não fecha
const viva = await S.createRoom(R, U[3], { mode: 'cacheta', maxPlayers: 2, points: 3, entry: 1 });
const t2 = Date.now() + 9 * 60000;
assert.equal((await S.cleanupRooms(R, t2, true)).closed, 0);
// limite de 1 vez por minuto
await S.cleanupRooms(R, t2 + 61000); assert.ok((await S.cleanupRooms(R, t2 + 62000)).skipped);
assert.ok(await R.getRoom(viva.id) !== undefined);
console.log('OK — mesas abandonadas fecham em 10 min, pote devolvido, "estou aqui" segura a mesa');
