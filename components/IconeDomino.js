// Desenho de uma pedra de dominó (6|3) pra usar como ícone nos cartões (o emoji de dominó não aparece em todo celular).
export default function IconeDomino({ size = 60 }) {
  const dot = (cx, cy) => <circle key={cx + '-' + cy} cx={cx} cy={cy} r="4.2" fill="#1c1917" />;
  return (
    <svg width={size * .55} height={size} viewBox="0 0 44 80" style={{ filter: 'drop-shadow(0 5px 5px #0008)', transform: 'rotate(-12deg)' }}>
      <rect x="1" y="1" width="42" height="78" rx="7" fill="#fffdf6" stroke="#b9ad8f" strokeWidth="2" />
      <line x1="7" y1="40" x2="37" y2="40" stroke="#9b8f74" strokeWidth="2" />
      {[[12, 10], [32, 10], [12, 20], [32, 20], [12, 30], [32, 30]].map(([x, y]) => dot(x, y))}
      {[[12, 50], [22, 60], [32, 70]].map(([x, y]) => dot(x, y))}
    </svg>
  );
}
