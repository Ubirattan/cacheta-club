'use client';
// Aviso "Crie sua conta ou entre": aparece quando um visitante (sem conta) tenta jogar, apostar ou comprar.
// Quem abre é pedirConta() (lib/supabase-browser.js), por um evento da janela.
import { useEffect, useState } from 'react';
import { contaUrl } from './useAuth.js';

export default function PedirConta() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(true);
    addEventListener('cj-pedir-conta', f); return () => removeEventListener('cj-pedir-conta', f);
  }, []);
  if (!on) return null;
  return (
    <div className="overlay" style={{ zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setOn(false); }}>
      <div className="modal">
        <div style={{ fontSize: 44, lineHeight: 1 }}>🎲</div>
        <h2>Crie sua conta</h2>
        <p>Pra jogar, apostar e comprar fichas você precisa de uma conta. É rapidinho e não precisa confirmar e-mail.</p>
        <a className="go" style={{ display: 'block', textDecoration: 'none' }} href={contaUrl('criar')}>📝 Cadastrar</a>
        <a className="go" style={{ display: 'block', textDecoration: 'none', background: 'linear-gradient(180deg,#38b6ff,#1565d8)' }} href={contaUrl('entrar')}>🔑 Já tenho conta · Entrar</a>
        <button className="go" style={{ background: 'transparent', border: '2px solid #ffffff44', fontSize: 16 }} onClick={() => setOn(false)}>Agora não, só olhar</button>
      </div>
    </div>
  );
}
