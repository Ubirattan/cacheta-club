// Chamadas à API-Football (v3.football.api-sports.io). Só roda no servidor: a chave nunca vai pro celular.
// Variável no Netlify: APIFOOTBALL_KEY (a chave do painel dashboard.api-football.com).
const BASE = 'https://v3.football.api-sports.io';

export const temChave = () => !!process.env.APIFOOTBALL_KEY;

export async function chamarApi(caminho, params = {}) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) throw new Error('Falta a chave APIFOOTBALL_KEY no Netlify');
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await fetch(`${BASE}/${caminho}?${q}`, { headers: { 'x-apisports-key': key }, signal: ctl.signal, cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    const erros = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
    if (erros && erros.length) throw new Error('API de futebol: ' + erros.join(' · '));
    if (!res.ok) throw new Error('API de futebol respondeu ' + res.status);
    return j.response || [];
  } finally { clearTimeout(t); }
}
