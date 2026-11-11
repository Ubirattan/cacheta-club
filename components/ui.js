'use client';
import { Engine } from '../lib/engine.js';
import { fmt } from '../lib/modes.js';

export function toast(t) {
  const el = typeof document !== 'undefined' && document.getElementById('toast');
  if (!el) return;
  el.textContent = t; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 2600);
}

export function Card({ c, cor = -1, cls = '', onClick, style }) {
  const red = c.s === 1 || c.s === 2, r = Engine.RANKS[c.r], s = Engine.SUITS[c.s], jk = Engine.isJ(c, cor);
  return (
    <div className={`card ${red ? 'red' : ''} ${jk ? 'joker' : ''} ${cls}`} onClick={onClick} style={style} data-id={c.id}>
      <div className="ix"><b>{r}</b><i>{s}</i></div>
      {c.r >= 10 ? <div className="face"><b>{r}</b><i>{s}</i></div> : <div className="ctr">{s}</div>}
      <div className="ix br"><b>{r}</b><i>{s}</i></div>
      {jk && <span className="jk">★</span>}
    </div>
  );
}

export function Header({ profile, right, onProfile }) {
  return (
    <div className="hdr">
      <div className="plate">
        <button className="badge" onClick={onProfile}>{profile?.avatar || '😎'}</button>
        <div className="who"><b>{profile?.nickname || '...'}{profile?.vip_until && new Date(profile.vip_until) > new Date() ? ' 👑' : ''}</b><small>ID: {profile ? profile.id.slice(0, 8).toUpperCase() : ''}</small></div>
        <a className="coins" href="/loja#comprar" title="Comprar fichas"><i>💰</i><span>{fmt(profile?.coins)}</span><b className="plus">+</b></a>
      </div>
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
