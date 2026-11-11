'use client';
import { useState, useEffect } from 'react';
import { sb } from '../lib/supabase-browser.js';
import { useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../components/useAuth.js';
import { Header, Card } from '../components/ui.js';
import ProfileModal from '../components/ProfileModal.js';
import JoinCode from '../components/JoinCode.js';

function Art({ cards, em, big }) {
  const cls = ['c1', 'c2', 'c3'];
  return (
    <div className="art"><div className="burst" />
      {cards.map((c, i) => <Card key={i} c={{ id: i, r: c[0], s: c[1] }} cls={cards.length === 2 ? (i ? 'c3' : 'c1') : cls[i]} />)}
      <span className="em" style={big ? { fontSize: 'clamp(40px,10vmin,70px)', bottom: 0 } : undefined}>{em}</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'inicio');
  const [modal, setModal] = useState(null);
  const [motd, setMotd] = useState('');
  useEffect(() => { if (user) sb().from('app_settings').select('value').eq('key', 'motd').maybeSingle().then(({ data }) => setMotd(data ? data.value : '')); }, [user]);
  const bonusOk = profile && (!profile.last_bonus || Date.now() - new Date(profile.last_bonus).getTime() > 20 * 3600 * 1000);
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')}
        right={<span className="online"><i />{online.length} online</span>} />
      {motd && <div className="note" style={{ fontSize: 14, color: 'var(--gold)' }}>📣 {motd}</div>}
      <div className="modes" style={{ flex: 1, display: 'grid', gap: 'clamp(10px,2vw,22px)', alignContent: 'center', padding: '10px clamp(12px,4vw,48px)' }}>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' }} onClick={() => router.push('/lobby')}>
          <Art cards={[[0, 1], [0, 0], [0, 3]]} em="🌐" /><h3>Cacheta online</h3></button>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#43e0a0,#109c61 60%,#06703f)' }} onClick={() => router.push('/torneios')}>
          <Art cards={[[12, 2], [11, 1]]} em="🏆" big /><h3>Torneio Cacheta</h3></button>
        <a className="mode" style={{ '--g': 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }} href="/offline/index.html">
          <Art cards={[[6, 1], [10, 0], [5, 2]]} em="🤖" /><h3>Contra o computador</h3></a>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#ff6fd8,#d6247e 55%,#8e0f4e)' }} onClick={() => setModal('codigo')}>
          <Art cards={[[2, 3], [3, 3], [4, 3]]} em="🔑" /><h3>Entrar com código</h3></button>
      </div>
      <div className="footbar">
        <button onClick={() => setModal('perfil')} title="Perfil e configurações">⚙️</button>
        <button onClick={() => router.push('/ranking')} title="Ranking">🏆</button>
        <button onClick={() => router.push('/historico')} title="Histórico">📜</button>
        {profile?.is_admin && <button onClick={() => router.push('/admin')} title="Painel admin">🛠</button>}
        <div className="ver">Cacheta Club · v3.0 beta</div>
        <button className="shop" onClick={() => router.push('/loja')} style={{ position: 'relative' }}><i>{bonusOk ? '🎁' : '🛒'}</i>Loja{bonusOk && <span className="badge-n" style={{ top: -6, right: -10 }}>1</span>}</button>
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      {modal === 'codigo' && <JoinCode onClose={() => setModal(null)} />}
      <style>{`.page .modes{grid-template-columns:repeat(4,1fr)}@media (orientation:portrait){.page .modes{grid-template-columns:1fr 1fr}}`}</style>
    </div>
  );
}
