// Desenhos grandes dos cartões do Cassino: a roleta do jogo, a onça mascote, o foguete, o Mines e o Double.
import { RODA, cor } from '../lib/roleta.js';
import { OncaDefs, Rosto } from './OncaIcones.js';

const COR = { vermelho: '#c81e1e', preto: '#15171c', verde: '#0f8a43' };

export function RoletaArte() {
  const n = RODA.length, R = 46, r0 = 30, seg = Math.PI * 2 / n;
  const p = (a, r) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs><radialGradient id="ca-ouro" cx="40%" cy="35%"><stop offset="0" stopColor="#fff3b0" /><stop offset=".6" stopColor="#d4a017" /><stop offset="1" stopColor="#7a5208" /></radialGradient>
        <radialGradient id="ca-mad" cx="45%" cy="40%"><stop offset="0" stopColor="#a0522d" /><stop offset="1" stopColor="#4a230f" /></radialGradient></defs>
      <circle cx="50" cy="51.5" r="49" fill="#0006" />
      <circle cx="50" cy="50" r="49" fill="url(#ca-mad)" stroke="#d4a017" strokeWidth="1.5" />
      {RODA.map((num, i) => {
        const a0 = i * seg - Math.PI / 2 - seg / 2, a1 = a0 + seg;
        const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r0), [x3, y3] = p(a0, r0);
        const [tx, ty] = p(a0 + seg / 2, R - 4.2);
        return <g key={num}>
          <path d={`M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`} fill={COR[cor(num)]} stroke="#d4a017" strokeWidth=".35" />
          <text x={tx} y={ty} fontSize="3.4" fontFamily="Oswald,sans-serif" fontWeight="700" fill="#fff" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(a0 + seg / 2) * 180 / Math.PI + 90} ${tx} ${ty})`}>{num}</text>
        </g>;
      })}
      <circle cx="50" cy="50" r={r0} fill="url(#ca-mad)" stroke="#d4a017" strokeWidth="1" />
      {[0, 1, 2, 3].map(k => <path key={k} d="M50 50 L50 24" stroke="url(#ca-ouro)" strokeWidth="3" strokeLinecap="round" transform={`rotate(${k * 90 + 45} 50 50)`} />)}
      <circle cx="50" cy="50" r="9" fill="url(#ca-ouro)" stroke="#7a5208" strokeWidth=".8" />
      <circle cx="50" cy="50" r="3" fill="#fff8" />
      <circle cx="64" cy="13" r="2.6" fill="#fff" stroke="#bbb" strokeWidth=".4" />
    </svg>
  );
}

export function OncaArte() {
  return <><OncaDefs /><svg viewBox="0 0 100 100" width="100%" height="100%"><Rosto grande /></svg></>;
}

export function FogueteArte() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <g transform="rotate(40 50 50)">
        <path d="M44 74 Q50 100 56 74 Z" fill="#facc15" /><path d="M46 74 Q50 92 54 74 Z" fill="#f97316" />
        <path d="M50 6 C66 20 66 52 60 74 L40 74 C34 52 34 20 50 6 Z" fill="#e5e7eb" stroke="#475569" strokeWidth="1.5" />
        <path d="M50 6 C58 13 61 22 62 28 L38 28 C39 22 42 13 50 6 Z" fill="#ef4444" />
        <path d="M40 56 L28 74 L40 70 Z M60 56 L72 74 L60 70 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <circle cx="50" cy="42" r="7" fill="#38bdf8" stroke="#475569" strokeWidth="2" /><circle cx="48" cy="40" r="2" fill="#fff" />
      </g>
    </svg>
  );
}
export function MinesArte() {
  const B = [6, 12, 18];     // casas com bomba no desenho
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <defs><linearGradient id="ca-gema" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a5f3fc" /><stop offset="1" stopColor="#0891b2" /></linearGradient></defs>
      <rect x="4" y="4" width="92" height="92" rx="12" fill="#0b1224" stroke="#38bdf8" strokeWidth="2" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 10 + (i % 4) * 21, y = 10 + Math.floor(i / 4) * 21, aberta = [0, 3, 5, 9, 10, 15].includes(i), bomba = B.includes(i) && i === 6;
        return <g key={i}>
          <rect x={x} y={y} width="17" height="17" rx="3.5" fill={bomba ? '#b91c1c' : aberta ? '#0e7490' : '#334155'} />
          {aberta && <path d={`M${x + 5} ${y + 4}h7l3.5 4-7 7-7-7z`} fill="url(#ca-gema)" stroke="#ecfeff" strokeWidth=".6" />}
          {bomba && <g><circle cx={x + 8.5} cy={y + 9.5} r="4.6" fill="#111" /><path d={`M${x + 11} ${y + 6} l2.5 -2.5`} stroke="#facc15" strokeWidth="1.4" /><circle cx={x + 7} cy={y + 8} r="1.2" fill="#fff8" /></g>}
        </g>;
      })}
    </svg>
  );
}
export function DoubleArte() {
  const T = ['v', 'p', 'v', 'b', 'p', 'v', 'p'];
  const cor = { v: '#e11d48', p: '#1e293b', b: '#f8fafc' };
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <rect x="2" y="26" width="96" height="48" rx="10" fill="#0b0710" stroke="#f43f5e" strokeWidth="2" />
      {T.map((c, i) => <g key={i}><rect x={5 + i * 13.3} y="34" width="11.5" height="32" rx="3" fill={cor[c]} stroke="#0008" strokeWidth=".8" />
        {c === 'b' && <path d={`M${10.75 + i * 13.3} 44 l4 6 -4 6 -4 -6z`} fill="#e11d48" />}</g>)}
      <rect x="49" y="22" width="2.4" height="56" fill="#facc15" />
      <path d="M45 20 h10 l-5 7z" fill="#facc15" />
    </svg>
  );
}
export const ARTES = { onca: OncaArte, roleta: RoletaArte, foguete: FogueteArte, mines: MinesArte, double: DoubleArte };
