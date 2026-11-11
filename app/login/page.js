'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '../../lib/supabase-browser.js';

// Teclado próprio do jogo: no celular deitado, os campos ficam à esquerda e o teclado à direita.
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', ['⇧', ...'zxcvbnm', '⌫'], ['@', '.', '_', '-', '.com', 'espaço', 'OK']];

function Teclado({ onKey, shift, okLabel }) {
  return (
    <div className="kbd" onMouseDown={e => e.preventDefault()}>
      {ROWS.map((row, i) => (
        <div key={i} className="kr">
          {[...row].map(k => {
            const cls = k === 'OK' ? 'k ok' : k === 'espaço' ? 'k sp' : k === '⇧' ? 'k fn' + (shift ? ' on' : '') : k === '⌫' || k === '.com' ? 'k fn' : 'k';
            const label = k === 'OK' ? okLabel : k.length === 1 && shift ? k.toUpperCase() : k;
            return <button key={k} type="button" className={cls} onPointerDown={e => { e.preventDefault(); onKey(k); }}>{label}</button>;
          })}
        </div>
      ))}
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const [tab, setTab] = useState('entrar');
  const [v, setV] = useState({ nick: '', email: '', pass: '', pass2: '' });
  const [err, setErr] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const [kbAuto, setKbAuto] = useState(false), [kbOff, setKbOff] = useState(false);
  const [act, setAct] = useState('email'), [shift, setShift] = useState(false);
  const kb = kbAuto && !kbOff;

  const go = (n) => { if (n.endsWith('.html')) location.replace(n); else router.replace(n); };
  const next = () => { try { return new URLSearchParams(location.search).get('next') || '/'; } catch { return '/'; } };
  useEffect(() => { sb().auth.getSession().then(({ data }) => { if (data.session) go(next()); }); }, [router]); // eslint-disable-line
  useEffect(() => {
    const f = () => { const touch = matchMedia('(pointer:coarse)').matches; setKbAuto(touch && innerWidth > innerHeight && innerHeight < 620); };
    f(); addEventListener('resize', f); return () => removeEventListener('resize', f);
  }, []);

  const fields = tab === 'criar'
    ? [['nick', 'Apelido', 16], ['email', 'E-mail', 120], ['pass', 'Senha', 72], ['pass2', 'Confirmar senha', 72]]
    : tab === 'esqueci' ? [['email', 'E-mail da sua conta', 120]]
    : [['email', 'E-mail', 120], ['pass', 'Senha', 72]];
  useEffect(() => { setAct(tab === 'criar' ? 'nick' : 'email'); setErr(''); setOk(''); }, [tab]);
  const set = (k, val) => setV(o => ({ ...o, [k]: val }));

  async function submit(e) {
    if (e) e.preventDefault();
    setErr(''); setOk('');
    const email = v.email.trim(), pass = v.pass;
    if (tab === 'esqueci') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErr('Digite o e-mail da sua conta');
      setBusy(true);
      const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/nova-senha' });
      setBusy(false);
      if (error) return setErr(/rate|seconds|many/i.test(error.message) ? 'Muitas tentativas. Espere alguns minutos e tente de novo' : 'Não deu pra enviar: ' + error.message);
      return setOk('Pronto! Se esse e-mail tiver conta, chega um link para criar uma senha nova. Veja também o spam.');
    }
    if (tab === 'criar') {
      if (v.nick.trim().length < 2) return setErr('Escolha um apelido com pelo menos 2 letras');
      if (pass.length < 6) return setErr('A senha precisa ter pelo menos 6 caracteres');
      if (pass !== v.pass2) return setErr('As senhas não são iguais');
    } else if (!email || !pass) return setErr('Preencha e-mail e senha');
    setBusy(true);
    try {
      if (tab === 'criar') {
        const r = await fetch('/api/cadastro', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nick: v.nick, email, pass }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Não foi possível criar a conta');
      }
      const { error } = await sb().auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message.includes('Invalid') ? 'E-mail ou senha errados' : error.message.includes('confirm') ? 'Essa conta ainda não foi confirmada. Abra o link que chegou no seu e-mail.' : error.message);
      go(next());
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  async function google() {
    setErr('');
    const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + next() } });
    if (error) setErr('Login com Google não está ativado no Supabase ainda');
  }

  function onKey(k) {
    const f = fields.find(x => x[0] === act) || fields[0], cur = v[f[0]];
    if (k === 'OK') {
      const i = fields.findIndex(x => x[0] === f[0]);
      if (i < fields.length - 1) setAct(fields[i + 1][0]); else submit();
      return;
    }
    if (k === '⇧') return setShift(s => !s);
    if (k === '⌫') return set(f[0], cur.slice(0, -1));
    let ch = k === 'espaço' ? ' ' : k;
    if (ch.length === 1 && shift) { ch = ch.toUpperCase(); setShift(false); }
    if (f[0] === 'email') ch = ch.toLowerCase().replace(' ', '');
    if ((cur + ch).length <= f[2]) set(f[0], cur + ch);
  }
  const lastField = act === fields[fields.length - 1][0];
  const okLabel = lastField ? (tab === 'entrar' ? 'Entrar' : tab === 'esqueci' ? 'Enviar' : 'Criar') : 'Próximo';

  const card = (
    <form className="authcard" onSubmit={submit}>
      {!kb && <div className="logo"><b>Cacheta Club</b><small>MESA DE CARTAS</small></div>}
      <div className="seg" style={{ marginTop: kb ? 0 : 10 }}>
        <button type="button" className={tab === 'entrar' ? 'on' : ''} onClick={() => setTab('entrar')}>Entrar</button>
        <button type="button" className={tab === 'criar' ? 'on' : ''} onClick={() => setTab('criar')}>Criar conta</button>
      </div>
      {fields.map(([k, ph, max]) => kb
        ? <div key={k} className={'field kf' + (act === k ? ' act' : '')} onClick={() => setAct(k)}>
            {v[k] ? <span className="kv">{k.startsWith('pass') ? '•'.repeat(v[k].length) : v[k]}</span> : <span className="kp">{ph}</span>}
            {act === k && <i className="caret" />}
          </div>
        : <input key={k} className="field" placeholder={ph} maxLength={max}
            type={k === 'email' ? 'email' : k.startsWith('pass') ? 'password' : 'text'}
            autoComplete={k === 'email' ? 'email' : k === 'pass' ? (tab === 'entrar' ? 'current-password' : 'new-password') : k === 'pass2' ? 'new-password' : 'nickname'}
            value={v[k]} onChange={e => set(k, e.target.value)} />)}
      {err && <div className="err">{err}</div>}
      {ok && <div className="okmsg">{ok}</div>}
      <button className="go" disabled={busy}>{busy ? 'Aguarde…' : tab === 'entrar' ? 'Entrar' : tab === 'esqueci' ? 'Enviar link de nova senha' : 'Criar conta e jogar'}</button>
      {tab === 'entrar' && <button type="button" className="forgot" onClick={() => setTab('esqueci')}>Esqueci a senha</button>}
      {tab === 'esqueci' && <button type="button" className="forgot" onClick={() => setTab('entrar')}>← Voltar para entrar</button>}
      {!kb && <><div className="or">ou</div>
        <button type="button" className="gbtn" onClick={google}><span style={{ fontWeight: 800, color: '#4285F4' }}>G</span> Entrar com Google</button>
        <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>As fichas do Cacheta Club são virtuais: não valem dinheiro e não podem ser sacadas.</p></>}
      {kb && <div className="kblinks"><button type="button" onClick={google}>Entrar com Google</button><button type="button" onClick={() => setKbOff(true)}>Usar teclado do celular</button></div>}
      {!kb && kbAuto && <div className="kblinks"><button type="button" onClick={() => setKbOff(false)}>Usar teclado do jogo</button></div>}
    </form>
  );
  if (kb) return (
    <div className="page lounge authkb">
      {card}
      <Teclado onKey={onKey} shift={shift} okLabel={okLabel} />
    </div>
  );
  return <div className="page lounge"><div className="center-box">{card}</div></div>;
}
