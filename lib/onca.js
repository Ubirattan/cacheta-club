// ONÇA DA SORTE: caça-níquel 3x3 com 5 linhas. A onça é coringa (vale por qualquer símbolo).
// Tela cheia com o mesmo símbolo (contando a onça) multiplica o prêmio por 10.
// Prêmios em vezes a aposta total; tabela calibrada pra devolver 95% em média (casa fica com 5%).
export const SIMBOLOS = [
  { id: 'onca', em: '🐆', peso: 3, paga: 28.48, nome: 'Onça (coringa)' },
  { id: 'saco', em: '💰', peso: 6, paga: 11.39, nome: 'Saco de dinheiro' },
  { id: 'diam', em: '💎', peso: 8, paga: 5.7, nome: 'Diamante' },
  { id: 'moeda', em: '🪙', peso: 12, paga: 2.85, nome: 'Moeda' },
  { id: 'trevo', em: '🍀', peso: 15, paga: 1.71, nome: 'Trevo' },
  { id: 'laranja', em: '🍊', peso: 20, paga: 1.14, nome: 'Laranja' },
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
