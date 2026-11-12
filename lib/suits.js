// Naipes desenhados em vetor (SVG): saem nítidos em qualquer celular, sem depender da fonte do aparelho.
// Ordem igual a Engine.SUITS: 0 ♠, 1 ♥, 2 ♦, 3 ♣. A cor vem do texto (currentColor).
const P = [
  '<path d="M50 3C41 21 5 37 5 62c0 16 13 25 26 23 8-1 13-5 16-10-1 10-5 17-14 22h34c-9-5-13-12-14-22 3 5 8 9 16 10 13 2 26-7 26-23C95 37 59 21 50 3z"/>',
  '<path d="M50 93C43 85 5 61 5 32 5 16 17 5 31 5c9 0 16 6 19 14 3-8 10-14 19-14 14 0 26 11 26 27 0 29-38 53-45 61z"/>',
  '<path d="M50 2 89 50 50 98 11 50z"/>',
  '<circle cx="50" cy="27" r="21"/><circle cx="25" cy="58" r="21"/><circle cx="75" cy="58" r="21"/><circle cx="50" cy="50" r="12"/><path d="M45 55c0 21-4 32-13 42h36c-9-10-13-21-13-42z"/>',
];
export const suitSvg = s => `<svg class="su" viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">${P[s]}</svg>`;
