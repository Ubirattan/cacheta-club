// Roleta ao vivo de TESTE (link de teste sem login): as rodadas rodam no próprio celular,
// com fichas de mentira e alguns jogadores falsos. Mesmo formato de resposta da API.
import { conferir, pagar, MAX_APOSTA } from './roleta.js';
import { APOSTAS_MS, GIRO_MS, PAUSA_MS, faseDe } from './roleta-vivo.js';
const BOTS = [['🦊', 'Raposa'], ['🐯', 'Tigrão'], ['🤠', 'Peão'], ['🐼', 'Panda'], ['⚡', 'Raio'], ['👑', 'Rei'], ['🎩', 'Doutor']];
const CHAVES = ['vermelho', 'preto', 'par', 'impar', 'd1', 'd2', 'd3', 'n7', 'n17', 'n32', 'baixo', 'alto'];
export function criarTeste() {
  let coins = 1000, num = 0, rod = null, hist = [], apostas = [];
  const nova = a => {
    const start = Math.max(a, rod ? rod.fim + PAUSA_MS : 0) + APOSTAS_MS;
    rod = { id: ++num, num, resultado: Math.floor(Math.random() * 37), start, fim: start + GIRO_MS, fechada: false };
    apostas = BOTS.filter(() => Math.random() < .7).map(([avatar, nick]) => { const v = [2, 5, 10, 25, 50][Math.floor(Math.random() * 5)]; return { bot: true, nick, avatar, apostas: { [CHAVES[Math.floor(Math.random() * CHAVES.length)]]: v }, valor: v, status: 'aberta', ganho: 0 }; });
  };
  function anda(a) {
    if (!rod) nova(a);
    if (!rod.fechada && a >= rod.fim) {
      rod.fechada = true; hist.unshift(rod.resultado); hist = hist.slice(0, 15);
      for (const x of apostas) { const { volta } = pagar(x.apostas, rod.resultado); x.status = volta ? 'ganhou' : 'perdeu'; x.ganho = volta; if (!x.bot) coins += volta; }
    }
    if (a >= rod.fim + PAUSA_MS) nova(a);
  }
  const erro = m => { throw new Error(m); };
  return {
    async chamar(b) {
      const a = Date.now(); anda(a);
      const f = faseDe(rod, a), eu = () => apostas.find(x => !x.bot);
      if (b.op === 'apostar') {
        if (f !== 'apostas') erro('A roleta já está girando. Espere a próxima rodada');
        const c = conferir(b.apostas); if (c.erro) erro(c.erro);
        const ja = eu(), total = (ja ? ja.valor : 0) + c.total;
        if (total > MAX_APOSTA) erro(`No máximo ${MAX_APOSTA} fichas por rodada`);
        if (coins < c.total) erro('Fichas insuficientes');
        coins -= c.total;
        const soma = { ...(ja?.apostas || {}) }; for (const [k, v] of Object.entries(c.apostas)) soma[k] = (soma[k] || 0) + v;
        if (ja) { ja.apostas = soma; ja.valor = total; } else apostas.push({ nick: 'Você', avatar: '😎', apostas: soma, valor: total, status: 'aberta', ganho: 0 });
        return { ok: true, coins, minha: { apostas: soma, valor: total } };
      }
      const m = eu();
      return {
        agora: a, coins, rodada: { id: rod.id, num: rod.num, start: rod.start, fim: rod.fim, fase: f, ...(f !== 'apostas' ? { resultado: rod.resultado } : {}) },
        jogadores: apostas.length, total: apostas.reduce((t, x) => t + x.valor, 0),
        apostas: [...apostas].sort((x, y) => y.valor - x.valor), minha: m ? { apostas: m.apostas, valor: m.valor, status: m.status, ganho: m.ganho } : null, historico: hist,
      };
    },
  };
}
