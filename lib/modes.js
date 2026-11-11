// Modalidades e opções de sala (usado no navegador e no servidor)
export const MODES = {
  cacheta: { name: 'Cacheta',           cfg: { hand: 9,  coringa: 'vira' } },
  dez:     { name: 'Cacheta 10 cartas', cfg: { hand: 10, coringa: 'vira' } },
  pifpaf:  { name: 'Pif Paf',           cfg: { hand: 9,  coringa: 'sem'  } },
};
export const ENTRIES = [0, 10, 20, 40, 100, 200, 500, 1000, 2000];
export const POINTS = [3, 5, 7, 10];
export const TURN_SECONDS = [20, 30, 45, 60];
export const AVATARS = ['😎','🤠','🦊','🐯','🦁','🐼','🐸','🦅','👑','🎩','🌵','⚡','🐺','🦉'];
export const fmt = n => Number(n || 0).toLocaleString('pt-BR');
