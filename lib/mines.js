// MINES (campo minado): grade 5x5 com bombas escondidas. Cada casa sem bomba aumenta o prêmio;
// o jogador saca quando quiser. Se abrir uma bomba, perde a aposta. Contas puras (servidor e celular).
export const CASAS = 25;
export const MARGEM = 0.03;              // a casa fica com 3% em média (padrão dos Mines)
export const MIN_BOMBAS = 1, MAX_BOMBAS = 24;   // com 3% até 1 bomba já paga mais que a aposta (1,01x)
export const MIN_APOSTA = 1, MAX_APOSTA = 500;
export const MAX_GANHO = 4000;           // prêmio máximo de uma partida
export const BOMBAS_RAPIDAS = [3, 5, 10, 24];

// multiplicador depois de abrir k casas sem bomba: (chance justa invertida) × (1 − margem)
export function multDe(bombas, k) {
  if (!k) return 1;
  let justo = 1;
  for (let i = 0; i < k; i++) justo *= (CASAS - i) / (CASAS - bombas - i);
  return Math.floor(justo * (1 - MARGEM) * 100 + 1e-6) / 100;
}
export const ganhoDe = (valor, mult) => Math.min(MAX_GANHO, Math.floor(valor * mult * 100 + 1e-6) / 100);
export const livres = bombas => CASAS - bombas;
// sorteia as casas das bombas (r() devolve um inteiro em [0, n))
export function sortearMinas(bombas, r) {
  const casas = Array.from({ length: CASAS }, (_, i) => i);
  for (let i = CASAS - 1; i > 0; i--) { const j = r(i + 1); [casas[i], casas[j]] = [casas[j], casas[i]]; }
  return casas.slice(0, bombas).sort((a, b) => a - b);
}
export const fichas = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
// o que o celular pode ver da partida (as bombas só aparecem quando ela acaba)
export function publico(p) {
  if (!p) return null;
  const abertas = p.abertas || [], fim = p.status !== 'jogando';
  const mult = multDe(p.bombas, abertas.length);
  return {
    id: p.id, valor: Number(p.valor), bombas: p.bombas, abertas, status: p.status,
    mult, premio: abertas.length ? ganhoDe(Number(p.valor), mult) : 0,
    proximo: abertas.length < livres(p.bombas) ? multDe(p.bombas, abertas.length + 1) : null,
    ganho: Number(p.ganho) || 0, ...(fim ? { minas: p.minas, bomba: p.bomba ?? null } : {}),
  };
}
