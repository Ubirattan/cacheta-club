// ROLETA AO VIVO: a mesma roleta europeia (lib/roleta.js), mas todo mundo joga a mesma rodada.
// Tempo pra apostar, a roda girando e uma pausa mostrando o número. Contas puras (servidor e tela).
export const APOSTAS_MS = 20000;   // tempo pra apostar
export const GIRO_MS = 10000;      // a roda girando (igual à animação da tela)
export const PAUSA_MS = 5000;      // mostra o número antes da próxima rodada
export const faseDe = (r, agora) => agora < r.start ? 'apostas' : agora < r.fim ? 'girando' : 'resultado';
