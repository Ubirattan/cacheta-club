// Taxa da casa nas salas online de gude (e da pipa, quando tiver online). Vale no navegador e no servidor.
//  • entrada até 10 fichas: o ganhador leva a entrada dele + metade da do outro; o resto fica pra casa
//    (ex.: 2 de cada → leva 3, casa 1; 10 de cada → leva 15, casa 5)
//  • entrada acima de 10: a casa fica com 10% do pote (ex.: 20 de cada → pote 40, casa 4, ganhador 36)
//  • entrada acima de 100: a casa fica com 20% do pote (ex.: 200 de cada → pote 400, casa 80, ganhador 320)
export function taxaPct(entry) { return entry > 100 ? 20 : entry > 10 ? 10 : 0; }
export function premioOnline(entry, jogadores = 2) {
  const pot = entry * jogadores, pct = taxaPct(entry);
  if (pct) return pot - Math.ceil(pot * pct / 100);
  return Math.min(pot, entry + Math.floor(entry / 2));
}
