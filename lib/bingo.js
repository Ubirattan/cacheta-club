// BINGO TRADICIONAL (75 bolas, cartela 5x5 B-I-N-G-O com o centro livre). Contas puras.
// Ganha quem completar a cartela inteira (cartela cheia). Vários na mesma bola dividem o prêmio por cartela.
export const COLUNAS = ['B', 'I', 'N', 'G', 'O'];
export const MAX_CARTELAS = 3, OPCOES = 6;
export const BINGO_MIN = 5, BINGO_MAX = 200, BINGO_JOGADORES = [2, 10];
export const BOLA_MS = 4500;                 // uma bola a cada 4,5 s
export const letra = n => COLUNAS[Math.floor((n - 1) / 15)];

// taxa da casa sobre o pote: até 100 fichas 10%, acima de 100 20%
export const taxaBingo = pote => pote > 100 ? 20 : 10;
export function premioBingo(pote) { return pote - Math.ceil(pote * taxaBingo(pote) / 100); }

function sorteia(lista, k, rnd) { const a = lista.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); }
const faixa = c => Array.from({ length: 15 }, (_, i) => c * 15 + i + 1);
// cartela: 5 linhas x 5 colunas, número 0 = centro livre
export function novaCartela(rnd = Math.random) {
  const cols = [0, 1, 2, 3, 4].map(c => sorteia(faixa(c), 5, rnd).sort((a, b) => a - b));
  cols[2][2] = 0;
  const linhas = [0, 1, 2, 3, 4].map(r => cols.map(col => col[r]));
  return { id: Math.floor(rnd() * 1e9).toString(36) + Math.floor(rnd() * 1e6).toString(36), linhas };
}
export const numeros = c => c.linhas.flat().filter(n => n > 0);
export const faltam = (c, saiu) => { const s = saiu instanceof Set ? saiu : new Set(saiu); return numeros(c).filter(n => !s.has(n)).length; };
export const cheia = (c, saiu) => faltam(c, saiu) === 0;
export function embaralharBolas(rnd = Math.random) { return sorteia(Array.from({ length: 75 }, (_, i) => i + 1), 75, rnd); }
