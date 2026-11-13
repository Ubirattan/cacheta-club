// Os jogos da Casa de Jogos: cartão da tela inicial, opções dentro de cada jogo e o que a loja dele vende.
export const JOGOS = {
  cacheta: { nome: 'Cacheta', sub: 'Online, torneio e contra o computador', em: '🃏', href: '/cacheta', g: 'linear-gradient(160deg,#38b6ff,#1565d8 55%,#0a3fa8)', loja: ['back', 'felt', 'avatar'] },
  truco: { nome: 'Truco', sub: 'Paulista · 1x1 e duplas', em: '♣️', href: '/jogos/truco', g: 'linear-gradient(160deg,#f87171,#c81e3a 55%,#7f0d22)', loja: ['back', 'felt', 'avatar'],
    opcoes: [
      { t: 'Truco online', sub: '1x1 ou duplas valendo fichas', em: '🌐', href: '/lobby?jogo=truco', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/truco', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  sinuca: { nome: 'Sinuca', sub: 'Bola 8, bola lisa e bolinho', em: '🎱', href: '/jogos/sinuca', g: 'linear-gradient(160deg,#4ade80,#15803d 55%,#0b4d25)', novo: true, loja: ['avatar'],
    opcoes: [
      { t: 'Sinuca online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=sinuca', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/sinuca', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  gude: { nome: 'Bolinha de gude', sub: 'Triângulo, buraco e mata-mata', em: null, href: '/jogos/gude', g: 'linear-gradient(160deg,#a78bfa,#6d28d9 55%,#3b0f80)', loja: ['avatar'],
    opcoes: [
      { t: 'Gude online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=gude', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/gude', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  pipa: { nome: 'Pipa', sub: 'Corta, apara e manda busca', em: '🪁', href: '/jogos/pipa', g: 'linear-gradient(160deg,#fbbf24,#ea7a0a 55%,#9a3412)', loja: ['pipa', 'avatar'],
    opcoes: [
      { t: 'Pipa online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=pipa', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/pipa', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
};
export const ORDEM = ['cacheta', 'truco', 'sinuca', 'gude', 'pipa'];
export const LOJA_TITULO = { avatar: '✨ Avatares especiais', pipa: '🪁 Pipas', back: '🂠 Baralhos', felt: '🟩 Mesas' };
