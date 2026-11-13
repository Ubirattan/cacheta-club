import { newSinuca, stepSinuca, tacar, jogadaComputador, computadorColoca, alvos } from '../lib/sinuca.js';
let w=[0,0], tac=0, faltas=0, fr=0;
for (let g=0; g<40; g++) {
  const S=newSinuca({level: g%2?'dificil':'medio'}); let n=0;
  while (S.phase!=='over' && n<400) {
    if (S.naMao) computadorColoca(S);
    const j=jogadaComputador(S); tacar(S,j.ang,j.forca); tac++; n++;
    let k=0; while (S.phase==='rolling' && k<6000) { stepSinuca(S); k++; fr++; }
    if (k>=6000) { console.log('travou'); break; }
    for (const e of S.events) if (e.type==='falta') faltas++;
    S.events.length=0;
  }
  if (S.winner!=null) w[S.winner]++; else console.log('sem fim', n);
}
console.log('vitorias',w,'tacadas/partida',(tac/40).toFixed(1),'faltas',faltas,'seg por tacada',(fr/tac/60).toFixed(1));
