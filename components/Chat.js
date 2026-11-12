'use client';
// Chat da mesa (cacheta e gude)
import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase-browser.js';
import { toast } from './ui.js';

export default function Chat({ roomId, user, profile, msgs, onClose }) {
  const [txt, setTxt] = useState('');
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  async function send(e) {
    e.preventDefault();
    const t = txt.trim(); if (!t) return;
    setTxt('');
    const { error } = await sb().from('messages').insert({ room_id: roomId, user_id: user.id, nickname: profile?.nickname || 'Jogador', text: t.slice(0, 300) });
    if (error) toast('Mensagem não enviada');
  }
  return (
    <div className="panel chat">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 18 }}>💬 Chat da mesa</h3>{onClose && <button className="sec" style={{ width: 'auto', margin: 0, padding: '4px 12px' }} onClick={onClose}>✕</button>}
      </div>
      <div className="msgs" ref={box}>
        {!msgs.length && <div className="hint">Ninguém falou nada ainda. Mande um oi!</div>}
        {msgs.map(m => <div key={m.id} className={`m ${m.user_id === user.id ? 'me' : ''}`}><b>{m.nickname}</b>{m.text}</div>)}
      </div>
      <form onSubmit={send}><input value={txt} onChange={e => setTxt(e.target.value)} maxLength={300} placeholder="Escreva uma mensagem…" /><button className="pillbtn" style={{ padding: '8px 14px' }}>Enviar</button></form>
    </div>
  );
}
