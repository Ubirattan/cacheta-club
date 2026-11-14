// Double de TESTE (link de teste sem login): as rodadas rodam no próprio celular,
// com fichas de mentira e alguns jogadores falsos. Mesmo formato de resposta da API.
import { CASAS, CORES, APOSTAS_MS, GIRO_MS, PAUSA_MS, MIN_APOSTA, MAX_APOSTA, corDe, ganhoDe, faseDe } from './double.js';
const BOTS = [['🦊', 'Raposa'], ['🐯', 'Tigrão'], ['🤠', 'Peão'], ['🐼', 'Panda'], ['⚡', 'Raio'], ['👑', 'Rei'], ['🎩', 'Doutor']];
export function criarTeste() {
  let coins = 1000, num = 0, rod = null, hist = [], apostas = [];
  const nova = a => {
    const start = Math.max(a, rod ? rod.fim + PAUSA_MS : 0) + APOSTAS_MS;
    rod = { num: ++num, resultado: Math.floor(Math.random() * CASAS), start, fim: start + GIRO_MS, fechada: false };
    apostas = BOTS.filter(() => Math.random() < .75).map(([avatar, nick]) => ({ bot: true, nick, avatar, cor: Math.random() < .1 ? 'branco' : Math.random() < .5 ? 'vermelho' : 'preto', valor: [2, 5, 10, 20, 50][Math.floor(Math.random() * 5)], status: 'aberta', ganho: 0 }));
  };
  function anda(a) {
    if (!rod) nova(a);
    if (!rod.fechada && a >= rod.fim) {
      rod.fechada = true; hist.unshift(rod.resultado); hist = hist.slice(0, 20);
      const cor = corDe(rod.resultado);
      for (const x of apostas) if (x.cor === cor) { x.status = 'ganhou'; x.ganho = ganhoDe(x.valor, cor); if (!x.bot) coins = Math.round((coins + x.ganho) * 100) / 100; } else x.status = 'perdeu';
    }
    if (a >= rod.fim + PAUSA_MS) nova(a);
  }
  const erro = m => { throw new Error(m); };
  return {
    async chamar(b) {
      const a = Date.now(); anda(a);
      const f = faseDe(rod, a);
      if (b.op === 'apostar') {
        if (f !== 'apostas') erro('A roleta já está girando. Espere a próxima rodada');
        const cor = CORES.includes(b.cor) ? b.cor : erro('Escolha a cor'), valor = Math.floor(Number(b.valor));
        if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) erro(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
        if (coins < valor) erro('Fichas insuficientes');
        const ja = apostas.find(x => !x.bot && x.cor === cor);
        if (ja && ja.valor + valor > MAX_APOSTA) erro(`No máximo ${MAX_APOSTA} fichas em cada cor`);
        coins -= valor;
        if (ja) ja.valor += valor; else apostas.push({ nick: 'Você', avatar: '😎', cor, valor, status: 'aberta', ganho: 0 });
        return { ok: true, coins };
      }
      const totais = Object.fromEntries(CORES.map(c => { const l = apostas.filter(x => x.cor === c); return [c, { qtd: l.length, soma: l.reduce((t, x) => t + x.valor, 0) }]; }));
      return {
        agora: a, coins, rodada: { num: rod.num, start: rod.start, fim: rod.fim, fase: f, ...(f !== 'apostas' ? { resultado: rod.resultado } : {}) },
        totais, apostas: [...apostas].sort((x, y) => y.valor - x.valor), minhas: apostas.filter(x => !x.bot), historico: hist,
      };
    },
  };
}
