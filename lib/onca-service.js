// Onça da Sorte no servidor: desconta a aposta, sorteia com número aleatório seguro e paga.
import { randomInt } from 'node:crypto';
import { GameError } from './service-error.js';
import { gira, premio, APOSTAS } from './onca.js';
import { registrarJogada } from './relatorio.js';

const rand = () => randomInt(0, 2 ** 32) / 2 ** 32;
const saldo = c => Number(Array.isArray(c) ? c[0] : c);

export async function girarOnca(repo, user, b = {}, r = rand) {
  const aposta = Number(b.aposta);
  if (!APOSTAS.includes(aposta)) throw new GameError('Aposta inválida');
  const p = await repo.getProfile(user.id);
  if (!p || p.blocked) throw new GameError('Conta bloqueada', 403);
  const depois = await repo.adjustProfile(user.id, -aposta, 0, 0);
  if (depois == null) throw new GameError('Fichas insuficientes. Compre fichas na Loja', 402);
  const g = gira(r);
  const ganho = premio(aposta, g.mult);
  const fim = ganho ? await repo.adjustProfile(user.id, ganho, 0, 0) : depois;
  await registrarJogada(repo, 'onca', user.id, aposta, ganho);
  return { ...g, aposta, ganho, coins: saldo(fim) };
}
