// Modalidades e opções de sala (usado no navegador e no servidor)
export const MODES = {
  // coringa 'viraCor': carta seguinte à vira, só nos 2 naipes da mesma cor da vira
  cacheta: { name: 'Cacheta',           cfg: { hand: 9,  coringa: 'viraCor', deck: 'completo' } },
  dez:     { name: 'Cacheta 10 cartas', cfg: { hand: 10, coringa: 'viraCor', deck: 'completo' } },
  pifpaf:  { name: 'Pif Paf',           cfg: { hand: 9,  coringa: 'sem',     deck: 'completo' } },
};
export const ENTRIES = [0, 10, 20, 40, 100, 200, 500, 1000, 2000];
export const POINTS = [3, 5, 7, 10];
export const TURN_SECONDS = [20, 30, 45, 60];
export const AVATARS = ['😎','🤠','🦊','🐯','🦁','🐼','🐸','🦅','👑','🎩','🌵','⚡','🐺','🦉'];
export const fmt = n => Number(n || 0).toLocaleString('pt-BR');
