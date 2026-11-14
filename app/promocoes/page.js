'use client';
// PROMOÇÕES (aba da barra de baixo): ranking da cacheta do mês e indicação de amigos.
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import Indique from '../../components/Indique.js';
import { api, pedirConta } from '../../lib/supabase-browser.js';
import { META_INDICACAO, BONUS_META, DEPOSITO_MIN } from '../../lib/indicacao-regras.js';
import { fmt } from '../../lib/modes.js';

function Body({ profile }) {
  const [promo, setPromo] = useState(null), [ind, setInd] = useState(false);
  useEffect(() => { api('/api/promo', { op: 'status' }).then(setPromo).catch(() => {}); }, [profile]);
  return <div className="pr">
    <a className="pr-card" style={{ '--g': 'linear-gradient(135deg,#f59e0b,#b45309 55%,#451a03)' }} href="/ranking?jogo=cacheta">
      <span className="pr-em">🏆</span>
      <div><b>{fmt(promo?.meta || 1000)} pontos na cacheta = {promo?.premio || 30} fichas</b>
        <small>O primeiro a fazer {fmt(promo?.meta || 1000)} pontos no mês nas mesas online (entrada de 5 fichas ou mais) ganha na hora.</small>
        {promo?.ganhador ? <em>🎉 Ganhador do mês: {promo.ganhador.avatar} {promo.ganhador.nick}</em>
          : promo?.meusPontos != null ? <em>Você: {fmt(promo.meusPontos)} / {fmt(promo.meta)} pts</em> : null}
        <u>Ver ranking ›</u></div>
    </a>
    <button className="pr-card" style={{ '--g': 'linear-gradient(135deg,#22c55e,#15803d 55%,#052e16)' }} onClick={() => profile ? setInd(true) : pedirConta()}>
      <span className="pr-em">🤝</span>
      <div><b>{META_INDICACAO} amigos = {BONUS_META} fichas</b>
        <small>Mande seu link. Quando {META_INDICACAO} amigos criarem a conta e depositarem R$ {DEPOSITO_MIN} ou mais, você ganha {BONUS_META} fichas.</small>
        <u>Pegar meu link ›</u></div>
    </button>
    {ind && profile && <Indique profile={profile} onClose={() => setInd(false)} />}
    <style>{`
.pr{display:flex;flex-direction:column;gap:12px}
.pr-card{display:flex;gap:12px;align-items:flex-start;text-align:left;text-decoration:none;color:#fff;background:var(--g);border:2px solid #ffffff55;border-radius:20px;padding:14px;box-shadow:0 6px 16px #0008;font:inherit;cursor:pointer;width:100%}
.pr-em{font-size:40px;line-height:1;filter:drop-shadow(0 3px 4px #0008)}
.pr-card b{display:block;font:700 19px Oswald;font-style:italic;text-shadow:0 2px 0 #0006}
.pr-card small{display:block;font:400 13px Rubik;opacity:.92;margin-top:4px;line-height:1.35}
.pr-card em{display:inline-block;font-style:normal;font:600 13px Rubik;background:#0006;border-radius:10px;padding:3px 9px;margin-top:8px}
.pr-card u{display:block;text-decoration:none;font:600 14px Oswald;margin-top:8px;color:#fde68a}
`}</style>
  </div>;
}
export default function Promocoes() { return <Shell title="🎁 Promoções">{auth => <Body {...auth} />}</Shell>; }
