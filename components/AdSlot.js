'use client';
// Espaço reservado para anúncio. Só aparece se o admin ligar "Anúncios" e nunca para VIP.
// Para ligar anúncios de verdade (ex.: Google AdSense), troque o conteúdo abaixo pelo código do anunciante.
import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase-browser.js';

export default function AdSlot({ profile }) {
  const [on, setOn] = useState(false);
  useEffect(() => { sb().from('app_settings').select('value').eq('key', 'ads_enabled').maybeSingle().then(({ data }) => setOn(!!(data && data.value === true))); }, []);
  const vip = profile && profile.vip_until && new Date(profile.vip_until) > new Date();
  if (!on || vip) return null;
  return <div className="adslot">Publicidade · seja VIP e jogue sem anúncios</div>;
}
