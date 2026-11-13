// Foguetinho de TESTE (link de teste sem login): as rodadas rodam no próprio celular,
// com fichas de mentira e alguns jogadores falsos. Mesmo formato de resposta da API.
import { multEm, duracaoMs, sorteiaCrash, ganhoDe, APOSTAS_MS, PAUSA_MS } from './foguete.js';

const BOTS = [['🦊', 'Raposa'], ['🐯', 'Tigrão'], ['🤠', 'Peão'], ['🐼', 'Panda'], ['⚡', 'Raio'], ['👑', 'Rei']];
export function criarTeste() {
  let coins = 1000, num = 0, rod = null, hist = [], apostas = [];
  const nova = agora => {
    const start = Math.max(agora, rod ? rod.end + PAUSA_MS : 0) + APOSTAS_MS, crash = sorteiaCrash(Math.random());
    rod = { num: ++num, crash, start, end: start + duracaoMs(crash), fechada: false };
    apostas = BOTS.filter(() => Math.random() < .7).map(([avatar, nick]) => ({ bot: true, nick, avatar, valor: [5, 10, 20, 50, 100][Math.floor(Math.random() * 5)], auto: Math.round((1.2 + Math.random() * 4) * 100) / 100, status: 'aberta', ganho: 0 }));
  };
  const fase = a => a < rod.start ? 'apostas' : a < rod.end ? 'voando' : 'explodiu';
  function anda(a) {
    if (!rod) nova(a);
    if (!rod.fechada && a >= rod.end) {
      rod.fechada = true; hist.unshift(rod.crash); hist = hist.slice(0, 25);
      for (const x of apostas) if (x.status === 'aberta') {
        if (x.auto && x.auto <= rod.crash) { x.status = 'sacou'; x.mult = x.auto; x.ganho = ganhoDe(x.valor, x.auto); if (!x.bot) coins += x.ganho; } else x.status = 'perdeu';
      }
    }
    if (a >= rod.end + PAUSA_MS) nova(a);
    if (fase(a) === 'voando') for (const x of apostas) if (x.bot && x.status === 'aberta' && multEm(a - rod.start) >= x.auto) { x.status = 'sacou'; x.mult = x.auto; x.ganho = ganhoDe(x.valor, x.auto); }
  }
  const erro = m => { throw new Error(m); };
  return {
    async chamar(b) {
      const a = Date.now(); anda(a);
      const f = fase(a), slot = Number(b.slot) === 2 ? 2 : 1, minha = apostas.find(x => !x.bot && x.slot === slot && x.status !== 'cancelada');
      if (b.op === 'apostar') {
        if (f !== 'apostas') erro('O foguete já decolou. Espere a próxima rodada');
        if (minha) erro('Você já apostou nesse lugar');
        const valor = Math.floor(Number(b.valor)); if (!(valor >= 1 && valor <= 500)) erro('Aposte de 1 a 500 fichas');
        if (valor > coins) erro('Fichas insuficientes');
        coins -= valor; apostas.unshift({ slot, nick: 'Você', avatar: '😎', valor, auto: b.auto ? Number(b.auto) : null, status: 'aberta', ganho: 0 });
        return { ok: true, coins };
      }
      if (b.op === 'cancelar') { if (f !== 'apostas' || !minha) erro('Nada pra cancelar'); minha.status = 'cancelada'; coins += minha.valor; return { ok: true, coins }; }
      if (b.op === 'sacar') {
        if (f !== 'voando' || !minha || minha.status !== 'aberta') erro('Nada pra sacar');
        let m = Math.min(multEm(a - rod.start), rod.crash); if (minha.auto && minha.auto <= m) m = minha.auto;
        minha.status = 'sacou'; minha.mult = m; minha.ganho = ganhoDe(minha.valor, m); coins += minha.ganho;
        return { ok: true, mult: m, ganho: minha.ganho, coins };
      }
      const vis = apostas.filter(x => x.status !== 'cancelada');
      return {
        agora: a, coins,
        rodada: { num: rod.num, start: rod.start, fase: f, ...(f === 'explodiu' ? { crash: rod.crash, fim: rod.end } : {}) },
        apostas: [...vis].sort((p, q) => q.valor - p.valor).map(x => ({ nick: x.nick, avatar: x.avatar, valor: x.valor, mult: x.status === 'sacou' ? x.mult : null, ganho: x.ganho, perdeu: x.status === 'perdeu' })),
        total: vis.length,
        minhas: vis.filter(x => !x.bot).map(x => ({ slot: x.slot, valor: x.valor, auto: x.auto, status: x.status, mult: x.mult ?? null, ganho: x.ganho })),
        historico: hist,
      };
    },
  };
}
