// Testes do motor do Truco Paulista
import assert from 'node:assert/strict';
import { newMatch, act, needs, botMove, handWinner, power, manilhaRank, startHand, teamOf } from '../lib/truco.js';

// manilha e força
assert.equal(manilhaRank({ r: 2, s: 0 }), 3, 'vira 3 → manilha 4');
assert.equal(manilhaRank({ r: 6, s: 0 }), 11, 'vira 7 → manilha Q');
assert.equal(manilhaRank({ r: 12, s: 0 }), 0, 'vira K → manilha A');
const vira = { r: 3, s: 1 };            // vira 4 → manilha 5
assert.ok(power({ r: 4, s: 3 }, vira) > power({ r: 4, s: 1 }, vira), 'zap > copas');
assert.ok(power({ r: 4, s: 1 }, vira) > power({ r: 4, s: 0 }, vira), 'copas > espadilha');
assert.ok(power({ r: 4, s: 0 }, vira) > power({ r: 4, s: 2 }, vira), 'espadilha > pica-fumo');
assert.ok(power({ r: 4, s: 2 }, vira) > power({ r: 2, s: 0 }, vira), 'manilha > 3');
assert.ok(power({ r: 2, s: 0 }, vira) > power({ r: 0, s: 0 }, vira), '3 > A');

// quem ganha a mão
assert.equal(handWinner([0]), undefined);
assert.equal(handWinner([0, 0]), 0);
assert.equal(handWinner([0, 1]), undefined);
assert.equal(handWinner([-1, 1]), 1, 'empatou a 1ª, a 2ª decide');
assert.equal(handWinner([0, -1]), 0, 'empatou a 2ª, leva quem fez a 1ª');
assert.equal(handWinner([-1, -1]), undefined);
assert.equal(handWinner([-1, -1, 1]), 1);
assert.equal(handWinner([-1, -1, -1]), -1, 'tudo empatado: ninguém marca');
assert.equal(handWinner([0, 1, -1]), 0, 'empatou a 3ª, leva quem fez a 1ª');
assert.equal(handWinner([0, 1, 1]), 1);

// truco: correr dá o valor de antes
{
  const M = newMatch([{ name: 'A' }, { name: 'B' }]);
  M.score = [0, 0]; startHand(M);
  const p = M.turn;
  assert.ok(act(M, p, { type: 'truco' }).ok);
  assert.equal(act(M, p, { type: 'play', id: M.players[p].hand[0].id }).ok, false, 'não joga com pedido em aberto');
  const o = (p + 1) % 2;
  assert.ok(act(M, o, { type: 'aumentar' }).ok);
  assert.equal(M.value, 3); assert.equal(M.pending.value, 6);
  assert.ok(act(M, p, { type: 'correr' }).ok);
  assert.equal(M.score[teamOf(o)], 3, 'correu do seis: o outro faz 3');
}

// mão de onze: correr dá 1 ao outro
{
  const M = newMatch([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);
  M.score = [11, 4]; startHand(M);
  assert.equal(needs(M).kind, 'onze');
  assert.equal(act(M, 0, { type: 'truco' }).ok, false);
  assert.ok(act(M, 2, { type: 'onze', jogar: false }).ok);
  assert.deepEqual(M.score, [11, 5]);
}

// partidas inteiras só com o computador (1x1 e duplas): sempre terminam e as cartas fecham
for (const n of [2, 4]) {
  for (let g = 0; g < 300; g++) {
    const M = newMatch(Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true })));
    let steps = 0;
    while (M.phase !== 'over') {
      assert.ok(++steps < 5000, 'partida travou');
      const nd = needs(M);
      if (nd.kind === 'vaza' || nd.kind === 'hand') { assert.ok(act(M, 0, { type: 'next' }).ok); continue; }
      if (nd.kind === 'play') {
        const used = new Set(); M.players.forEach(p => p.hand.forEach(c => used.add(c.id))); M.table.forEach(x => used.add(x.card.id));
        assert.ok(!used.has(M.vira.id), 'vira não pode estar em jogo');
      }
      const pi = nd.kind === "play" || nd.kind === "resp" ? nd.pi : nd.team;
      const mv = botMove(M, pi, g % 2 ? "facil" : "medio");
      const r = act(M, pi, mv);
      assert.ok(r.ok, r.err + ' ' + JSON.stringify(mv));
    }
    assert.ok(M.score[M.over.team] >= 12);
  }
}
console.log('truco ok');
