// Partida contra o computador (cacheta, truco, pipa e sinuca): cobrada aqui no servidor
// antes de a partida começar. (A gude cobra no lib/gude-service.js, que também confere as tecadas.)
import { GameError } from './service-error.js';
import { registrarJogada } from './relatorio.js';

export const TREINO_COST = 1;
// custo por jogo (fichas por partida contra o computador)
export const TREINO_CUSTOS = { cacheta: 1, truco: 1, pipa: 1, sinuca: 2, domino: 1 };
export const TREINO_JOGOS = ['cacheta', 'truco', 'pipa', 'sinuca', 'domino'];

export async function cobrarTreino(repo, user, b = {}) {
  const jogo = TREINO_JOGOS.includes(b.jogo) ? b.jogo : null;
  if (!jogo) throw new GameError('Jogo inválido');
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) throw new GameError('Conta bloqueada', 403);
  const custo = TREINO_CUSTOS[jogo] ?? TREINO_COST;
  const coins = await repo.adjustProfile(user.id, -custo, 0, 0);
  if (coins == null) throw new GameError('Você está sem fichas. Compre fichas na Loja para jogar', 402);
  await registrarJogada(repo, jogo + '-pc', user.id, custo, 0);
  return { ok: true, jogo, cost: custo, coins: Array.isArray(coins) ? coins[0] : coins };
}
