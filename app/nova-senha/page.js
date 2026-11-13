'use client';
// Chegou pelo link do e-mail "esqueci a senha": o Supabase já abre a sessão; aqui a pessoa escolhe a senha nova.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/supabase-browser.js';

export default function NovaSenha() {
  const router = useRouter();
  const [ready, setReady] = useState(false), [p1, setP1] = useState(''), [p2, setP2] = useState('');
  const [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const { data: sub } = sb().auth.onAuthStateChange((ev, s) => { if (s && (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN')) setReady(true); });
    sb().auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const t = setTimeout(() => setReady(r => { if (!r) setErr('Link inválido ou vencido. Peça um novo em "Esqueci a senha".'); return r; }), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);
  async function save(e) {
    e.preventDefault(); setErr('');
    if (p1.length < 6) return setErr('A senha precisa ter pelo menos 6 caracteres');
    if (p1 !== p2) return setErr('As senhas não são iguais');
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(/same|different/i.test(error.message) ? 'Escolha uma senha diferente da antiga' : 'Não deu pra salvar: ' + error.message);
    setOk('Senha nova salva! Entrando…'); setTimeout(() => router.replace('/'), 1200);
  }
  return (
    <div className="page lounge"><div className="center-box">
      <form className="authcard" onSubmit={save}>
        <div className="logo"><b>Casa de Jogos</b><small>NOVA SENHA</small></div>
        {!ready && !err && <p className="hint" style={{ textAlign: 'center' }}>Conferindo o link…</p>}
        {ready && <>
          <input className="field" type="password" placeholder="Senha nova" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} />
          <input className="field" type="password" placeholder="Repita a senha nova" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} />
        </>}
        {err && <div className="err">{err}</div>}
        {ok && <div className="okmsg">{ok}</div>}
        {ready ? <button className="go" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha nova'}</button>
          : <button type="button" className="go" onClick={() => router.replace('/login')}>Voltar para o login</button>}
      </form>
    </div></div>
  );
}
