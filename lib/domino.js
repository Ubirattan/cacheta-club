// DOMINÓ DE BAR EM DUPLAS (contra o computador). Contas puras, sem tela.
// 28 pedras (duplo-seis), 4 jogadores com 7 pedras cada, sem monte. Lugar 0 = você, 2 = parceiro,
// 1 e 3 = adversários; a vez anda 0 → 1 → 2 → 3. Dupla 0 (você e parceiro) x dupla 1.
// Pontos da batida: simples 1 · carroça 2 · lá-e-lô 3 · cruzada 4. Trancou: a dupla com menos pontos
// nas mãos marca 1. Ganha quem fizer 6 pontos.

export const META = 6;
export const PONTOS = { simples: 1, carroca: 2, laelo: 3, cruzada: 4, trancou: 1 };
export const NOME_BATIDA = { simples: 'Batida simples', carroca: 'Batida de carroça', laelo: 'Lá-e-lô', cruzada: 'Cruzada', trancou: 'Trancou' };
export const dupla = pi => pi % 2;
export const proximo = pi => (pi + 1) % 4;
export const ehCarroca = p => p.a === p.b;
export const soma = mao => mao.reduce((t, p) => t + p.a + p.b, 0);

export function todasPedras() {
  const out = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push({ id: a * 10 + b, a, b });
  return out;
}
function embaralhar(arr, rnd) { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

export function novaPartida(players, rnd = Math.random) {
  const M = { players: players.map(p => ({ ...p, mao: [] })), placar: [0, 0], mao: 0, rnd, over: null, ultima: null };
  novaMao(M, null);
  return M;
}

// distribui; a 1ª mão começa com a carroça de 6 (quem tem sai com ela); as outras, quem bateu sai com qualquer pedra
export function novaMao(M, saida) {
  const p = embaralhar(todasPedras(), M.rnd);
  M.players.forEach((pl, i) => { pl.mao = p.slice(i * 7, i * 7 + 7).sort((x, y) => x.a - y.a || x.b - y.b); });
  M.linha = []; M.pontas = null; M.passes = 0; M.ultimoJogou = null; M.fase = 'jogo'; M.resultado = null; M.mao++;
  if (saida == null) { M.vez = M.players.findIndex(pl => pl.mao.some(x => x.id === 66)); M.obrigaSena = true; }
  else { M.vez = saida; M.obrigaSena = false; }
}

// onde a pedra encaixa: ['L'], ['R'], ['L','R'] ou []
export function lados(M, p) {
  if (!M.pontas) return M.obrigaSena && p.id !== 66 ? [] : ['L'];
  const [l, r] = M.pontas, out = [];
  if (p.a === l || p.b === l) out.push('L');
  if ((p.a === r || p.b === r) && !(l === r && out.length)) out.push('R');   // pontas iguais: um lado só basta
  return out;
}
export const jogaveis = (M, pi) => M.players[pi].mao.filter(p => lados(M, p).length);
export const precisa = M => M.fase === 'fim' ? { kind: 'fim' } : M.fase === 'mao' ? { kind: 'mao' } : { kind: jogaveis(M, M.vez).length ? 'jogar' : 'passar', pi: M.vez };

// tipo da batida com a última pedra p jogada sobre as pontas [l, r] de antes
export function tipoBatida(p, pontas) {
  if (!pontas) return ehCarroca(p) ? 'carroca' : 'simples';
  const [l, r] = pontas;
  const nasDuas = l !== r ? ((p.a === l && p.b === r) || (p.a === r && p.b === l)) : false;
  if (ehCarroca(p)) return l === r && p.a === l ? 'cruzada' : 'carroca';
  return nasDuas ? 'laelo' : 'simples';
}

// jogada: { type: 'jogar', id, lado: 'L'|'R' } ou { type: 'passar' } · devolve { ok, ev } ou { ok: false, err }
export function agir(M, pi, mv) {
  if (M.fase !== 'jogo') return { ok: false, err: 'A mão acabou' };
  if (pi !== M.vez) return { ok: false, err: 'Não é a sua vez' };
  const pl = M.players[pi];
  if (mv.type === 'passar') {
    if (jogaveis(M, pi).length) return { ok: false, err: 'Você tem pedra pra jogar' };
    M.passes++; M.vez = proximo(pi);
    if (M.passes >= 4) return fechar(M, null);
    return { ok: true, ev: { type: 'passou', pi } };
  }
  const p = pl.mao.find(x => x.id === mv.id);
  if (!p) return { ok: false, err: 'Pedra inválida' };
  const ls = lados(M, p);
  if (!ls.length) return { ok: false, err: M.obrigaSena && !M.pontas ? 'Comece com a carroça de 6' : 'Essa pedra não encaixa' };
  const lado = ls.includes(mv.lado) ? mv.lado : ls[0];
  const antes = M.pontas ? M.pontas.slice() : null;
  if (!M.pontas) { M.linha = [{ id: p.id, a: p.a, b: p.b }]; M.pontas = [p.a, p.b]; }
  else if (lado === 'L') { const l = M.pontas[0], o = p.b === l ? { a: p.a, b: p.b } : { a: p.b, b: p.a }; M.linha.unshift({ id: p.id, ...o }); M.pontas[0] = o.a; }
  else { const r = M.pontas[1], o = p.a === r ? { a: p.a, b: p.b } : { a: p.b, b: p.a }; M.linha.push({ id: p.id, ...o }); M.pontas[1] = o.b; }
  pl.mao = pl.mao.filter(x => x.id !== p.id);
  M.passes = 0; M.ultimoJogou = pi; M.obrigaSena = false;
  if (!pl.mao.length) return fechar(M, { pi, tipo: tipoBatida(p, antes), pedra: p });
  M.vez = proximo(pi);
  return { ok: true, ev: { type: 'jogou', pi, pedra: p, lado } };
}

function fechar(M, bat) {
  let ev;
  if (bat) { const pts = PONTOS[bat.tipo]; M.placar[dupla(bat.pi)] += pts; ev = { type: 'mao', dupla: dupla(bat.pi), pts, tipo: bat.tipo, pi: bat.pi, saida: bat.pi }; }
  else {
    const s = [0, 1].map(d => soma(M.players[d].mao) + soma(M.players[d + 2].mao));
    const d = s[0] === s[1] ? -1 : s[0] < s[1] ? 0 : 1;
    if (d >= 0) M.placar[d] += PONTOS.trancou;
    ev = { type: 'mao', dupla: d, pts: d >= 0 ? PONTOS.trancou : 0, tipo: 'trancou', somas: s, saida: M.ultimoJogou ?? M.vez };
  }
  M.resultado = ev; M.ultima = ev;
  const venc = M.placar.findIndex(x => x >= META);
  if (venc >= 0) { M.fase = 'fim'; M.over = { dupla: venc }; } else M.fase = 'mao';
  return { ok: true, ev };
}
// depois de mostrar o resultado da mão
export function seguir(M) { if (M.fase === 'mao') novaMao(M, M.resultado.saida); }

// ---------------- computador ----------------
// fácil: qualquer pedra que encaixa · esperto: bate quando pode (de preferência valendo mais), solta carroça e pedra
// pesada cedo, e tenta deixar nas pontas números que ele (e o parceiro) jogaram/tem, não os que o adversário mostrou.
export function jogadaBot(M, pi, nivel = 'medio') {
  const ops = [];
  for (const p of jogaveis(M, pi)) for (const lado of lados(M, p)) ops.push({ p, lado });
  if (!ops.length) return { type: 'passar' };
  if (nivel === 'facil') { const o = ops[Math.floor(M.rnd() * ops.length)]; return { type: 'jogar', id: o.p.id, lado: o.lado }; }
  const mao = M.players[pi].mao;
  const conta = n => mao.filter(x => x.a === n || x.b === n).length;
  let best = null, bs = -1e9;
  for (const { p, lado } of ops) {
    let s = p.a + p.b + (ehCarroca(p) ? 6 : 0);
    if (mao.length === 1) s += 100 + PONTOS[tipoBatida(p, M.pontas)] * 10;
    if (M.pontas) {
      const novo = lado === 'L' ? (p.b === M.pontas[0] ? p.a : p.b) : (p.a === M.pontas[1] ? p.b : p.a);
      s += conta(novo) * 3 - (novo === (lado === 'L' ? M.pontas[1] : M.pontas[0]) ? 1 : 0);
    }
    s += M.rnd() * .5;
    if (s > bs) { bs = s; best = { type: 'jogar', id: p.id, lado }; }
  }
  return best;
}
