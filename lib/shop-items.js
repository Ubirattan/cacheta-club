// Catálogo da loja (fichas virtuais). Usado no navegador e no servidor.
export const ITEMS = [
  { id: 'back-azul',     slot: 'back', name: 'Verso azul',             price: 0,    colors: ['#1f4fbf', '#0d2a78'] },
  { id: 'back-vermelho', slot: 'back', name: 'Verso vermelho clássico', price: 500,  colors: ['#b51b31', '#6d0d1b'] },
  { id: 'back-roxo',     slot: 'back', name: 'Verso roxo neon',        price: 1000, colors: ['#8b2be2', '#3b0a75'] },
  { id: 'back-ouro',     slot: 'back', name: 'Verso preto e ouro',     price: 2500, colors: ['#2b2b2b', '#000000'], gold: true },
  { id: 'felt-verde',    slot: 'felt', name: 'Feltro verde',           price: 0,    colors: ['#16c271', '#0aa35a', '#077a41'] },
  { id: 'felt-azul',     slot: 'felt', name: 'Feltro azul',            price: 800,  colors: ['#2f8bff', '#1662d6', '#0b3f96'] },
  { id: 'felt-vinho',    slot: 'felt', name: 'Feltro vinho',           price: 1200, colors: ['#c2374f', '#93203a', '#5e1023'] },
  { id: 'felt-noite',    slot: 'felt', name: 'Feltro noite (VIP)',     price: 0,    colors: ['#3b4a63', '#253247', '#141c29'], vipOnly: true },
  { id: 'vip-30',        slot: 'vip',  name: 'VIP 30 dias',            price: 5000 },
];
// pacotes de fichas virtuais pagos por Pix/cartão (Mercado Pago) — ver lib/payments.js
export const PACKS = [
  { id: 'pack-p', coins: 10000, brl: 10 },
  { id: 'pack-m', coins: 30000, brl: 25 },
  { id: 'pack-g', coins: 70000, brl: 50 },
];
export const VIP_PERKS = ['Bônus diário em dobro', 'Criar e entrar em salas VIP 👑', 'Feltro "noite" exclusivo', 'Coroa 👑 no seu perfil'];
export const itemById = id => ITEMS.find(i => i.id === id);
export function looks(profile) {
  const eq = (profile && profile.equipped) || {};
  const back = itemById(eq.back) || ITEMS[0], felt = itemById(eq.felt) || ITEMS[4];
  return { back, felt };
}
