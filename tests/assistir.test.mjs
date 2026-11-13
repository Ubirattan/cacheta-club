// Assistir mesa de cacheta: só sala pública, só o estado público (nunca as mãos), chat só leitura
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as S from '../lib/service.js';

const repo = memRepo(); const [a, b, c] = addUsers(repo, 3, 100);
const { id } = await S.createRoom(repo, a, { name: 'Pública', mode: 'cacheta', maxPlayers: 4, points: 5, entry: 1, turnSeconds: 30 });
await S.joinRoom(repo, b, { id });
await S.setReady(repo, a, id, true); await S.setReady(repo, b, id, true);
repo.T.messages.push({ id: 1, room_id: id, user_id: a.id, nickname: 'J0', text: 'boa sorte', created_at: '' });

const w = await S.watchRoom(repo, c, id);
assert.equal(w.room.status, 'playing', 'mesa jogando');
assert.equal(w.players.length, 2, 'vê quem está sentado');
assert.ok(w.state && w.state.players.length === 2, 'vê a mesa');
assert.ok(w.version > 0);
const txt = JSON.stringify(w);
assert.ok(!/"hand":\[/.test(txt) && !/"hands"/.test(txt), 'nunca manda as mãos');
assert.ok(w.state.players.every(p => typeof p.count === 'number' && !('hand' in p)), 'só a quantidade de cartas');
assert.equal(w.msgs.length, 1, 'lê o chat');
assert.ok(!repo.T.room_players.some(p => p.user_id === c.id), 'quem assiste não senta');
assert.equal(repo.T.profiles.find(p => p.id === c.id).coins, 100, 'assistir é grátis');

const { id: priv } = await S.createRoom(repo, c, { name: 'Fechada', mode: 'cacheta', maxPlayers: 4, points: 5, entry: 1, turnSeconds: 30, isPrivate: true, password: 'xyz' });
await assert.rejects(S.watchRoom(repo, a, priv), e => e.status === 403, 'privada não dá pra assistir');
await assert.rejects(S.watchRoom(repo, a, 'nada'), e => e.status === 404, 'sala que não existe');
console.log('assistir ok: só sala pública, sem as mãos, de graça');
