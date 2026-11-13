// ONÇA DA SORTE: caça-níquel 3x3 com 5 linhas. A onça é coringa (vale por qualquer símbolo).
// Tela cheia com o mesmo símbolo (contando a onça) multiplica o prêmio por 10.
// Prêmios em vezes a aposta total; tabela calibrada pra devolver 30% em média (casa fica com 70%).
export const RETORNO = 0.30;
export const SIMBOLOS = [
  { id: 'onca', em: '🐆', peso: 1, paga: 27.07, nome: 'Onça (coringa)' },
  { id: 'saco', em: '💰', peso: 4, paga: 10.83, nome: 'Saco de dinheiro' },
  { id: 'diam', em: '💎', peso: 6, paga: 5.41, nome: 'Diamante' },
  { id: 'moeda', em: '🪙', peso: 9, paga: 3.25, nome: 'Moeda' },
  { id: 'trevo', em: '🍀', peso: 11, paga: 2.17, nome: 'Trevo' },
  { id: 'uva', em: '🍇', peso: 13, paga: 1.62, nome: 'Uva' },
  { id: 'laranja', em: '🍊', peso: 15, paga: 1.3, nome: 'Laranja' },
  { id: 'cereja', em: '🍒', peso: 16, paga: 1.08, nome: 'Cereja' },
];
export const LINHAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [6, 4, 2]];   // células: 0 1 2 / 3 4 5 / 6 7 8
export const MULT_CHEIA = 10;
export const APOSTAS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const TOT = SIMBOLOS.reduce((a, s) => a + s.peso, 0);

export function sorteiaSimbolo(r) {
  let x = r * TOT;
  for (let i = 0; i < SIMBOLOS.length; i++) { x -= SIMBOLOS[i].peso; if (x < 0) return i; }
  return SIMBOLOS.length - 1;
}
// confere a grade (9 números de símbolo) e diz o que ganhou
export function confere(grade) {
  const linhas = [];
  let mult = 0;
  LINHAS.forEach((l, i) => {
    const sem = l.map(c => grade[c]).filter(s => s !== 0);
    if (sem.length && !sem.every(s => s === sem[0])) return;
    const s = sem.length ? sem[0] : 0;
    linhas.push({ linha: i, simbolo: s, paga: SIMBOLOS[s].paga });
    mult += SIMBOLOS[s].paga;
  });
  const semW = grade.filter(s => s !== 0);
  const cheia = !semW.length || semW.every(s => s === semW[0]);
  if (cheia) mult *= MULT_CHEIA;
  return { linhas, cheia, mult: Math.round(mult * 100) / 100 };
}
export function gira(rand) {
  const grade = Array.from({ length: 9 }, () => sorteiaSimbolo(rand()));
  return { grade, ...confere(grade) };
}
export const premio = (aposta, mult) => Math.floor(aposta * mult * 100 + 1e-6) / 100;

// retorno teórico (conta exata, cada célula é independente)
export function retorno() {
  const p = SIMBOLOS.map(s => s.peso / TOT), pw = p[0];
  let linha = 0, cheia = 0;
  SIMBOLOS.forEach((s, i) => {
    linha += (i === 0 ? pw ** 3 : (p[i] + pw) ** 3 - pw ** 3) * s.paga;
    cheia += (i === 0 ? pw ** 9 : (p[i] + pw) ** 9 - pw ** 9) * 5 * s.paga * (MULT_CHEIA - 1);
  });
  return 5 * linha + cheia;
}
