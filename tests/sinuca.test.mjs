// Sinuca: as 3 modalidades sempre terminam (computador contra computador)
import assert from 'node:assert/strict';
import { newSinuca, stepSinuca, tacar, jogadaComputador, computadorColoca, grupoDe } from '../lib/sinuca.js';
for (const modo of ['bola8', 'lisa', 'bolinho']) {
  const w = [0, 0]; let tac = 0, fr = 0, jogos = 0;
  for (let g = 0; g < 30; g++) {
    const S = newSinuca({ level: g % 2 ? 'dificil' : 'medio', modo }); let n = 0;
    if (modo === 'lisa') { assert.equal(S.balls.filter(b => grupoDe(b.n) === 'verm').length, 5); assert.ok(!S.balls.some(b => b.n === 0), 'sem branca'); }
    while (S.phase !== 'over' && n < 500) {
      if (S.naMao) computadorColoca(S);
      const j = jogadaComputador(S); assert.ok(tacar(S, j.ang, j.forca), 'tacou'); tac++; n++;
      let k = 0; while (S.phase === 'rolling' && k < 6000) { stepSinuca(S); k++; fr++; }
      assert.ok(k < 6000, 'bolas pararam');
      for (const e of S.events) if (e.type === 'jogo') jogos++;
      S.events.length = 0;
    }
    assert.equal(S.phase, 'over', `${modo}: partida terminou`); w[S.winner]++;
    if (modo === 'bolinho') assert.ok(Math.max(...S.placar) >= 1);
  }
  console.log(`${modo}: ${w[0]} x ${w[1]} · ${(tac / 30).toFixed(1)} tacadas por partida · ${(fr / tac / 60).toFixed(1)} s por tacada${modo === 'bolinho' ? ` · ${jogos} jogos` : ''}`);
}
console.log('sinuca ok');
