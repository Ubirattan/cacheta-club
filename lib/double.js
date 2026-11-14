import { teto } from './premio.js';
// DOUBLE: roleta de cores ao vivo com 15 casas: 7 vermelhas (2x), 7 pretas (2x) e 1 branca (14x).
// Todo mundo aposta na mesma rodada. A casa fica com ~6,7% (7/15 × 2 = 14/15). Contas puras.
export const CASAS = 15;
export const PAGA = { vermelho: 2, preto: 2, branco: 14 };
export const CORES = ['vermelho', 'branco', 'preto'];
export const APOSTAS_MS = 15000;         // tempo pra apostar
export const GIRO_MS = 10000;            // a roleta girando
export const PAUSA_MS = 3000;            // mostra o resultado antes da próxima rodada
export const MIN_APOSTA = 1, MAX_APOSTA = 500;
// 0 = branco, 1–7 = vermelho, 8–14 = preto
export const corDe = n => n === 0 ? 'branco' : n <= 7 ? 'vermelho' : 'preto';
// ordem das casas na faixa que gira (vermelho e preto alternados, o branco no meio)
export const FAIXA = [1, 14, 2, 13, 3, 12, 4, 0, 11, 5, 10, 6, 9, 7, 8];
export const ganhoDe = (valor, cor) => teto(Math.round(Number(valor) * PAGA[cor] * 100) / 100);   // no máximo 4 mil
export const fichas = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const faseDe = (r, agora) => agora < r.start ? 'apostas' : agora < r.fim ? 'girando' : 'resultado';
