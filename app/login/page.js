'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/supabase-browser.js';

export default function Login() {
  const router = useRouter();
  const [tab, setTab] = useState('entrar');
  const [nick, setNick] = useState(''), [email, setEmail] = useState(''), [pass, setPass] = useState(''), [pass2, setPass2] = useState('');
  const [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => { sb().auth.getSession().then(({ data }) => { if (data.session) router.replace(next()); }); }, [router]);
  const next = () => { try { return new URLSearchParams(location.search).get('next') || '/'; } catch { return '/'; } };

  async function submit(e) {
    e.preventDefault(); setErr(''); setOk('');
    if (tab === 'criar') {
      if (nick.trim().length < 2) return setErr('Escolha um apelido com pelo menos 2 letras');
      if (pass.length < 6) return setErr('A senha precisa ter pelo menos 6 caracteres');
      if (pass !== pass2) return setErr('As senhas não são iguais');
    }
    setBusy(true);
    try {
      if (tab === 'entrar') {
        const { error } = await sb().auth.signInWithPassword({ email, password: pass });
        if (error) throw new Error(error.message.includes('Invalid') ? 'E-mail ou senha errados' : error.message.includes('confirm') ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)' : error.message);
        router.replace(next());
      } else {
        const { data, error } = await sb().auth.signUp({ email, password: pass, options: { data: { nickname: nick.trim().slice(0, 16) }, emailRedirectTo: location.origin } });
        if (error) throw new Error(error.message.includes('registered') ? 'Esse e-mail já tem conta. Use "Entrar".' : error.message);
        if (data.session) router.replace(next());
        else setOk('Conta criada! Enviamos um link de confirmação pro seu e-mail.');
      }
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  async function google() {
    setErr('');
    const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + next() } });
    if (error) setErr('Login com Google não está ativado no Supabase ainda');
  }
  return (
    <div className="page lounge">
      <div className="center-box">
        <form className="authcard" onSubmit={submit}>
          <div className="logo"><b>Cacheta Club</b><small>MESA DE CARTAS</small></div>
          <div className="seg" style={{ marginTop: 10 }}>
            <button type="button" className={tab === 'entrar' ? 'on' : ''} onClick={() => setTab('entrar')}>Entrar</button>
            <button type="button" className={tab === 'criar' ? 'on' : ''} onClick={() => setTab('criar')}>Criar conta</button>
          </div>
          {tab === 'criar' && <input className="field" placeholder="Apelido" maxLength={16} value={nick} onChange={e => setNick(e.target.value)} />}
          <input className="field" type="email" placeholder="E-mail" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="field" type="password" placeholder="Senha" autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'} value={pass} onChange={e => setPass(e.target.value)} required />
          {tab === 'criar' && <input className="field" type="password" placeholder="Confirmar senha" value={pass2} onChange={e => setPass2(e.target.value)} required />}
          {err && <div className="err">{err}</div>}
          {ok && <div className="okmsg">{ok}</div>}
          <button className="go" disabled={busy}>{busy ? 'Aguarde…' : tab === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
          <div className="or">ou</div>
          <button type="button" className="gbtn" onClick={google}><span style={{ fontWeight: 800, color: '#4285F4' }}>G</span> Entrar com Google</button>
          <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>As fichas do Cacheta Club são virtuais: não valem dinheiro e não podem ser sacadas.</p>
        </form>
      </div>
    </div>
  );
}
