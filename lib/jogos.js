// Os jogos da Casa de Jogos: cartão da tela inicial, opções dentro de cada jogo e o que a loja dele vende.
export const JOGOS = {
  cacheta: { nome: 'Cacheta', sub: 'Online, torneio e contra o computador', em: '🃏', href: '/cacheta', g: 'linear-gradient(160deg,#38b6ff,#1565d8 55%,#0a3fa8)', loja: ['back', 'felt'] },
  truco: { nome: 'Truco', sub: 'Paulista · 1x1 e duplas', em: '♣️', href: '/jogos/truco', g: 'linear-gradient(160deg,#f87171,#c81e3a 55%,#7f0d22)', loja: ['back', 'felt'],
    opcoes: [
      { t: 'Truco online', sub: '1x1 ou duplas valendo fichas', em: '🌐', href: '/lobby?jogo=truco', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/truco', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  sinuca: { nome: 'Sinuca', sub: 'Bola 8, bola lisa e bolinho', em: '🎱', href: '/jogos/sinuca', g: 'linear-gradient(160deg,#4ade80,#15803d 55%,#0b4d25)', novo: true, loja: ['taco'],
    opcoes: [
      { t: 'Sinuca online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=sinuca', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/sinuca', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  gude: { nome: 'Bolinha de gude', sub: 'Triângulo, buraco e mata-mata', em: null, href: '/jogos/gude', g: 'linear-gradient(160deg,#a78bfa,#6d28d9 55%,#3b0f80)', loja: ['bola'],
    opcoes: [
      { t: 'Gude online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=gude', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/gude', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  pipa: { nome: 'Pipa', sub: 'Corta, apara e manda busca', em: '🪁', href: '/jogos/pipa', g: 'linear-gradient(160deg,#fbbf24,#ea7a0a 55%,#9a3412)', loja: ['pipa'],
    opcoes: [
      { t: 'Pipa online', sub: '1 contra 1 valendo fichas', em: '🌐', href: '/lobby?jogo=pipa', g: 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' },
      { t: 'Contra o computador', em: '🤖', href: '/pipa', g: 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }] },
  roleta: { nome: 'Roleta', sub: 'Europeia · um zero só · +18', em: '🎰', href: '/jogos/roleta', g: 'linear-gradient(160deg,#f472b6,#be185d 55%,#6b0a35)', novo: true, semLoja: true,
    opcoes: [
      { t: 'Roleta ao vivo', sub: 'Todo mundo na mesma rodada', em: '🔴', href: '/roleta-vivo', g: 'linear-gradient(180deg,#ef4444,#991b1b 60%,#450a0a)' },
      { t: 'Roleta clássica', sub: 'Você gira quando quiser', em: '🎡', href: '/roleta', g: 'linear-gradient(180deg,#60a5fa,#1d4ed8 60%,#172554)' }] },
  foguete: { nome: 'Foguetinho', sub: 'Saque antes de explodir · +18', em: '🚀', href: '/jogos/foguete', g: 'linear-gradient(160deg,#fb923c,#7c3aed 60%,#1e1b4b)', novo: true, semLoja: true,
    opcoes: [
      { t: 'Jogar ao vivo', sub: 'Todo mundo na mesma rodada', em: '🚀', href: '/foguete', g: 'linear-gradient(180deg,#fb923c,#c2410c 60%,#7c2d12)' }] },
  onca: { nome: 'Onça da Sorte', sub: 'Caça-níquel 3x3 · +18', em: '🐆', href: '/onca', g: 'linear-gradient(160deg,#facc15,#16a34a 60%,#052e16)', novo: true, semLoja: true,
    opcoes: [
      { t: 'Jogar', sub: '5 linhas · tela cheia x10', em: '🎰', href: '/onca', g: 'linear-gradient(180deg,#facc15,#ca8a04 60%,#713f12)' }] },
  futebol: { nome: 'Futebol', sub: 'Pagamento antecipado · Criar aposta · Cash out', em: '⚽', href: '/futebol', g: 'linear-gradient(160deg,#4ade80,#16a34a 50%,#052e16)', novo: true, semLoja: true, opcoes: [] },
  cassino: { nome: 'Cassino', sub: 'Mines, Double, Onça, roletas, Foguetinho e Jogo do Bicho · +18', em: '🎰', href: '/jogos/cassino', g: 'linear-gradient(160deg,#facc15,#dc2626 55%,#4c0519)', novo: true, semLoja: true,
    opcoes: [
      { t: 'Onça da Sorte', sub: 'Caça-níquel · tela cheia x10', em: '🐆', arte: 'onca', href: '/onca', g: 'linear-gradient(180deg,#facc15,#dc2626 60%,#7f1d1d)' },
      { t: 'Roleta ao vivo', sub: 'Todo mundo na mesma rodada', em: '🎡', arte: 'roleta', href: '/roleta-vivo', g: 'linear-gradient(180deg,#ef4444,#991b1b 60%,#450a0a)', novo: true },
      { t: 'Roleta clássica', sub: 'Você gira quando quiser', em: '🎡', arte: 'roleta', href: '/roleta', g: 'linear-gradient(180deg,#60a5fa,#1d4ed8 60%,#172554)' },
      { t: 'Foguetinho', sub: 'Saque antes de explodir', em: '🚀', arte: 'foguete', href: '/foguete', g: 'linear-gradient(180deg,#fb923c,#7c3aed 60%,#1e1b4b)' },
      { t: 'Mines', sub: 'Ache os diamantes, fuja das bombas', em: '💣', arte: 'mines', href: '/mines', g: 'linear-gradient(180deg,#38bdf8,#1d4ed8 60%,#172554)' },
      { t: 'Double', sub: 'Vermelho, preto ou branco 14x', em: '🔴', arte: 'double', href: '/double', g: 'linear-gradient(180deg,#f43f5e,#9f1239 60%,#3b0718)' },
      { t: 'Jogo do Bicho', sub: 'Sorteios às 11h, 14h, 16h, 18h e 21h', em: '🐾', href: '/bicho', g: 'linear-gradient(180deg,#22c55e,#15803d 60%,#052e16)', novo: true }] },
};
export const ORDEM = ['cacheta', 'truco', 'sinuca', 'gude', 'pipa', 'futebol', 'cassino'];
export const LOJA_TITULO = { avatar: '✨ Avatares especiais', pipa: '🪁 Pipas', back: '🂠 Baralhos', felt: '🟩 Mesas', taco: '🎱 Tacos', bola: '🔵 Bolinhas' };
