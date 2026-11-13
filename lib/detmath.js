// Matemática determinística: só +, -, *, / (iguais em qualquer celular e navegador).
// O Math.sin/cos/atan2 de cada navegador pode errar diferente na última casa; no jogo online
// (pipa) os dois celulares precisam chegar no MESMO resultado, então a física usa estas.
const PI = Math.PI, TAU = PI * 2, HALF = PI / 2;
function red(x) {   // leva pra -PI..PI
  if (x > PI || x < -PI) { x = x - TAU * Math.floor((x + PI) / TAU); }
  return x;
}
// seno por série de Taylor depois de reduzir pra -PI/2..PI/2 (erro < 1e-9)
export function dsin(x) {
  x = red(x);
  if (x > HALF) x = PI - x; else if (x < -HALF) x = -PI - x;
  const x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156 * (1 - x2 / 210)))))));
}
export const dcos = x => dsin(x + HALF);
// arco tangente por série (com redução), depois atan2
function datan(x) {
  let inv = false, neg = false;
  if (x < 0) { x = -x; neg = true; }
  if (x > 1) { x = 1 / x; inv = true; }
  // reduz mais: atan(x) = 2*atan(x / (1 + sqrt(1 + x²)))
  const y = x / (1 + Math.sqrt(1 + x * x)), z = y / (1 + Math.sqrt(1 + y * y)), z2 = z * z;
  let s = 0, p = z;
  for (let k = 0; k < 14; k++) { s += (k % 2 ? -p : p) / (2 * k + 1); p *= z2; }
  let r = 4 * s;
  if (inv) r = HALF - r;
  return neg ? -r : r;
}
export function datan2(y, x) {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + PI : datan(y / x) - PI;
  return y > 0 ? HALF : y < 0 ? -HALF : 0;
}
// sorteio com semente (mulberry32): mesma semente = mesma sequência nos dois celulares
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
