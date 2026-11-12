'use client';
// Anúncio no lobby. Só aparece se o admin ligar "Anúncios" e nunca para VIP.
// Os anúncios (imagem, link e texto) são cadastrados no painel admin e se revezam a cada 8 s.
import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase-browser.js';

export default function AdSlot({ profile }) {
  const [on, setOn] = useState(false), [ads, setAds] = useState([]), [i, setI] = useState(0), [big, setBig] = useState(null);
  useEffect(() => {
    sb().from('app_settings').select('key,value').in('key', ['ads_enabled', 'ads']).then(({ data }) => {
      const m = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      setOn(m.ads_enabled === true);
      setAds((Array.isArray(m.ads) ? m.ads : []).filter(a => a && a.on !== false && (a.img || a.text)));
    });
  }, []);
  useEffect(() => { if (ads.length < 2) return; const t = setInterval(() => setI(x => (x + 1) % ads.length), 8000); return () => clearInterval(t); }, [ads.length]);
  const vip = profile && profile.vip_until && new Date(profile.vip_until) > new Date();
  if (!on || vip) return null;
  if (!ads.length) return <div className="adslot">Publicidade · seja VIP e jogue sem anúncios</div>;
  const a = ads[i % ads.length];
  const interno = l => typeof window !== 'undefined' && l.startsWith(window.location.origin);
  return <>
    {/* botãozinho flutuante no canto: não ocupa espaço no lobby; tocar abre o anúncio grande */}
    <button className="adchip" onClick={() => setBig(a)} aria-label="Ver anúncio">
      {a.img ? <img src={a.img} alt="" /> : <span>{a.text}</span>}
      <i>🔍</i>
    </button>
    {big && <div className="adbig" onClick={() => setBig(null)}>
      <div className="adbox" onClick={e => e.stopPropagation()}>
        <button className="adx" onClick={() => setBig(null)}>✕</button>
        {big.img && <img src={big.img} alt={big.text || 'Anúncio'} />}
        {big.text && <p>{big.text}</p>}
        {big.link && (interno(big.link)
          ? <a className="go" href={big.link.slice(window.location.origin.length) || '/'}>Ver agora</a>
          : <a className="go" href={big.link} target="_blank" rel="noopener noreferrer sponsored">Saiba mais</a>)}
      </div>
    </div>}
  </>;
}
