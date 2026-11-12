// Partida contra o computador (cacheta e truco): cada partida custa 1 ficha, cobrada aqui no servidor
// antes de a partida começar. (A gude cobra no lib/gude-service.js, que também confere as tecadas.)
import { GameError } from './service-error.js';

export const TREINO_COST = 1;
export const TREINO_JOGOS = ['cacheta', 'truco'];

export async function cobrarTreino(repo, user, b = {}) {
  const jogo = TREINO_JOGOS.includes(b.jogo) ? b.jogo : null;
  if (!jogo) throw new GameError('Jogo inválido');
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) throw new GameError('Conta bloqueada', 403);
  const coins = await repo.adjustProfile(user.id, -TREINO_COST, 0, 0);
  if (coins == null) throw new GameError('Você está sem fichas. Compre fichas na Loja para jogar', 402);
  return { ok: true, jogo, cost: TREINO_COST, coins: Array.isArray(coins) ? coins[0] : coins };
}
