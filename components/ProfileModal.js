'use client';
import { useState, useEffect } from 'react';
import { sb, api } from '../lib/supabase-browser.js';
import { PIX_TIPOS, normPix, fmtPix } from '../lib/pix.js';
import { AVATARS } from '../lib/modes.js';
import { ITEMS } from '../lib/shop-items.js';
import { Modal, toast } from './ui.js';
import { soundOn, setSound } from '../lib/sfx.js';

export default function ProfileModal({ profile, onClose, onSaved }) {
  const [nick, setNick] = useState(profile?.nickname || '');
  const [av, setAv] = useState(profile?.avatar || '😎');
  const [snd, setSnd] = useState(soundOn());
  const [four, setFour] = useState(() => { try { return localStorage.getItem('cc_four') === '1'; } catch { return false; } });
  const [pixTipo, setPixTipo] = useState('cpf'), [pix, setPix] = useState(''), [pixOrig, setPixOrig] = useState('');
  useEffect(() => { api('/api/pix', { op: 'get' }).then(r => { if (r.chave) { setPixTipo(r.tipo); const f = fmtPix(r.tipo, r.chave); setPix(f); setPixOrig(r.tipo + f); } }).catch(() => {}); }, []);
  async function save() {
    if (pix.trim() && pixTipo + pix !== pixOrig) {
      try { normPix(pixTipo, pix); await api('/api/pix', { tipo: pixTipo, chave: pix }); } catch (e) { return toast(e.message); }
    }
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
      {ITEMS.some(i => i.slot === 'trofeu' && (profile?.owned || []).includes(i.id)) && <div className="opt-row"><label>Troféus</label>
        <span style={{ fontSize: 26 }}>{ITEMS.filter(i => i.slot === 'trofeu' && (profile?.owned || []).includes(i.id)).map(i => <span key={i.id} title={i.name}>{i.em} </span>)}</span></div>}
      <div className="opt-row"><label>Chave Pix</label><div className="seg">
        {PIX_TIPOS.map(([t, l]) => <button key={t} className={pixTipo === t ? 'on' : ''} onClick={() => { setPixTipo(t); setPix(''); }}>{l}</button>)}</div></div>
      <input className="field" maxLength={80} placeholder={pixTipo === 'cpf' ? 'CPF' : pixTipo === 'email' ? 'E-mail' : 'Celular com DDD'} inputMode={pixTipo === 'email' ? 'email' : 'numeric'} value={pix} onChange={e => setPix(e.target.value)} />
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
