// Mines de TESTE (link de teste sem login): roda no próprio celular, com fichas de mentira.
import { multDe, ganhoDe, livres, sortearMinas, publico, MIN_BOMBAS, MAX_BOMBAS, MIN_APOSTA, MAX_APOSTA, MAX_GANHO } from './mines.js';
export function criarTeste() {
  let coins = 1000, p = null, id = 0;
  const erro = m => { throw new Error(m); };
  const resp = () => ({ partida: publico(p), coins });
  return {
    async chamar(b) {
      if (b.op === 'estado') return { partida: p && p.status === 'jogando' ? publico(p) : null, coins };
      if (b.op === 'iniciar') {
        if (p && p.status === 'jogando') erro('Termine a partida que está aberta');
        const valor = Math.floor(Number(b.valor)), bombas = Math.floor(Number(b.bombas));
        if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) erro(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
        if (!(bombas >= MIN_BOMBAS && bombas <= MAX_BOMBAS)) erro(`Escolha de ${MIN_BOMBAS} a ${MAX_BOMBAS} bombas`);
        if (coins < valor) erro('Fichas insuficientes');
        coins -= valor; p = { id: ++id, valor, bombas, minas: sortearMinas(bombas, n => Math.floor(Math.random() * n)), abertas: [], status: 'jogando', ganho: 0 };
        return resp();
      }
      if (!p || p.status !== 'jogando') erro('Nenhuma partida aberta. Toque em JOGAR');
      if (b.op === 'abrir') {
        const casa = Number(b.casa);
        if (p.abertas.includes(casa)) return resp();
        p.abertas = [...p.abertas, casa];
        if (p.minas.includes(casa)) { p.status = 'perdeu'; p.bomba = casa; return resp(); }
        const pr = ganhoDe(p.valor, multDe(p.bombas, p.abertas.length));
        if (p.abertas.length >= livres(p.bombas) || pr >= MAX_GANHO) { p.status = 'sacou'; p.ganho = pr; coins = Math.round((coins + pr) * 100) / 100; }
        return resp();
      }
      if (b.op === 'sacar') {
        if (!p.abertas.length) erro('Abra pelo menos uma casa antes de sacar');
        p.ganho = ganhoDe(p.valor, multDe(p.bombas, p.abertas.length)); p.status = 'sacou'; coins = Math.round((coins + p.ganho) * 100) / 100;
        return resp();
      }
      erro('Ação inválida');
    },
  };
}
