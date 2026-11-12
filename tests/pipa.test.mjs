// Pipa: física, linhas cruzando, corte, queda e computador contra computador
import assert from 'node:assert/strict';
import { newPipa, stepPipa, crossing, linePts, GROUND, HANDS } from '../lib/pipa.js';

{ // puxar sobe a pipa pra onde o bico aponta; soltar faz girar
  const G = newPipa(); for (let i = 0; i < 95; i++) stepPipa(G);
  assert.equal(G.phase, 'play');
  const y0 = G.k[0].y; G.k[0].a = -Math.PI / 2;
  for (let i = 0; i < 20; i++) stepPipa(G, { pull: true });
  assert.ok(G.k[0].y < y0 - 40, 'puxando, subiu');
  const a0 = G.k[0].a; stepPipa(G, { pull: false });
  assert.ok(Math.abs(G.k[0].a - a0) > .05, 'soltou, girou');
}
{ // linhas cruzadas: quem puxa corta
  const G = newPipa(); for (let i = 0; i < 95; i++) stepPipa(G);
  Object.assign(G.k[0], { x: 640, y: 200, L: 600 }); Object.assign(G.k[1], { x: 300, y: 200, L: 600 });
  assert.ok(crossing(G), 'linhas cruzaram');
  G.ai[1] = { next: 1e9, pull: false };            // computador parado, dando linha
  let n = 0; while (G.phase === 'play' && n++ < 400) { G.k[0].a = -Math.PI / 2; G.k[1].a = -Math.PI / 2; G.k[0].vx = G.k[0].vy = G.k[1].vx = G.k[1].vy = 0; stepPipa(G, { pull: true }); Object.assign(G.k[0], { x: 640, y: 200 }); Object.assign(G.k[1], { x: 300, y: 200 }); }
  assert.equal(G.phase, 'cut'); assert.equal(G.score[0], 1, 'eu cortei'); assert.ok(G.k[1].cut);
  assert.equal(G.events.find(e => e.type === 'corte').winner, 0);
}
{ // encostou no telhado: caiu
  const G = newPipa(); for (let i = 0; i < 95; i++) stepPipa(G);
  Object.assign(G.k[0], { y: GROUND - 6 }); stepPipa(G);
  assert.equal(G.score[1], 1); assert.ok(G.events.some(e => e.type === 'caiu'));
}
assert.equal(linePts(newPipa(), 0)[0][0], HANDS[0][0], 'linha sai da mão');
// computador x computador: sempre termina, com cortes de verdade
const lv = ['facil', 'medio', 'dificil'];
for (const a of lv) {
  let wins = [0, 0], cortes = 0, quedas = 0, frames = 0;
  for (let g = 0; g < 30; g++) {
    const G = newPipa({ level: a }); let n = 0;
    while (!G.over || G.phase === 'cut' && G.phaseT > 0) { stepPipa(G, { ai0: 'medio' }); for (const e of G.events) { if (e.type === 'corte') cortes++; if (e.type === 'caiu') quedas++; } G.events.length = 0; assert.ok(++n < 60 * 60 * 15, 'partida travou'); if (G.over && G.phase === 'cut' && G.phaseT <= 1) break; }
    wins[G.over.winner]++; frames += n;
  }
  console.log(`computador ${a} x esperto: ${wins[1]} x ${wins[0]} · cortes ${cortes} quedas ${quedas} · ${(frames / 30 / 60).toFixed(0)} s por partida`);
  assert.ok(cortes > quedas, 'a maioria das rodadas acaba em corte');
  assert.ok(frames / 30 / 60 < 300, 'partida não demora demais');
}
console.log('pipa ok');
