// Motor do TRUCO PAULISTA + jogadas do computador.
// Funções puras, sem DOM: o mesmo código pode rodar no servidor quando vier o truco online.
//
// Regras usadas:
// - Baralho de 40 cartas (sem 8, 9 e 10). Cada um recebe 3 cartas e uma carta é virada (vira).
// - Força das cartas, da mais fraca pra mais forte: 4 5 6 7 Q J K A 2 3.
// - Manilha: a carta seguinte à vira (vira 3 → manilha 4). Entre as manilhas: ♦ < ♠ < ♥ < ♣ (zap).
// - A mão tem até 3 rodadas (vazas). Ganha a mão quem fizer 2.
//   Empates: empatou a 1ª → quem ganhar a 2ª leva. Ganhou a 1ª e empatou a 2ª ou a 3ª → leva quem fez a 1ª.
//   Empatou tudo → ninguém marca.
// - A mão vale 1. Truco pede 3, depois 6, 9 e 12. Quem pediu por último não pode aumentar de novo.
//   Quem corre dá ao outro time o valor que a mão valia antes do pedido.
// - Mão de onze: o time com 11 pontos vê as cartas e decide se joga (vale 3) ou corre (o outro time faz 1).
//   Na mão de onze ninguém pode pedir truco. Os dois com 11 (mão de ferro): vale 1, sem truco.
// - Ganha quem fizer 12 pontos.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];   // mesmo índice do Card da Cacheta
export const SUITS = ['♠', '♥', '♦', '♣'];
const TORDER = [3, 4, 5, 6, 11, 10, 12, 0, 1, 2];          // 4 5 6 7 Q J K A 2 3 (índices de RANKS)
const MAN_SUIT = { 2: 0, 0: 1, 1: 2, 3: 3 };              // ♦ pica-fumo, ♠ espadilha, ♥ copas, ♣ zap
export const VALUES = [1, 3, 6, 9, 12];
export const CALL_NAME = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };
export const MAN_NAME = { 2: 'Pica-fumo', 0: 'Espadilha', 1: 'Copas', 3: 'Zap' };
export const WIN = 12;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const cardName = c => RANKS[c.r] + SUITS[c.s];
export const manilhaRank = vira => TORDER[(TORDER.indexOf(vira.r) + 1) % 10];
export const isManilha = (c, vira) => c.r === manilhaRank(vira);
// força: 0..9 cartas comuns, 10..13 manilhas
export const power = (c, vira) => isManilha(c, vira) ? 10 + MAN_SUIT[c.s] : TORDER.indexOf(c.r);
export const teamOf = pi => pi % 2;                       // 1x1: 0 e 1 · duplas: 0 e 2 contra 1 e 3
const nextValue = v => VALUES[VALUES.indexOf(v) + 1] || null;

function newDeck() {
  const d = []; let id = 0;
  for (const r of TORDER) for (let s = 0; s < 4; s++) d.push({ id: id++, r, s });
  return shuffle(d);
}

export function newMatch(players) {
  // players: [{name, avatar, bot}] na ordem da mesa (sentido horário). 2 ou 4.
  const M = { n: players.length, players: players.map(p => ({ ...p, hand: [] })), score: [0, 0], dealer: Math.random() * players.length | 0, handNo: 0, log: [] };
  startHand(M);
  return M;
}

export function startHand(M) {
  const deck = newDeck();
  M.handNo++;
  M.players.forEach(p => { p.hand = []; });
  for (let k = 0; k < 3; k++) for (let i = 1; i <= M.n; i++) M.players[(M.dealer + i) % M.n].hand.push(deck.pop());
  M.vira = deck.pop();
  M.value = 1; M.raisedBy = null; M.pending = null;
  M.vazas = []; M.table = []; M.vazaWinner = null;
  M.starter = (M.dealer + 1) % M.n; M.turn = M.starter;
  M.result = null; M.over = null;
  const [a, b] = M.score;
  M.ferro = a === WIN - 1 && b === WIN - 1;
  M.onze = M.ferro ? null : a === WIN - 1 ? 0 : b === WIN - 1 ? 1 : null;   // time que está com 11
  M.phase = M.onze !== null ? 'onze' : 'play';
}

// quem precisa agir agora: {kind, team, pi}
export function needs(M) {
  if (M.phase === 'onze') return { kind: 'onze', team: M.onze };
  if (M.phase !== 'play') return { kind: M.phase };
  if (M.pending) return { kind: 'resp', team: 1 - M.pending.by, pi: (M.pending.pi + 1) % M.n };
  return { kind: 'play', pi: M.turn, team: teamOf(M.turn) };
}

export function canCall(M, pi) {
  return M.phase === 'play' && !M.pending && M.turn === pi && M.onze === null && !M.ferro
    && M.value < 12 && M.raisedBy !== teamOf(pi);
}

const err = e => ({ ok: false, err: e });

export function act(M, pi, a) {
  const t = teamOf(pi), nd = needs(M);
  switch (a.type) {
    case 'onze': {
      if (nd.kind !== 'onze' || nd.team !== t) return err('Não é hora de decidir a mão de onze');
      if (!a.jogar) return endHand(M, 1 - t, 1, 'correu da mão de onze');
      M.value = 3; M.phase = 'play';
      return { ok: true, ev: { type: 'onze', pi, jogar: true } };
    }
    case 'truco': {
      if (!canCall(M, pi)) return err('Agora não dá pra pedir');
      const v = nextValue(M.value);
      M.pending = { by: t, pi, value: v };
      return { ok: true, ev: { type: 'truco', pi, value: v } };
    }
    case 'aceitar': case 'correr': case 'aumentar': {
      if (nd.kind !== 'resp' || nd.team !== t) return err('Não é você que responde');
      const P = M.pending;
      if (a.type === 'correr') { M.pending = null; return endHand(M, P.by, M.value, 'correu'); }
      M.value = P.value; M.raisedBy = P.by; M.pending = null;
      if (a.type === 'aceitar') return { ok: true, ev: { type: 'aceitar', pi, value: M.value } };
      const v = nextValue(M.value);
      if (!v) return err('Já está valendo 12');
      M.pending = { by: t, pi, value: v };
      return { ok: true, ev: { type: 'truco', pi, value: v, raise: true } };
    }
    case 'play': {
      if (nd.kind !== 'play' || M.turn !== pi) return err('Não é sua vez');
      const p = M.players[pi], k = p.hand.findIndex(c => c.id === a.id);
      if (k < 0) return err('Carta inválida');
      const [card] = p.hand.splice(k, 1);
      M.table.push({ pi, card });
      if (M.table.length < M.n) { M.turn = (pi + 1) % M.n; return { ok: true, ev: { type: 'play', pi, card } }; }
      return closeVaza(M, { type: 'play', pi, card });
    }
    case 'next': {   // a tela chama depois de mostrar a vaza ou o resultado da mão
      if (M.phase === 'vaza') { M.table = []; M.vazaWinner = null; M.phase = 'play'; return { ok: true, ev: { type: 'next' } }; }
      if (M.phase === 'hand') { M.dealer = (M.dealer + 1) % M.n; startHand(M); return { ok: true, ev: { type: 'deal' } }; }
      return err('Nada pra avançar');
    }
  }
  return err('Jogada desconhecida');
}

function closeVaza(M, ev) {
  let best = -1, winners = [];
  for (const x of M.table) {
    const pw = power(x.card, M.vira);
    if (pw > best) { best = pw; winners = [x]; } else if (pw === best) winners.push(x);
  }
  const teams = new Set(winners.map(x => teamOf(x.pi)));
  const vt = teams.size > 1 ? -1 : teamOf(winners[0].pi);           // -1 = empate (cangou)
  M.vazas.push(vt);
  M.vazaWinner = vt < 0 ? null : winners[0].pi;
  const nextStart = vt < 0 ? M.starter : winners[0].pi;
  M.starter = nextStart; M.turn = nextStart;
  ev.vaza = vt;
  const w = handWinner(M.vazas);
  if (w !== undefined) { const r = endHand(M, w, M.value, w < 0 ? 'empate' : 'vazas'); r.ev.vazaEv = ev; return r; }
  M.phase = 'vaza';
  return { ok: true, ev };
}

// undefined = mão continua · -1 = ninguém marca · 0/1 = time que ganhou
export function handWinner(v) {
  const [a, b, c] = v;
  if (v.length < 2) return undefined;
  if (v.length === 2) {
    if (a === -1 && b === -1) return undefined;
    if (a === -1) return b;
    if (b === -1) return a;
    if (a === b) return a;
    return undefined;
  }
  if (c === -1) return a !== -1 ? a : b !== -1 ? b : -1;
  return c;
}

function endHand(M, team, pts, why) {
  if (team >= 0) M.score[team] = Math.min(WIN, M.score[team] + pts);
  M.result = { team, pts: team >= 0 ? pts : 0, why };
  M.phase = 'hand';
  if (M.score[0] >= WIN || M.score[1] >= WIN) { M.over = { team: M.score[0] >= WIN ? 0 : 1 }; M.phase = 'over'; }
  return { ok: true, ev: { type: 'hand', ...M.result } };
}

/* =====================================================================
   COMPUTADOR
   ===================================================================== */
const strength = (cards, vira) => cards.reduce((s, c) => s + power(c, vira), 0);
// quanto a mão "promete": cartas na mão + rodadas já feitas
function prospect(M, pi) {
  const t = teamOf(pi), v = M.vira;
  const pws = M.players[pi].hand.map(c => power(c, v)).sort((a, b) => b - a);
  // nas duplas, o computador conta um pouco com o parceiro
  let s = 0;
  pws.forEach((p, i) => { s += p >= 10 ? 4 + (p - 10) * .6 : p >= 7 ? 2 + (p - 7) * .5 : p * .15; if (i === 0 && p >= 11) s += 1; });
  M.table.filter(x => teamOf(x.pi) === t).forEach(x => { const p = power(x.card, v); if (p >= 7) s += 1; });
  const won = M.vazas.filter(x => x === t).length, lost = M.vazas.filter(x => x === 1 - t).length;
  s += won * 3 - lost * 3;
  if (M.n === 4) s += 1;
  return s;
}

export function botMove(M, pi, level = 'medio') {
  const nd = needs(M), t = teamOf(pi), rnd = Math.random();
  if (nd.kind === 'onze') {
    const s = prospect(M, pi);
    return { type: 'onze', jogar: s >= 6 || rnd < .15 };
  }
  if (nd.kind === 'resp') {
    const s = prospect(M, pi), P = M.pending;
    const need = 5 + (P.value >= 6 ? 1.5 : 0) + (P.value >= 9 ? 1.5 : 0);
    // se perder vale pouco e o outro time está quase ganhando, aceita mais
    const desperate = M.score[1 - t] + M.value >= WIN;
    if (s >= need + 4 && nextValue(P.value) && rnd < .6) return { type: 'aumentar' };
    if (s >= need || desperate || rnd < .08) return { type: 'aceitar' };
    return { type: 'correr' };
  }
  // vez de jogar: pede truco?
  if (canCall(M, pi)) {
    const s = prospect(M, pi);
    const bluff = level !== 'facil' && rnd < .07;
    if (level === 'facil' && rnd < .5) return { type: 'play', id: chooseCard(M, pi).id };
    const lead = M.score[t] - M.score[1 - t];
    if (s >= 10 - (lead < -4 ? 1.5 : 0) || bluff) {
      // não pede com a mão toda boa no começo: espera um pouco pra não assustar
      if (!(M.vazas.length === 0 && M.table.length === 0 && s >= 13 && rnd < .5)) return { type: 'truco' };
    }
  }
  const hand = M.players[pi].hand;
  if (level === 'facil' && rnd < .4) return { type: 'play', id: hand[Math.random() * hand.length | 0].id };   // fácil: às vezes joga qualquer uma
  return { type: 'play', id: chooseCard(M, pi).id };
}

function chooseCard(M, pi) {
  const v = M.vira, t = teamOf(pi), hand = M.players[pi].hand.slice().sort((a, b) => power(a, v) - power(b, v));
  const low = hand[0], high = hand[hand.length - 1];
  if (!M.table.length) {
    // abrindo a rodada
    if (M.vazas.length === 0) return hand.length === 3 ? (power(high, v) >= 10 ? hand[1] : high) : high;
    if (M.vazas[M.vazas.length - 1] === t || M.vazas[0] === -1) return high;   // fechar a mão
    return high;
  }
  let best = -1, bestTeam = -1;
  for (const x of M.table) { const p = power(x.card, v); if (p > best) { best = p; bestTeam = teamOf(x.pi); } else if (p === best && teamOf(x.pi) !== bestTeam) bestTeam = -1; }
  const last = M.table.length === M.n - 1;
  if (bestTeam === t && (last || best >= 9)) return low;                     // parceiro já está ganhando
  const beat = hand.filter(c => power(c, v) > best);
  if (beat.length) return beat[0];                                           // ganha com a menor que dá
  const tie = hand.find(c => power(c, v) === best);
  if (tie && M.vazas.length > 0 && M.vazas[0] === t) return tie;             // empatar garante a mão
  return low;
}
