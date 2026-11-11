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
// recarga de fichas virtuais: R$ 1 = 10 fichas (mínimo R$ 10, máximo R$ 1.000 por compra)
export const FICHAS_POR_REAL = 10, RECARGA_MIN = 10, RECARGA_MAX = 1000;
export const PACKS = [10, 20, 50, 100].map(brl => ({ id: 'pack-' + brl, brl, coins: brl * FICHAS_POR_REAL }));
// pacote escolhido ou valor livre ('custom'); devolve null se inválido
export function packFor(id, valor) {
  if (id === 'custom') {
    const brl = Math.round(Number(String(valor).replace(',', '.')) * 100) / 100;
    if (!(brl >= RECARGA_MIN && brl <= RECARGA_MAX)) return null;
    return { id: 'custom', brl, coins: Math.floor(brl * FICHAS_POR_REAL) };
  }
  return PACKS.find(p => p.id === id) || null;
}
export const VIP_PERKS = ['Bônus diário em dobro', 'Criar e entrar em salas VIP 👑', 'Feltro "noite" exclusivo', 'Coroa 👑 no seu perfil'];
export const itemById = id => ITEMS.find(i => i.id === id);
export function looks(profile) {
  const eq = (profile && profile.equipped) || {};
  const back = itemById(eq.back) || ITEMS[0], felt = itemById(eq.felt) || ITEMS[4];
  return { back, felt };
}
