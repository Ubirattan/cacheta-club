import { teto } from './premio.js';
// ONÇA DA SORTE: caça-níquel 3x3 com 5 linhas. A onça é coringa (vale por qualquer símbolo).
// Tela cheia com o mesmo símbolo (contando a onça) multiplica o prêmio por 10.
// RODADA DA ONÇA (surpresa): a onça escolhe um símbolo e os rolos giram de novo só com ele,
// a onça e espaços vazios; o que encaixa fica preso, até sair um prêmio (sempre paga).
// Prêmios em vezes a aposta total; a escala é calibrada pra devolver RETORNO em média.
export const RETORNO = 0.70;                 // a casa fica com 30%
export const MULT_CHEIA = 10;
export const APOSTAS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
export const CHANCE_RODADA = 1 / 50;         // chance da Rodada da Onça em cada giro
const RODADA_SIMB = 0.12, RODADA_ONCA = 0.02; // na Rodada: chance de cada casa vazia virar o símbolo / a onça
export const VAZIO = -1;
export const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [6, 4, 2]];   // células: 0 1 2 / 3 4 5 / 6 7 8

// pesos e prêmios-base (a escala ESCALA ajusta tudo pro RETORNO; conferido no teste)
const BASE = [
  ['onca', 1, 25, 'Onça (coringa)'], ['saco', 4, 10, 'Saco de ouro'], ['diam', 6, 5, 'Diamante'], ['moeda', 9, 3, 'Moeda'],
  ['trevo', 11, 2, 'Trevo'], ['uva', 13, 1.5, 'Uva'], ['laranja', 15, 1.2, 'Laranja'], ['cereja', 16, 1, 'Cereja'],
];
export const ESCALA = 1.925;
export const SIMBOLOS = BASE.map(([id, peso, p, nome]) => ({ id, peso, nome, paga: Math.round(p * ESCALA * 100) / 100 }));
const TOT = SIMBOLOS.reduce((a, s) => a + s.peso, 0);

export function sorteiaSimbolo(r) {
  let x = r * TOT;
  for (let i = 0; i < SIMBOLOS.length; i++) { x -= SIMBOLOS[i].peso; if (x < 0) return i; }
  return SIMBOLOS.length - 1;
}
// confere a grade e diz o que ganhou (casa vazia não forma linha)
export function confere(grade) {
  const linhas = [];
  let mult = 0;
  LINHAS.forEach((l, i) => {
    const cel = l.map(c => grade[c]);
    if (cel.includes(VAZIO)) return;
    const sem = cel.filter(s => s !== 0);
    if (sem.length && !sem.every(s => s === sem[0])) return;
    const s = sem.length ? sem[0] : 0;
    linhas.push({ linha: i, simbolo: s, paga: SIMBOLOS[s].paga });
    mult += SIMBOLOS[s].paga;
  });
  const semW = grade.filter(s => s !== 0);
  const cheia = !grade.includes(VAZIO) && (!semW.length || semW.every(s => s === semW[0]));
  if (cheia) mult *= MULT_CHEIA;
  return { linhas, cheia, mult: Math.round(mult * 100) / 100 };
}
// um giro: devolve os passos (grades) pra animar e o resultado final
export function gira(rand) {
  if (rand() < CHANCE_RODADA) {
    const simb = 1 + Math.floor(rand() * (SIMBOLOS.length - 1));
    let grade = Array(9).fill(VAZIO);
    const passos = [];
    for (let n = 0; n < 40; n++) {
      grade = grade.map(c => c !== VAZIO ? c : (() => { const r = rand(); return r < RODADA_ONCA ? 0 : r < RODADA_ONCA + RODADA_SIMB ? simb : VAZIO; })());
      passos.push(grade.slice());
      if (confere(grade).linhas.length) break;
    }
    if (!confere(grade).linhas.length) { grade[3] = grade[4] = grade[5] = simb; passos.push(grade.slice()); }   // garante o prêmio
    return { rodada: simb, passos, grade, ...confere(grade) };
  }
  const grade = Array.from({ length: 9 }, () => sorteiaSimbolo(rand()));
  return { rodada: null, passos: [grade], grade, ...confere(grade) };
}
export const premio = (aposta, mult) => teto(Math.floor(aposta * mult * 100 + 1e-6) / 100);   // no máximo 4 mil
