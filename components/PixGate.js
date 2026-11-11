'use client';
// Quem ainda não tem chave Pix (contas antigas ou entrou com Google) precisa cadastrar uma antes de continuar.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { sb, api } from '../lib/supabase-browser.js';
import { PIX_TIPOS, normPix } from '../lib/pix.js';
import { Modal, toast } from './ui.js';

const LIVRE = ['/login', '/nova-senha'];
export default function PixGate() {
  const path = usePathname() || '/';
  const [need, setNeed] = useState(false), [tipo, setTipo] = useState('cpf'), [chave, setChave] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => {
    if (LIVRE.some(p => path.startsWith(p))) return setNeed(false);
    let vivo = true;
    const check = () => sb().auth.getSession().then(({ data }) => {
      if (!data.session) return vivo && setNeed(false);
      api('/api/pix', { op: 'get' }).then(r => { if (vivo) setNeed(!r.chave); }).catch(() => {});
    });
    check();
    const { data: sub } = sb().auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') check(); });
    return () => { vivo = false; sub?.subscription?.unsubscribe(); };
  }, [path]);
  if (!need) return null;
  async function salvar(e) {
    e.preventDefault(); setErr('');
    try { normPix(tipo, chave); } catch (e2) { return setErr(e2.message); }
    setBusy(true);
    try { await api('/api/pix', { tipo, chave }); setNeed(false); toast('Chave Pix salva'); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <Modal>
      <form onSubmit={salvar}>
        <h2>Cadastre sua chave Pix</h2>
        <p className="hint">Para continuar, informe uma chave Pix no seu nome. Você pode trocar depois no seu perfil.</p>
        <div className="seg pixseg">{PIX_TIPOS.map(([t, l]) => <button key={t} type="button" className={tipo === t ? 'on' : ''} onClick={() => { setTipo(t); setChave(''); }}>{l}</button>)}</div>
        <input className="field" autoFocus maxLength={80} value={chave} onChange={e => setChave(e.target.value)}
          placeholder={tipo === 'cpf' ? 'CPF (só números)' : tipo === 'email' ? 'E-mail' : 'Celular com DDD'}
          type={tipo === 'email' ? 'email' : 'text'} inputMode={tipo === 'email' ? 'email' : 'numeric'} />
        {err && <div className="err">{err}</div>}
        <button className="go" disabled={busy}>{busy ? 'Salvando…' : 'Salvar chave Pix'}</button>
        <button type="button" className="sec" onClick={async () => { await sb().auth.signOut(); location.href = '/login'; }}>Sair da conta</button>
      </form>
    </Modal>
  );
}
