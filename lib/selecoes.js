// Seleções: nome da API (inglês) → nome em português + bandeira (flagcdn.com).
// Times de clube não entram aqui: continuam com o nome e o escudo da API.
const S = {
  // Europa
  'Albania': ['Albânia', 'al'], 'Andorra': ['Andorra', 'ad'], 'Armenia': ['Armênia', 'am'], 'Austria': ['Áustria', 'at'],
  'Azerbaijan': ['Azerbaijão', 'az'], 'Belarus': ['Belarus', 'by'], 'Belgium': ['Bélgica', 'be'],
  'Bosnia & Herzegovina': ['Bósnia', 'ba'], 'Bosnia and Herzegovina': ['Bósnia', 'ba'], 'Bulgaria': ['Bulgária', 'bg'],
  'Croatia': ['Croácia', 'hr'], 'Cyprus': ['Chipre', 'cy'], 'Czech Republic': ['República Tcheca', 'cz'], 'Czechia': ['República Tcheca', 'cz'],
  'Denmark': ['Dinamarca', 'dk'], 'England': ['Inglaterra', 'gb-eng'], 'Estonia': ['Estônia', 'ee'], 'Faroe Islands': ['Ilhas Faroé', 'fo'],
  'Finland': ['Finlândia', 'fi'], 'France': ['França', 'fr'], 'Georgia': ['Geórgia', 'ge'], 'Germany': ['Alemanha', 'de'],
  'Gibraltar': ['Gibraltar', 'gi'], 'Greece': ['Grécia', 'gr'], 'Hungary': ['Hungria', 'hu'], 'Iceland': ['Islândia', 'is'],
  'Ireland': ['Irlanda', 'ie'], 'Republic of Ireland': ['Irlanda', 'ie'], 'Israel': ['Israel', 'il'], 'Italy': ['Itália', 'it'],
  'Kazakhstan': ['Cazaquistão', 'kz'], 'Kosovo': ['Kosovo', 'xk'], 'Latvia': ['Letônia', 'lv'], 'Liechtenstein': ['Liechtenstein', 'li'],
  'Lithuania': ['Lituânia', 'lt'], 'Luxembourg': ['Luxemburgo', 'lu'], 'Malta': ['Malta', 'mt'], 'Moldova': ['Moldávia', 'md'],
  'Montenegro': ['Montenegro', 'me'], 'Netherlands': ['Holanda', 'nl'], 'North Macedonia': ['Macedônia do Norte', 'mk'],
  'FYR Macedonia': ['Macedônia do Norte', 'mk'], 'Northern Ireland': ['Irlanda do Norte', 'gb-nir'], 'Norway': ['Noruega', 'no'],
  'Poland': ['Polônia', 'pl'], 'Portugal': ['Portugal', 'pt'], 'Romania': ['Romênia', 'ro'], 'Russia': ['Rússia', 'ru'],
  'San Marino': ['San Marino', 'sm'], 'Scotland': ['Escócia', 'gb-sct'], 'Serbia': ['Sérvia', 'rs'], 'Slovakia': ['Eslováquia', 'sk'],
  'Slovenia': ['Eslovênia', 'si'], 'Spain': ['Espanha', 'es'], 'Sweden': ['Suécia', 'se'], 'Switzerland': ['Suíça', 'ch'],
  'Turkey': ['Turquia', 'tr'], 'Türkiye': ['Turquia', 'tr'], 'Ukraine': ['Ucrânia', 'ua'], 'Wales': ['País de Gales', 'gb-wls'],
  // Américas
  'Argentina': ['Argentina', 'ar'], 'Bolivia': ['Bolívia', 'bo'], 'Brazil': ['Brasil', 'br'], 'Chile': ['Chile', 'cl'],
  'Colombia': ['Colômbia', 'co'], 'Ecuador': ['Equador', 'ec'], 'Paraguay': ['Paraguai', 'py'], 'Peru': ['Peru', 'pe'],
  'Uruguay': ['Uruguai', 'uy'], 'Venezuela': ['Venezuela', 've'], 'USA': ['Estados Unidos', 'us'], 'United States': ['Estados Unidos', 'us'],
  'Mexico': ['México', 'mx'], 'Canada': ['Canadá', 'ca'], 'Costa Rica': ['Costa Rica', 'cr'], 'Panama': ['Panamá', 'pa'],
  'Honduras': ['Honduras', 'hn'], 'Jamaica': ['Jamaica', 'jm'], 'El Salvador': ['El Salvador', 'sv'], 'Guatemala': ['Guatemala', 'gt'],
  'Haiti': ['Haiti', 'ht'], 'Trinidad and Tobago': ['Trinidad e Tobago', 'tt'], 'Curacao': ['Curaçao', 'cw'], 'Curaçao': ['Curaçao', 'cw'],
  'Nicaragua': ['Nicarágua', 'ni'], 'Suriname': ['Suriname', 'sr'], 'Cuba': ['Cuba', 'cu'], 'Dominican Republic': ['República Dominicana', 'do'],
  // África
  'Algeria': ['Argélia', 'dz'], 'Angola': ['Angola', 'ao'], 'Benin': ['Benin', 'bj'], 'Burkina Faso': ['Burkina Faso', 'bf'],
  'Cameroon': ['Camarões', 'cm'], 'Cape Verde Islands': ['Cabo Verde', 'cv'], 'Cape Verde': ['Cabo Verde', 'cv'], 'Congo DR': ['RD Congo', 'cd'],
  'DR Congo': ['RD Congo', 'cd'], 'Congo': ['Congo', 'cg'], 'Egypt': ['Egito', 'eg'], 'Equatorial Guinea': ['Guiné Equatorial', 'gq'],
  'Gabon': ['Gabão', 'ga'], 'Gambia': ['Gâmbia', 'gm'], 'Ghana': ['Gana', 'gh'], 'Guinea': ['Guiné', 'gn'], 'Guinea-Bissau': ['Guiné-Bissau', 'gw'],
  'Ivory Coast': ['Costa do Marfim', 'ci'], "Cote D'Ivoire": ['Costa do Marfim', 'ci'], 'Kenya': ['Quênia', 'ke'], 'Mali': ['Mali', 'ml'],
  'Morocco': ['Marrocos', 'ma'], 'Mozambique': ['Moçambique', 'mz'], 'Nigeria': ['Nigéria', 'ng'], 'Senegal': ['Senegal', 'sn'],
  'South Africa': ['África do Sul', 'za'], 'Tunisia': ['Tunísia', 'tn'], 'Uganda': ['Uganda', 'ug'], 'Zambia': ['Zâmbia', 'zm'],
  'Zimbabwe': ['Zimbábue', 'zw'], 'Libya': ['Líbia', 'ly'], 'Sudan': ['Sudão', 'sd'], 'Tanzania': ['Tanzânia', 'tz'], 'Madagascar': ['Madagascar', 'mg'],
  'Namibia': ['Namíbia', 'na'], 'Mauritania': ['Mauritânia', 'mr'], 'Togo': ['Togo', 'tg'], 'Rwanda': ['Ruanda', 'rw'], 'Ethiopia': ['Etiópia', 'et'],
  // Ásia e Oceania
  'Australia': ['Austrália', 'au'], 'New Zealand': ['Nova Zelândia', 'nz'], 'Japan': ['Japão', 'jp'], 'South Korea': ['Coreia do Sul', 'kr'],
  'Korea Republic': ['Coreia do Sul', 'kr'], 'North Korea': ['Coreia do Norte', 'kp'], 'China': ['China', 'cn'], 'China PR': ['China', 'cn'],
  'Iran': ['Irã', 'ir'], 'Iraq': ['Iraque', 'iq'], 'Saudi Arabia': ['Arábia Saudita', 'sa'], 'Qatar': ['Catar', 'qa'],
  'United Arab Emirates': ['Emirados Árabes', 'ae'], 'Jordan': ['Jordânia', 'jo'], 'Oman': ['Omã', 'om'], 'Bahrain': ['Bahrein', 'bh'],
  'Kuwait': ['Kuwait', 'kw'], 'Syria': ['Síria', 'sy'], 'Lebanon': ['Líbano', 'lb'], 'Palestine': ['Palestina', 'ps'],
  'Uzbekistan': ['Uzbequistão', 'uz'], 'Kyrgyzstan': ['Quirguistão', 'kg'], 'Tajikistan': ['Tadjiquistão', 'tj'], 'Turkmenistan': ['Turcomenistão', 'tm'],
  'India': ['Índia', 'in'], 'Indonesia': ['Indonésia', 'id'], 'Thailand': ['Tailândia', 'th'], 'Vietnam': ['Vietnã', 'vn'],
  'Malaysia': ['Malásia', 'my'], 'Philippines': ['Filipinas', 'ph'], 'Singapore': ['Singapura', 'sg'], 'Hong Kong': ['Hong Kong', 'hk'],
  'Chinese Taipei': ['Taiwan', 'tw'], 'Bangladesh': ['Bangladesh', 'bd'], 'Myanmar': ['Mianmar', 'mm'], 'Fiji': ['Fiji', 'fj'],
};
// sufixos das seleções de base / feminina
const SUF = [[/\s+W$/, ' (F)'], [/\s+U(\d\d)$/, ' Sub-$1'], [/\s+Olympic$/i, ' Olímpico']];

export function selecao(nome) {
  if (!nome) return null;
  let base = String(nome).trim(), suf = '';
  for (const [re, rep] of SUF) { const m = re.exec(base); if (m) { suf = m[0].replace(re, rep); base = base.slice(0, m.index); break; } }
  const s = S[base];
  return s ? { nome: s[0] + suf, bandeira: `https://flagcdn.com/w80/${s[1]}.png` } : null;
}
