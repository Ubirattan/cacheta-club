'use client';
// Anúncio no lobby. Só aparece se o admin ligar "Anúncios" e nunca para VIP.
// Os anúncios (imagem, link e texto) são cadastrados no painel admin e se revezam a cada 8 s.
import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase-browser.js';

export default function AdSlot({ profile }) {
  const [on, setOn] = useState(false), [ads, setAds] = useState([]), [i, setI] = useState(0);
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
  const body = <>{a.img && <img src={a.img} alt={a.text || 'Anúncio'} />}{a.text && <span>{a.text}</span>}<small>Publicidade</small></>;
  return a.link
    ? <a className="adslot adreal" href={a.link} target="_blank" rel="noopener noreferrer sponsored">{body}</a>
    : <div className="adslot adreal">{body}</div>;
}
