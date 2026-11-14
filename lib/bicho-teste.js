// Jogo do bicho de TESTE (link de teste sem login): sorteio a cada 2 minutos no próprio celular,
// com fichas de mentira. Mesmo formato de resposta da API.
import { conferir, ganho, MAX_POR_SORTEIO } from './bicho.js';
const CICLO = 2 * 60e3, FECHA = 10e3;
export function criarTeste() {
  let coins = 1000, seq = 0; const res = [], minhas = [];
  const prox = a => Math.ceil((a + FECHA + 1) / CICLO) * CICLO;
  let feitos = Math.floor(Date.now() / CICLO) * CICLO;
  function anda(a) {
    while (feitos + CICLO <= a) {
      feitos += CICLO; const premios = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10000));
      res.unshift({ id: ++seq, hora: feitos, premios }); res.splice(10);
      for (const m of minhas) if (m.status === 'aberta' && m.hora === feitos) { m.ganho = ganho(m, premios); m.status = m.ganho ? 'ganhou' : 'perdeu'; coins += m.ganho; }
    }
  }
  return {
    async chamar(b) {
      const a = Date.now(); anda(a); const h = prox(a);
      if (b.op === 'apostar') {
        const c = conferir(b.aposta); if (c.erro) throw new Error(c.erro);
        const ja = minhas.filter(m => m.hora === h).reduce((x, m) => x + m.valor, 0);
        if (ja + c.valor > MAX_POR_SORTEIO) throw new Error(`No máximo ${MAX_POR_SORTEIO} fichas por sorteio`);
        if (coins < c.valor) throw new Error('Fichas insuficientes');
        coins -= c.valor; minhas.unshift({ id: ++seq, ...c, hora: h, status: 'aberta', ganho: 0 });
        return { ok: true, coins };
      }
      return { agora: a, coins, teste: true, proximo: { id: h, hora: h, fecha: h - FECHA }, resultados: res, minhas: minhas.slice(0, 30) };
    },
  };
}
