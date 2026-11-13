// Catálogo da loja (fichas virtuais). Usado no navegador e no servidor.
export const ITEMS = [
  { id: 'back-azul',     slot: 'back', name: 'Verso azul',             price: 0,    colors: ['#1f4fbf', '#0d2a78'] },
  { id: 'back-vermelho', slot: 'back', name: 'Verso vermelho clássico', price: 5,   colors: ['#b51b31', '#6d0d1b'] },
  { id: 'back-roxo',     slot: 'back', name: 'Verso roxo neon',        price: 10,  colors: ['#8b2be2', '#3b0a75'] },
  { id: 'back-ouro',     slot: 'back', name: 'Verso preto e ouro',     price: 20,  colors: ['#2b2b2b', '#000000'], gold: true },
  { id: 'back-esmeralda', slot: 'back', name: 'Verso esmeralda',        price: 12,  colors: ['#10b981', '#065f46'] },
  { id: 'back-dourado',  slot: 'back', name: 'Baralho dourado',        price: 25,  colors: ['#f7d774', '#a8740f'], gold: true },
  { id: 'back-diamante', slot: 'back', name: 'Baralho diamante',       price: 40,  colors: ['#a5f3fc', '#0e7490'], gold: true },
  { id: 'felt-verde',    slot: 'felt', name: 'Feltro verde',           price: 0,    colors: ['#16c271', '#0aa35a', '#077a41'] },
  { id: 'felt-azul',     slot: 'felt', name: 'Feltro azul',            price: 8,   colors: ['#2f8bff', '#1662d6', '#0b3f96'] },
  { id: 'felt-vinho',    slot: 'felt', name: 'Feltro vinho',           price: 12,  colors: ['#c2374f', '#93203a', '#5e1023'] },
  { id: 'felt-roxo',     slot: 'felt', name: 'Feltro roxo',            price: 10,  colors: ['#9d4edd', '#7b2cbf', '#3c096c'] },
  { id: 'felt-ouro',     slot: 'felt', name: 'Mesa preta e ouro',      price: 30,  colors: ['#4a4030', '#2a2418', '#120f09'] },
  { id: 'felt-noite',    slot: 'felt', name: 'Feltro noite (VIP)',     price: 0,    colors: ['#3b4a63', '#253247', '#141c29'], vipOnly: true },
  // avatares especiais (aparecem na mesa no lugar do emoji comum)
  { id: 'av-fogo',       slot: 'avatar', name: 'Fogo',     price: 10, em: '🔥' },
  { id: 'av-dragao',     slot: 'avatar', name: 'Dragão',   price: 15, em: '🐉' },
  { id: 'av-unicornio',  slot: 'avatar', name: 'Unicórnio', price: 15, em: '🦄' },
  { id: 'av-tubarao',    slot: 'avatar', name: 'Tubarão',  price: 15, em: '🦈' },
  { id: 'av-rei',        slot: 'avatar', name: 'Rei',      price: 20, em: '🤴' },
  { id: 'av-rainha',     slot: 'avatar', name: 'Rainha',   price: 20, em: '👸' },
  { id: 'av-estrela',    slot: 'avatar', name: 'Estrela (boas-vindas)', price: 0, em: '🌟', exclusive: true },
  { id: 'av-diamante',   slot: 'avatar', name: 'Diamante', price: 30, em: '💎' },
  // troféus: resgate de fichas por enfeite de coleção (não volta a ser ficha e não vale dinheiro)
  // de 25 em 25 fichas, de 25 até 500 (os 5 primeiros ids antigos foram mantidos para não perder a coleção de ninguém)
  ...[
    [25, 'tr-25', 'Troféu Iniciante', '🎖️'], [50, 'tr-bronze', 'Troféu Bronze', '🥉'], [75, 'tr-75', 'Troféu Honra', '🏅'],
    [100, 'tr-prata', 'Troféu Prata', '🥈'], [125, 'tr-125', 'Troféu Mérito', '🎗️'], [150, 'tr-ouro', 'Troféu Ouro', '🥇'],
    [175, 'tr-175', 'Troféu Taça', '🏆'], [200, 'tr-diamante', 'Troféu Diamante', '💎'], [225, 'tr-225', 'Troféu Rubi', '💍'],
    [250, 'tr-lenda', 'Troféu Lenda', '👑'], [275, 'tr-275', 'Troféu Estrela', '⭐'], [300, 'tr-300', 'Troféu Superestrela', '🌟'],
    [325, 'tr-325', 'Troféu Fogo', '🔥'], [350, 'tr-350', 'Troféu Raio', '⚡'], [375, 'tr-375', 'Troféu Foguete', '🚀'],
    [400, 'tr-400', 'Troféu Leão', '🦁'], [425, 'tr-425', 'Troféu Águia', '🦅'], [450, 'tr-450', 'Troféu Dragão', '🐉'],
    [475, 'tr-475', 'Troféu Galáxia', '🌌'], [500, 'tr-500', 'Troféu Campeão', '🏵️'],
  ].map(([price, id, name, em]) => ({ id, slot: 'trofeu', name, price, em })),
  // troféu de ouro com valor livre: o cliente digita quantas fichas quer trocar (preço 0 aqui: só sai pelo resgate livre)
  { id: 'tr-livre', slot: 'trofeu', name: 'Troféu de Ouro', price: 0, em: '🏆' },
  // pipas (jogo da pipa): a clássica é grátis; as outras são compradas com fichas e aparecem no céu
  ...[
    ['pipa-classica', 'Pipa clássica', 0], ['pipa-ceu', 'Pipa céu azul', 3], ['pipa-listrada', 'Pipa listrada', 5],
    ['pipa-xadrez', 'Pipa xadrez', 8], ['pipa-alvo', 'Pipa alvo', 8], ['pipa-estrela', 'Pipa estrela', 10],
    ['pipa-raio', 'Pipa raio', 12], ['pipa-fogo', 'Pipa fogo', 15], ['pipa-arco', 'Pipa arco-íris', 15],
    ['pipa-caveira', 'Pipa caveira', 20], ['pipa-coroa', 'Pipa rei do céu', 30],
    ['pipa-laranja', 'Pipa laranja', 3], ['pipa-cruz', 'Pipa cruz', 5], ['pipa-diagonal', 'Pipa diagonal', 5],
    ['pipa-roxa', 'Pipa roxa', 6], ['pipa-bolinha', 'Pipa bolinha', 8], ['pipa-verdeamarela', 'Pipa verde e amarela', 10],
    ['pipa-coracao', 'Pipa coração', 10], ['pipa-olho', 'Pipa olho', 12], ['pipa-noturna', 'Pipa noturna', 12],
    ['pipa-neon', 'Pipa neon', 15], ['pipa-sangue', 'Pipa caveira vermelha', 20], ['pipa-ouro', 'Pipa preta e ouro', 25],
  ].map(([id, name, price]) => ({ id, slot: 'pipa', name, price })),
  // sinuca: tacos — cores [ponteira, anel, corpo claro, corpo escuro, cabo]
  ...[
    ['taco-classico', 'Taco clássico', 0, ['#f1e6c8', '#1e3a8a', '#d9b26f', '#a8692e', '#3a1d0a']],
    ['taco-ebano', 'Taco ébano', 8, ['#f1e6c8', '#b45309', '#4b5563', '#1f2937', '#030712']],
    ['taco-vermelho', 'Taco vermelho', 10, ['#f1e6c8', '#fde68a', '#ef4444', '#991b1b', '#450a0a']],
    ['taco-azul', 'Taco azul', 10, ['#f1e6c8', '#e5e7eb', '#60a5fa', '#1d4ed8', '#172554']],
    ['taco-carbono', 'Taco carbono', 15, ['#e5e7eb', '#ef4444', '#374151', '#111827', '#000000']],
    ['taco-neon', 'Taco neon', 20, ['#f0fdf4', '#22d3ee', '#4ade80', '#16a34a', '#052e16']],
    ['taco-ouro', 'Taco de ouro', 25, ['#fff7ed', '#111111', '#fde68a', '#ca8a04', '#713f12']],
    ['taco-fogo', 'Taco fogo', 30, ['#fff7ed', '#facc15', '#fb923c', '#dc2626', '#450a0a']],
    ['taco-diamante', 'Taco diamante', 40, ['#ffffff', '#7c3aed', '#a5f3fc', '#0891b2', '#164e63']],
  ].map(([id, name, price, colors]) => ({ id, slot: 'taco', name, price, colors })),
  // gude: bolinhas (a sua bolinha de jogar) — cores [meio, claro, escuro]
  ...[
    ['bola-leiteira', 'Leiteira', 0, ['#f8fafc', '#cbd5e1', '#64748b'], 'leiteira'],
    ['bola-azul', 'Olho azul', 5, ['#2563eb', '#93c5fd', '#0b2a6b'], 'olho'],
    ['bola-vermelha', 'Olho vermelho', 5, ['#dc2626', '#fca5a5', '#7f1d1d'], 'olho'],
    ['bola-verde', 'Olho verde', 8, ['#16a34a', '#86efac', '#14532d'], 'olho'],
    ['bola-rosa', 'Olho rosa', 10, ['#db2777', '#f9a8d4', '#831843'], 'olho'],
    ['bola-roxa', 'Olho roxo', 10, ['#7c3aed', '#c4b5fd', '#3b0764'], 'olho'],
    ['bola-olhopreto', 'Olho preto', 15, ['#1f2937', '#f59e0b', '#030712'], 'olhopreto'],
    ['bola-ouro', 'Bolinha de ouro', 20, ['#ca8a04', '#fde68a', '#713f12'], 'olho'],
    ['bola-diamante', 'Bolinha diamante', 30, ['#0891b2', '#a5f3fc', '#164e63'], 'olho'],
  ].map(([id, name, price, colors, tipo]) => ({ id, slot: 'bola', name, price, colors, tipo })),
  { id: 'vip-30',        slot: 'vip',  name: 'VIP 30 dias',            price: 30 },
];
// pacotes de fichas virtuais pagos por Pix/cartão (Mercado Pago) — ver lib/payments.js
// recarga de fichas virtuais: R$ 1 = 1 ficha (mínimo R$ 10, máximo R$ 1.000 por compra)
export const FICHAS_POR_REAL = 1, RECARGA_MIN = 10, RECARGA_MAX = 1000;
// pacotes prontos: mesmo valor do Pix, sem bônus
const BONUS = { 10: 0, 20: 0, 50: 0, 100: 0 };   // % de fichas a mais
export const PACKS = [10, 20, 50, 100].map(brl => {
  const base = brl * FICHAS_POR_REAL, bonus = Math.floor(base * BONUS[brl] / 100);
  return { id: 'pack-' + brl, brl, base, bonus, pct: BONUS[brl], coins: base + bonus };
});
// pacote de boas-vindas: só na primeira compra, com avatar exclusivo
export const WELCOME = { id: 'pack-boasvindas', brl: 10, coins: 15, avatarItem: 'av-estrela' };
// pacote escolhido ou valor livre ('custom'); devolve null se inválido
export function packFor(id, valor) {
  if (id === WELCOME.id) return { ...WELCOME };
  if (id === 'custom') {
    const brl = Math.round(Number(String(valor).replace(',', '.')) * 100) / 100;
    if (!(brl >= RECARGA_MIN && brl <= RECARGA_MAX)) return null;
    return { id: 'custom', brl, coins: Math.floor(brl * FICHAS_POR_REAL) };
  }
  return PACKS.find(p => p.id === id) || null;
}
export const VIP_PERKS = ['Criar e entrar em salas VIP 👑', 'Feltro "noite" exclusivo', 'Coroa 👑 no seu perfil'];
export const itemById = id => ITEMS.find(i => i.id === id);
export function looks(profile) {
  const eq = (profile && profile.equipped) || {};
  const back = itemById(eq.back) || itemById('back-azul'), felt = itemById(eq.felt) || itemById('felt-verde');
  return { back, felt };
}
