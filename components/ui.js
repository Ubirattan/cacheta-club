'use client';
import { Engine } from '../lib/engine.js';
import { fmt } from '../lib/modes.js';
import { suitSvg } from '../lib/suits.js';
import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase-browser.js';
import { contaUrl } from './useAuth.js';

// true quando a pessoa está navegando sem conta (visitante)
export function useVisitante() {
  const [v, setV] = useState(false);
  useEffect(() => {
    let vivo = true;
    sb().auth.getSession().then(({ data }) => { if (vivo) setV(!data.session); });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => setV(!s));
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);
  return v;
}

export function toast(t) {
  const el = typeof document !== 'undefined' && document.getElementById('toast');
  if (!el) return;
  el.textContent = t; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2600);
}

export function Card({ c, cor = -1, cls = '', onClick, style }) {
  const red = c.s === 1 || c.s === 2, r = Engine.RANKS[c.r], jk = Engine.isJ(c, cor);
  const su = { __html: suitSvg(c.s) }; // naipe em vetor: nítido em qualquer tela
  return (
    <div className={`card s${c.s} ${red ? 'red' : ''} ${jk ? 'joker' : ''} ${cls}`} onClick={onClick} style={style} data-id={c.id}>
      {/* número + naipe no canto, naipe médio em cima à direita e naipe grande embaixo (como no Super Cacheta) */}
      <div className="ix"><b>{r}</b><i dangerouslySetInnerHTML={su} /></div>
      {c.r >= 10 ? <div className="face"><b>{r}</b><i dangerouslySetInnerHTML={su} /></div>
        : <><div className="tr" dangerouslySetInnerHTML={su} /><div className="big" dangerouslySetInnerHTML={su} /></>}
      {jk && <span className="jk">★</span>}
    </div>
  );
}

export function Header({ profile, right, mid, onProfile, semVisitante }) {
  const visitante = useVisitante() && !profile;
  return (
    <div className="hdr">
      {visitante ? (semVisitante ? <div /> :
        <div className="plate vis">
          <a className="badge" href={contaUrl('entrar')} title="Entrar">👤</a>
          <div className="who"><b>Visitante</b><small>Crie sua conta pra jogar</small></div>
          <a className="vis-btn cad" href={contaUrl('criar')}>📝 Cadastrar</a>
          <a className="vis-btn ent" href={contaUrl('entrar')}>🔑 Entrar</a>
        </div>
      )) : <div className="plate">
        <button className="badge" onClick={onProfile}>{profile?.avatar || '😎'}</button>
        <div className="who"><b>{profile?.nickname || '...'}{profile?.vip_until && new Date(profile.vip_until) > new Date() ? ' 👑' : ''}</b><small>ID: {profile ? profile.id.slice(0, 8).toUpperCase() : ''}</small></div>
        <a className="coins" href="/loja#comprar" title="Comprar fichas"><i>💰</i><span>{fmt(profile?.coins)}</span><b className="plus">+</b></a>
      </div>}
      {mid && <div className="games">{mid}</div>}
      <div className="right">{right}</div>
    </div>
  );
}

export function Modal({ children, onClose }) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}

export function Seg({ label, value, options, onChange, hint }) {
  return (
    <div className="opt-row">
      <label>{label}</label>
      <div className="seg">
        {options.map(([v, t]) => <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>)}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
