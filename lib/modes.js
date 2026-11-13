// Modalidades e opções de sala (usado no navegador e no servidor)
export const MODES = {
  // coringa 'viraCor': carta seguinte à vira, só nos 2 naipes da mesma cor da vira
  cacheta: { name: 'Cacheta',           cfg: { hand: 9,  coringa: 'viraCor', deck: 'completo', correr: true } },
  dez:     { name: 'Cacheta 10 cartas', cfg: { hand: 10, coringa: 'viraCor', deck: 'completo', correr: true } },
  pifpaf:  { name: 'Pif Paf',           cfg: { hand: 9,  coringa: 'sem',     deck: 'completo' } },
};
export const ENTRIES = [1, 2, 5, 10, 20, 50, 100, 200];   // toda mesa precisa de fichas   // entradas das salas (R$ 1 = 1 ficha)
export const POINTS = [3, 5, 7, 10];
export const TURN_SECONDS = [20, 30, 45, 60];
export const AVATARS = ['😎','🤠','🦊','🐯','🦁','🐼','🐸','🦅','👑','🎩','🌵','⚡','🐺','🦉'];
export const fmt = n => Number(n || 0).toLocaleString('pt-BR');

// Bolinha de gude online (sempre 1 contra 1)
export const GUDE_ROOMS = {
  'gude-triangulo': { name: 'Gude · Triângulo', sub: 'triangulo' },
  'gude-bulica':    { name: 'Gude · Buraco',    sub: 'bulica' },
  'gude-matamata':  { name: 'Gude · Mata-mata', sub: 'matamata' },
};
export const isGudeMode = m => !!GUDE_ROOMS[m];
// Sinuca online (sempre 1 contra 1)
export const SINUCA_ROOMS = {
  'sinuca-bola8':   { name: 'Sinuca · Bola 8',    sub: 'bola8' },
  'sinuca-lisa':    { name: 'Sinuca · Bola lisa', sub: 'lisa' },
  'sinuca-bolinho': { name: 'Sinuca · Bolinho',   sub: 'bolinho' },
};
export const isSinucaMode = m => !!SINUCA_ROOMS[m];
// Truco online: 1x1 (2 lugares) ou duplas (4 lugares)
export const TRUCO_ROOMS = {
  'truco-1x1':    { name: 'Truco · 1 contra 1', lugares: 2 },
  'truco-duplas': { name: 'Truco · Duplas',     lugares: 4 },
};
export const isTrucoMode = m => !!TRUCO_ROOMS[m];
// Pipa online (1 contra 1)
export const PIPA_ROOMS = { 'pipa-1x1': { name: 'Pipa · 1 contra 1' } };
export const isPipaMode = m => !!PIPA_ROOMS[m];
export const is1x1Mode = m => isGudeMode(m) || isSinucaMode(m) || isPipaMode(m);
// salas sem pontos e com entrada mínima de 2 (gude, sinuca e truco)
export const isMiniMode = m => is1x1Mode(m) || isTrucoMode(m);
export const modeName = m => (MODES[m] || GUDE_ROOMS[m] || SINUCA_ROOMS[m] || TRUCO_ROOMS[m] || PIPA_ROOMS[m])?.name || m;

// de qual jogo é uma modalidade (pra separar o ranking de cada jogo)
export const jogoDoModo = m => isGudeMode(m) ? 'gude' : isSinucaMode(m) ? 'sinuca' : isTrucoMode(m) ? 'truco' : isPipaMode(m) ? 'pipa' : 'cacheta';
export const JOGOS_RANKING = ['cacheta', 'truco', 'sinuca', 'gude', 'pipa'];
