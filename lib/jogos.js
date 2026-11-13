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
  roleta: { nome: 'Roleta', sub: 'Europeia · um zero só · +18', em: '🎰', href: '/jogos/roleta', g: 'linear-gradient(160deg,#f472b6,#be185d 55%,#6b0a35)', novo: true, loja: ['avatar'],
    opcoes: [
      { t: 'Jogar roleta', sub: 'Até 500 fichas por rodada', em: '🎡', href: '/roleta', g: 'linear-gradient(180deg,#34d399,#047857 60%,#064e3b)' }] },
  foguete: { nome: 'Foguetinho', sub: 'Saque antes de explodir · +18', em: '🚀', href: '/jogos/foguete', g: 'linear-gradient(160deg,#fb923c,#7c3aed 60%,#1e1b4b)', novo: true, loja: ['avatar'],
    opcoes: [
      { t: 'Jogar ao vivo', sub: 'Todo mundo na mesma rodada', em: '🚀', href: '/foguete', g: 'linear-gradient(180deg,#fb923c,#c2410c 60%,#7c2d12)' }] },
  onca: { nome: 'Onça da Sorte', sub: 'Caça-níquel 3x3 · +18', em: '🐆', href: '/onca', g: 'linear-gradient(160deg,#facc15,#16a34a 60%,#052e16)', novo: true, loja: ['avatar'],
    opcoes: [
      { t: 'Jogar', sub: '5 linhas · tela cheia x10', em: '🎰', href: '/onca', g: 'linear-gradient(180deg,#facc15,#ca8a04 60%,#713f12)' }] },
};
export const ORDEM = ['cacheta', 'truco', 'sinuca', 'gude', 'pipa', 'roleta', 'foguete', 'onca'];
export const LOJA_TITULO = { avatar: '✨ Avatares especiais', pipa: '🪁 Pipas', back: '🂠 Baralhos', felt: '🟩 Mesas' };
