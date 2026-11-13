// ROLETA (europeia, um zero só): números, cores, tipos de aposta e quanto cada uma paga.
// Usado no servidor (que sorteia e paga) e na tela (que mostra a mesa e anima a roda).

// ordem dos números na roda, no sentido horário a partir do zero
export const RODA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const VERMELHOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const cor = n => n === 0 ? 'verde' : VERMELHOS.has(n) ? 'vermelho' : 'preto';

export const MAX_APOSTA = 500;          // fichas por rodada (soma de todas as apostas)
export const FICHAS = [1, 5, 10, 25, 100];  // valores de ficha pra colocar na mesa

// tipos de aposta: chave -> { nome, paga (x pra 1), ganha(n) }
const T = {};
for (let n = 0; n <= 36; n++) T['n' + n] = { nome: String(n), paga: 35, ganha: x => x === n };
for (let d = 1; d <= 3; d++) T['d' + d] = { nome: `${d}ª dúzia`, paga: 2, ganha: x => x >= d * 12 - 11 && x <= d * 12 };
for (let c = 1; c <= 3; c++) T['c' + c] = { nome: `${c}ª coluna`, paga: 2, ganha: x => x > 0 && (x - c) % 3 === 0 };
Object.assign(T, {
  vermelho: { nome: 'Vermelho', paga: 1, ganha: x => VERMELHOS.has(x) },
  preto:    { nome: 'Preto',    paga: 1, ganha: x => x > 0 && !VERMELHOS.has(x) },
  par:      { nome: 'Par',      paga: 1, ganha: x => x > 0 && x % 2 === 0 },
  impar:    { nome: 'Ímpar',    paga: 1, ganha: x => x % 2 === 1 },
  baixo:    { nome: '1 a 18',   paga: 1, ganha: x => x >= 1 && x <= 18 },
  alto:     { nome: '19 a 36',  paga: 1, ganha: x => x >= 19 },
});
export const APOSTAS = T;

// confere as apostas: { chave: fichas }. Devolve { apostas limpas, total } ou { erro }
export function conferir(apostas) {
  if (!apostas || typeof apostas !== 'object' || Array.isArray(apostas)) return { erro: 'Aposta inválida' };
  const limpas = {}; let total = 0;
  for (const [k, v] of Object.entries(apostas)) {
    if (!T[k]) return { erro: 'Aposta inválida' };
    const f = Number(v);
    if (!Number.isInteger(f) || f < 0) return { erro: 'Aposta inválida' };
    if (f) { limpas[k] = f; total += f; }
  }
  if (!total) return { erro: 'Coloque pelo menos uma ficha na mesa' };
  if (total > MAX_APOSTA) return { erro: `O máximo por rodada é ${MAX_APOSTA} fichas` };
  return { apostas: limpas, total };
}

// quanto volta pro jogador quando sai o número n (aposta ganhadora volta junto com o prêmio)
export function pagar(apostas, n) {
  let volta = 0; const ganhas = [];
  for (const [k, f] of Object.entries(apostas)) if (T[k].ganha(n)) { volta += f * (T[k].paga + 1); ganhas.push(k); }
  return { volta, ganhas };
}
