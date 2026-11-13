// Desenhos próprios da Onça da Sorte (SVG com brilho, estilo "3D" de caça-níquel).
// <OncaDefs/> uma vez na página; <Icone s={n}/> em cada casa (n = número do símbolo; -1 = vazio).

export function OncaDefs() {
  const rg = (id, a, b, c) => (
    <radialGradient id={id} cx="38%" cy="30%" r="75%"><stop offset="0" stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} /></radialGradient>);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {rg('oc-ouro', '#fff7c2', '#facc15', '#a16207')}
        {rg('oc-onca', '#fff1b8', '#f59e0b', '#b45309')}
        {rg('oc-saco', '#fde68a', '#c2410c', '#7c2d12')}
        {rg('oc-diam', '#e0f2fe', '#38bdf8', '#1d4ed8')}
        {rg('oc-verde', '#d9f99d', '#22c55e', '#14532d')}
        {rg('oc-roxo', '#f5d0fe', '#a855f7', '#581c87')}
        {rg('oc-lar', '#ffedd5', '#fb923c', '#c2410c')}
        {rg('oc-cer', '#fecaca', '#ef4444', '#7f1d1d')}
        <linearGradient id="oc-fita" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef4444" /><stop offset="1" stopColor="#991b1b" /></linearGradient>
        <filter id="oc-sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000" floodOpacity=".45" /></filter>
      </defs>
    </svg>
  );
}

const Brilho = ({ cx = 38, cy = 30, rx = 14, ry = 8 }) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity=".55" transform={`rotate(-25 ${cx} ${cy})`} />;

export function Rosto({ grande }) {
  return (
    <g>
      <circle cx="26" cy="24" r="11" fill="url(#oc-onca)" stroke="#78350f" strokeWidth="2" /><circle cx="26" cy="24" r="5" fill="#fca5a5" />
      <circle cx="74" cy="24" r="11" fill="url(#oc-onca)" stroke="#78350f" strokeWidth="2" /><circle cx="74" cy="24" r="5" fill="#fca5a5" />
      <ellipse cx="50" cy="52" rx="36" ry="32" fill="url(#oc-onca)" stroke="#78350f" strokeWidth="2.5" />
      {[[30, 34], [68, 33], [24, 52], [77, 54], [40, 26], [60, 25], [50, 30]].map(([x, y], i) => <g key={i} fill="#78350f"><circle cx={x} cy={y} r="3.2" /><circle cx={x + 4} cy={y + 3} r="1.6" opacity=".8" /></g>)}
      <ellipse cx="50" cy="66" rx="20" ry="14" fill="#fffbeb" />
      <ellipse cx="38" cy="48" rx="6" ry="7" fill="#fff" /><ellipse cx="62" cy="48" rx="6" ry="7" fill="#fff" />
      <circle cx="39" cy="49" r="4" fill="#1c1917" /><circle cx="61" cy="49" r="4" fill="#1c1917" />
      <circle cx="40.5" cy="47" r="1.5" fill="#fff" /><circle cx="62.5" cy="47" r="1.5" fill="#fff" />
      <path d="M44 60 L56 60 L50 66 Z" fill="#7c2d12" />
      <path d={grande ? 'M38 68 Q50 84 62 68 Z' : 'M40 69 Q50 78 60 69'} fill={grande ? '#b91c1c' : 'none'} stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" />
      <Brilho cx={36} cy={34} rx={12} ry={6} />
    </g>
  );
}

export function Icone({ s }) {
  let g;
  switch (s) {
    case 0: g = <g><g transform="translate(0 -4)"><Rosto grande /></g>
      <path d="M8 80 L92 80 L86 94 L14 94 Z" fill="url(#oc-fita)" stroke="#fde68a" strokeWidth="2" />
      <text x="50" y="91" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="700" fontSize="13" fill="#fde68a" letterSpacing="1">CORINGA</text></g>; break;
    case 1: g = <g>
      <path d="M50 26 C30 28 18 50 20 70 C22 88 78 88 80 70 C82 50 70 28 50 26 Z" fill="url(#oc-saco)" stroke="#7c2d12" strokeWidth="2.5" />
      <path d="M38 14 L62 14 L56 28 L44 28 Z" fill="url(#oc-saco)" stroke="#7c2d12" strokeWidth="2.5" />
      <rect x="40" y="25" width="20" height="6" rx="3" fill="url(#oc-ouro)" stroke="#78350f" strokeWidth="1.5" />
      <circle cx="50" cy="62" r="15" fill="url(#oc-ouro)" stroke="#78350f" strokeWidth="2" />
      <text x="50" y="69" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="700" fontSize="20" fill="#78350f">$</text>
      <Brilho cx={36} cy={44} /></g>; break;
    case 2: g = <g>
      <path d="M50 88 L12 40 L28 18 L72 18 L88 40 Z" fill="url(#oc-diam)" stroke="#1e3a8a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 40 L88 40 M28 18 L38 40 L50 88 L62 40 L72 18 M38 40 L50 18 L62 40" fill="none" stroke="#1e3a8a" strokeWidth="1.5" opacity=".7" />
      <path d="M28 18 L38 40 L12 40 Z" fill="#fff" opacity=".35" /><Brilho cx={44} cy={28} rx={10} ry={5} /></g>; break;
    case 3: g = <g>
      <circle cx="50" cy="52" r="36" fill="#a16207" /><circle cx="50" cy="48" r="36" fill="url(#oc-ouro)" stroke="#78350f" strokeWidth="2.5" />
      <circle cx="50" cy="48" r="26" fill="none" stroke="#a16207" strokeWidth="3" />
      <path d="M50 30 L55 43 L69 43 L58 52 L62 66 L50 58 L38 66 L42 52 L31 43 L45 43 Z" fill="#fef08a" stroke="#a16207" strokeWidth="2" />
      <Brilho cx={36} cy={30} /></g>; break;
    case 4: g = <g>
      <path d="M50 52 Q58 92 44 94" fill="none" stroke="#166534" strokeWidth="5" strokeLinecap="round" />
      {[0, 90, 180, 270].map(a => <path key={a} transform={`rotate(${a} 50 48)`} d="M50 48 C38 40 30 22 42 16 C48 13 50 20 50 22 C50 20 52 13 58 16 C70 22 62 40 50 48 Z" fill="url(#oc-verde)" stroke="#14532d" strokeWidth="2" />)}
      <Brilho cx={40} cy={26} rx={7} ry={4} /></g>; break;
    case 5: g = <g>
      <path d="M50 18 Q52 8 62 6" fill="none" stroke="#713f12" strokeWidth="4" strokeLinecap="round" />
      <path d="M52 16 C64 4 80 12 78 22 C68 24 58 22 52 16 Z" fill="url(#oc-verde)" stroke="#14532d" strokeWidth="1.5" />
      {[[38, 30], [62, 30], [50, 32], [32, 48], [50, 50], [68, 48], [40, 66], [60, 66], [50, 82]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="12" fill="url(#oc-roxo)" stroke="#3b0764" strokeWidth="1.5" /><circle cx={x - 4} cy={y - 4} r="3" fill="#fff" opacity=".6" /></g>)}</g>; break;
    case 6: g = <g>
      <circle cx="50" cy="56" r="34" fill="url(#oc-lar)" stroke="#9a3412" strokeWidth="2.5" />
      {[[40, 50], [58, 46], [62, 64], [44, 68], [52, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#c2410c" opacity=".6" />)}
      <path d="M50 22 Q50 14 54 10" fill="none" stroke="#713f12" strokeWidth="4" strokeLinecap="round" />
      <path d="M52 20 C60 6 80 8 82 16 C72 22 60 24 52 20 Z" fill="url(#oc-verde)" stroke="#14532d" strokeWidth="1.5" />
      <Brilho cx={38} cy={40} /></g>; break;
    case 7: g = <g>
      <path d="M32 62 Q40 30 58 12 M66 60 Q62 34 58 12" fill="none" stroke="#166534" strokeWidth="4" strokeLinecap="round" />
      <path d="M58 12 C70 4 84 10 84 18 C72 20 64 18 58 12 Z" fill="url(#oc-verde)" stroke="#14532d" strokeWidth="1.5" />
      <circle cx="32" cy="70" r="18" fill="url(#oc-cer)" stroke="#7f1d1d" strokeWidth="2" /><circle cx="68" cy="68" r="18" fill="url(#oc-cer)" stroke="#7f1d1d" strokeWidth="2" />
      <ellipse cx="25" cy="63" rx="5" ry="3" fill="#fff" opacity=".6" /><ellipse cx="61" cy="61" rx="5" ry="3" fill="#fff" opacity=".6" /></g>; break;
    default: return null;
  }
  return <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}><g filter="url(#oc-sombra)">{g}</g></svg>;
}
