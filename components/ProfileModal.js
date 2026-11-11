'use client';
import { useState } from 'react';
import { sb } from '../lib/supabase-browser.js';
import { AVATARS } from '../lib/modes.js';
import { ITEMS } from '../lib/shop-items.js';
import { Modal, toast } from './ui.js';
import { soundOn, setSound } from '../lib/sfx.js';

export default function ProfileModal({ profile, onClose, onSaved }) {
  const [nick, setNick] = useState(profile?.nickname || '');
  const [av, setAv] = useState(profile?.avatar || '😎');
  const [snd, setSnd] = useState(soundOn());
  const [four, setFour] = useState(() => { try { return localStorage.getItem('cc_four') === '1'; } catch { return false; } });
  async function save() {
    const n = nick.trim().slice(0, 16);
    if (n.length < 2) return toast('O apelido precisa ter pelo menos 2 letras');
    const { error } = await sb().from('profiles').update({ nickname: n, avatar: av }).eq('id', profile.id);
    if (error) return toast('Não deu pra salvar: ' + error.message);
    setSound(snd);
    try { localStorage.setItem('cc_four', four ? '1' : '0'); } catch {}
    document.body.classList.toggle('four', four);
    onSaved && onSaved(); onClose();
  }
  const pct = profile?.games ? Math.round(profile.wins / profile.games * 100) : 0;
  return (
    <Modal onClose={onClose}>
      <h2>Seu perfil</h2>
      <input className="field" maxLength={16} placeholder="Apelido" value={nick} onChange={e => setNick(e.target.value)} />
      <div className="avpick">{[...AVATARS, ...ITEMS.filter(i => i.slot === 'avatar' && (profile?.owned || []).includes(i.id)).map(i => i.em)].map(a => <button key={a} className={a === av ? 'on' : ''} onClick={() => setAv(a)}>{a}</button>)}</div>
      <div className="stats4">
        <div><b>{profile?.games || 0}</b><small>Partidas</small></div>
        <div><b>{profile?.wins || 0}</b><small>Vitórias</small></div>
        <div><b>{pct}%</b><small>Aproveit.</small></div>
        <div><b>{(profile?.coins || 0).toLocaleString('pt-BR')}</b><small>Fichas</small></div>
      </div>
      <div className="opt-row"><label>Sons</label><div className="seg">
        <button className={snd ? 'on' : ''} onClick={() => setSnd(true)}>Ligados</button>
        <button className={!snd ? 'on' : ''} onClick={() => setSnd(false)}>Desligados</button></div></div>
      <div className="opt-row"><label>Cores dos naipes</label><div className="seg">
        <button className={!four ? 'on' : ''} onClick={() => setFour(false)}>2 cores</button>
        <button className={four ? 'on' : ''} onClick={() => setFour(true)}>4 cores (♦ azul, ♣ verde)</button></div></div>
      <button className="go" onClick={save}>Salvar</button>
      <button className="sec" onClick={async () => { await sb().auth.signOut(); location.href = '/login'; }}>Sair da conta</button>
    </Modal>
  );
}
