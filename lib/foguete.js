// FOGUETINHO (jogo de "crash"): o multiplicador sobe e o jogador precisa sacar antes do foguete explodir.
// Contas puras, usadas no servidor e no celular.
export const K = 0.07;                 // velocidade: m(t) = e^(K·t), t em segundos (2x em ~10 s)
export const MARGEM = 0.05;            // a casa fica com 5% em média
export const MAX_MULT = 100;           // o foguete nunca passa de 100x
export const APOSTAS_MS = 7000;        // tempo pra apostar antes de decolar
export const PAUSA_MS = 3000;          // mostra a explosão antes da próxima rodada
export const MIN_APOSTA = 1, MAX_APOSTA = 500;

export const multEm = ms => Math.max(1, Math.floor(Math.exp(K * Math.max(0, ms) / 1000) * 100) / 100);
export const duracaoMs = crash => Math.ceil(Math.log(crash) / K * 1000);

// r em [0,1): P(explodir em x ou mais) = (1 − margem)/x, então em média a casa fica com a margem
export function sorteiaCrash(r) {
  const x = (1 - MARGEM) / (1 - r);
  if (x < 1) return 1;
  return Math.min(MAX_MULT, Math.floor(x * 100) / 100);
}
export const ganhoDe = (valor, mult) => Math.floor(valor * mult);
