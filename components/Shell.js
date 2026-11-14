'use client';
// Moldura das páginas internas: cabeçalho com perfil + botão voltar.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth.js';
import { voltar, Header } from './ui.js';
import ProfileModal from './ProfileModal.js';

export default function Shell({ title, back = '/', right, children, required = false }) {
  const router = useRouter();
  const auth = useAuth({ required });
  const [prof, setProf] = useState(false);
  return (
    <div className="page lounge">
      <Header profile={auth.profile} onProfile={() => setProf(true)} right={<>{right}<button className="rbtn" onClick={() => voltar(router, back)}>↩</button></>} />
      <div className="pagebody">
        {title && <div className="ptitle">{title}</div>}
        {typeof children === 'function' ? children(auth) : children}
      </div>
      {prof && auth.profile && <ProfileModal profile={auth.profile} onClose={() => setProf(false)} onSaved={auth.reloadProfile} />}
    </div>
  );
}
