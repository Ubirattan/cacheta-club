'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/supabase-browser.js';
import { Modal } from './ui.js';

export default function JoinCode({ onClose }) {
  const router = useRouter();
  const [code, setCode] = useState(''), [pass, setPass] = useState(''), [err, setErr] = useState('');
  async function go() {
    setErr('');
    try { const r = await api('/api/rooms', { code: code.trim(), password: pass }); router.push('/sala/' + r.id); }
    catch (e) { setErr(e.message); }
  }
  return (
    <Modal onClose={onClose}>
      <h2>Entrar em sala</h2>
      <p>Digite o código que seu amigo mandou. Se a sala for privada, coloque a senha também.</p>
      <input className="field" placeholder="Código (ex.: K7Q2MX)" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center' }} />
      <input className="field" placeholder="Senha (só para sala privada)" value={pass} onChange={e => setPass(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <button className="go" onClick={go}>Entrar</button>
      <button className="sec" onClick={onClose}>Cancelar</button>
    </Modal>
  );
}
