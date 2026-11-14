// JOGO DO BICHO (fichas virtuais, sorteio próprio do site). Contas puras: servidor e tela usam.
// Cada sorteio tem 5 prêmios (milhares de 0000 a 9999). O bicho sai pela dezena final da milhar.
import { teto, PREMIO_MAXIMO } from './premio.js';

// os 25 bichos (grupo 1 = dezenas 01-04 … grupo 25 = dezenas 97, 98, 99, 00)
export const BICHOS = [
  ['Avestruz', '🦤'], ['Águia', '🦅'], ['Burro', '🫏'], ['Borboleta', '🦋'], ['Cachorro', '🐕'],
  ['Cabra', '🐐'], ['Carneiro', '🐏'], ['Camelo', '🐫'], ['Cobra', '🐍'], ['Coelho', '🐇'],
  ['Cavalo', '🐎'], ['Elefante', '🐘'], ['Galo', '🐓'], ['Gato', '🐈'], ['Jacaré', '🐊'],
  ['Leão', '🦁'], ['Macaco', '🐒'], ['Porco', '🐖'], ['Pavão', '🦚'], ['Peru', '🦃'],
  ['Touro', '🐂'], ['Tigre', '🐅'], ['Urso', '🐻'], ['Veado', '🦌'], ['Vaca', '🐄'],
];
export const grupoDe = milhar => { const d = Number(milhar) % 100; return d === 0 ? 25 : Math.ceil(d / 4); };
export const dezenasDo = g => [1, 2, 3, 4].map(i => String((4 * (g - 1) + i) % 100).padStart(2, '0'));
export const bicho = g => ({ g, nome: BICHOS[g - 1][0], em: BICHOS[g - 1][1] });

// quanto paga (x a aposta) acertando NA CABEÇA (1º prêmio). "Do 1º ao 5º" paga 1/5 disso por prêmio que acertar.
export const TIPOS = {
  grupo: { nome: 'Grupo', sub: 'Acerta o bicho', paga: 18, dig: 0 },
  dezena: { nome: 'Dezena', sub: '2 últimos números', paga: 60, dig: 2 },
  centena: { nome: 'Centena', sub: '3 últimos números', paga: 600, dig: 3 },
  milhar: { nome: 'Milhar', sub: 'Os 4 números', paga: 4000, dig: 4 },
};
export const POS = { cabeca: 'Na cabeça (1º prêmio)', todos: 'Do 1º ao 5º prêmio' };
export const MIN_APOSTA = 1, MAX_POR_SORTEIO = 1000;
export { PREMIO_MAXIMO };

// horários dos sorteios (hora de Brasília) e quando fecham as apostas
export const HORARIOS = [11, 14, 16, 18, 21];
export const FECHA_ANTES_MS = 60 * 1000;   // apostas fecham 1 min antes
const BR = -3 * 3600e3;                    // Brasília (UTC-3, sem horário de verão)
const p2 = n => String(n).padStart(2, '0');
export const chaveDe = ms => { const d = new Date(ms + BR); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}h`; };
export const horaTxt = ms => `${new Date(ms + BR).getUTCHours()}h`;
export const diaTxt = (ms, agora = Date.now()) => {
  const um = 86400e3, dia = t => Math.floor((t + BR) / um), d = dia(ms) - dia(agora);
  if (d === 0) return 'Hoje'; if (d === 1) return 'Amanhã'; if (d === -1) return 'Ontem';
  const x = new Date(ms + BR); return `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}`;
};
// sorteios do dia de agora (em ms) e o próximo que ainda aceita aposta
export function sorteiosDoDia(agora) {
  const d = new Date(agora + BR), base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - BR;
  return HORARIOS.map(h => base + h * 3600e3);
}
export function proximoSorteio(agora) {
  for (let i = 0; i < 3; i++) { const t = sorteiosDoDia(agora + i * 86400e3).find(x => x - FECHA_ANTES_MS > agora); if (t) return t; }
  return null;
}

// confere uma aposta { tipo, palpite, pos, valor } → normalizada, ou { erro }
export function conferir(a = {}) {
  const t = TIPOS[a.tipo]; if (!t) return { erro: 'Escolha o tipo de aposta' };
  if (!POS[a.pos]) return { erro: 'Escolha na cabeça ou do 1º ao 5º' };
  const valor = Math.floor(Number(a.valor));
  if (!(valor >= MIN_APOSTA)) return { erro: `Aposta mínima de ${MIN_APOSTA} ficha` };
  if (valor > MAX_POR_SORTEIO) return { erro: `No máximo ${MAX_POR_SORTEIO} fichas por sorteio` };
  let palpite;
  if (a.tipo === 'grupo') { const g = Math.floor(Number(a.palpite)); if (!(g >= 1 && g <= 25)) return { erro: 'Escolha um bicho' }; palpite = String(g); }
  else { const s = String(a.palpite ?? '').replace(/\D/g, ''); if (s.length !== t.dig) return { erro: `Digite ${t.dig} números` }; palpite = s; }
  return { tipo: a.tipo, palpite, pos: a.pos, valor };
}
// quantos prêmios a aposta acertou (na cabeça: 0 ou 1)
export function acertos(a, premios) {
  const ok = m => { const s = String(m).padStart(4, '0'); return a.tipo === 'grupo' ? grupoDe(s) === Number(a.palpite) : s.endsWith(a.palpite); };
  const lista = a.pos === 'cabeca' ? premios.slice(0, 1) : premios.slice(0, 5);
  return lista.filter(ok).length;
}
const r2 = x => Math.round(x * 100) / 100;
export const premioPossivel = a => teto(r2(a.valor * TIPOS[a.tipo].paga / (a.pos === 'cabeca' ? 1 : 5)));
export const ganho = (a, premios) => { const n = acertos(a, premios); return n ? teto(r2(a.valor * TIPOS[a.tipo].paga * n / (a.pos === 'cabeca' ? 1 : 5))) : 0; };
export const descreve = a => a.tipo === 'grupo' ? `${bicho(Number(a.palpite)).em} ${bicho(Number(a.palpite)).nome} (grupo ${a.palpite})` : `${TIPOS[a.tipo].nome} ${a.palpite}`;
