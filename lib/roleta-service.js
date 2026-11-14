// Roleta no servidor: confere a aposta, desconta as fichas, sorteia com número aleatório seguro e paga.
// O celular só recebe o número que saiu e anima a roda até ele.
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { conferir, pagar } from './roleta.js';
import { registrarJogada } from './relatorio.js';

const saldo = c => (Array.isArray(c) ? c[0] : c);

export async function girar(repo, user, b = {}, sortear = () => randomInt(37)) {
  const c = conferir(b.apostas);
  if (c.erro) throw new GameError(c.erro);
  const profile = await repo.getProfile(user.id);
  if (!profile || profile.blocked) throw new GameError('Conta bloqueada', 403);
  const depois = await repo.adjustProfile(user.id, -c.total, 0, 0);      // só desconta se tiver saldo
  if (depois == null) throw new GameError('Fichas insuficientes pra essa aposta. Compre fichas na Loja', 402);
  const numero = sortear();
  const { volta, ganhas } = pagar(c.apostas, numero);
  const fim = volta ? await repo.adjustProfile(user.id, volta, 0, 0) : depois;
  await registrarJogada(repo, 'roleta', user.id, c.total, volta);
  return { numero, apostado: c.total, volta, ganhas, coins: saldo(fim) };
}
