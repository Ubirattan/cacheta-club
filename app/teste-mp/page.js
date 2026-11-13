'use client';
// TESTE DO MERCADO PAGO (só admin): mostra o que o cliente vê ao pagar e quanto tempo o dinheiro leva pra cair.
// Cobrança de verdade (dá pra devolver no botão de reembolso). Não credita fichas.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { api } from '../../lib/supabase-browser.js';

const brl = n => n == null ? '–' : 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dh = t => t ? new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
function dur(ms) {
  if (ms == null || ms < 0) return '–';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} segundos`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  const h = s / 3600; return h < 48 ? `${h.toFixed(1).replace('.', ',')} horas` : `${Math.round(h / 24)} dias`;
}
const STATUS = {
  pending: ['⏳ Aguardando pagamento', '#fbbf24'], in_process: ['⏳ Em análise', '#fbbf24'], approved: ['✅ Pago!', '#4ade80'],
  rejected: ['❌ Recusado', '#f87171'], cancelled: ['🚫 Cancelado / expirou', '#94a3b8'], refunded: ['↩️ Devolvido (reembolso)', '#93c5fd'],
};

export default function TesteMp() {
  const router = useRouter();
  const { profile } = useAuth();
  const [valor, setValor] = useState('1,00');
  const [email, setEmail] = useState('');
  const [p, setP] = useState(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiou, setCopiou] = useState(false);
  const [, tique] = useState(0);
  const pRef = useRef(null); pRef.current = p;

  // volta do Checkout Pro: ?payment_id=...
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('payment_id');
    if (id && /^\d+$/.test(id)) status(id);
    try { setEmail(localStorage.getItem('tmp_email') || ''); } catch {}
  }, []); // eslint-disable-line
  // acompanha o pagamento até terminar
  useEffect(() => {
    if (!p || !['pending', 'in_process'].includes(p.status)) return;
    const t = setInterval(() => status(p.id, true), 3000), u = setInterval(() => tique(x => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(u); };
  }, [p?.id, p?.status]); // eslint-disable-line

  async function chama(b) { setErro(''); setBusy(true); try { return await api('/api/teste-mp', b); } catch (e) { setErro(e.message); return null; } finally { setBusy(false); } }
  async function status(id, quieto) {
    try { const r = await api('/api/teste-mp', { op: 'status', id }); if (r) setP(o => ({ ...r, img: r.pix?.img || o?.img, qr: r.pix?.qr || o?.qr })); } catch (e) { if (!quieto) setErro(e.message); }
  }
  const v = () => Number(String(valor).replace(/\./g, '').replace(',', '.'));
  async function pix() {
    try { localStorage.setItem('tmp_email', email); } catch {}
    const r = await chama({ op: 'pix', valor: v(), email });
    if (r) setP({ ...r, img: r.pix?.img, qr: r.pix?.qr });
  }
  async function pro() { const r = await chama({ op: 'pro', valor: v(), origem: location.origin }); if (r?.url) location.href = r.url; }
  async function reembolsar() { if (!confirm('Devolver esse pagamento pra quem pagou?')) return; const r = await chama({ op: 'reembolsar', id: p.id }); if (r) setP(o => ({ ...o, ...r })); }

  if (profile && !profile.is_admin) return <div className="page lounge"><div className="center-box"><div className="authcard">Só o administrador pode usar esta página.</div></div></div>;
  const st = p && (p.reembolsado ? STATUS.refunded : STATUS[p.status] || [p.status, '#fff']);
  const espera = p && p.status !== 'approved' ? Date.now() - Date.parse(p.criado) : null;

  return (
    <div className="page lounge tmp">
      <div className="tmp-top"><button className="rbtn" onClick={() => router.push('/admin')}>↩</button><b>🧪 Teste do Mercado Pago</b></div>
      <div className="tmp-box">
        <p className="tmp-dica">Cobrança <b>de verdade</b> na sua conta do Mercado Pago (não dá fichas). Pague com <b>outro banco</b> (Nubank, Inter, Caixa…): o Mercado Pago não deixa pagar a si mesmo. Depois dá pra devolver o dinheiro no botão de reembolso.</p>
        <label>Valor<input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value.replace(/[^\d,]/g, ''))} /></label>
        <label>E-mail de quem vai pagar (pro Pix)<input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} placeholder="email@exemplo.com" /></label>
        <div className="tmp-bts">
          <button disabled={busy} className="b1" onClick={pix}>Pix aqui no site<small>QR Code e copia e cola</small></button>
          <button disabled={busy} className="b2" onClick={pro}>Página do Mercado Pago<small>Pix, cartão e saldo</small></button>
        </div>
        {erro && <div className="tmp-erro">{erro}</div>}
      </div>

      {p && <div className="tmp-box">
        <div className="tmp-st" style={{ color: st[1], borderColor: st[1] }}>{st[0]}</div>
        {p.status !== 'approved' && p.qr && <>
          <p className="tmp-cli">👇 Assim o cliente vê:</p>
          <div className="tmp-cliente">
            <b>Pague {brl(p.valor)} com Pix</b>
            {p.img && <img src={`data:image/png;base64,${p.img}`} alt="QR Code Pix" />}
            <small>Ou copie o código e cole no app do seu banco (Pix copia e cola):</small>
            <div className="tmp-cc">{p.qr}</div>
            <button onClick={() => { navigator.clipboard?.writeText(p.qr); setCopiou(true); setTimeout(() => setCopiou(false), 2000); }}>{copiou ? 'Copiado ✓' : 'Copiar código Pix'}</button>
            <small>Expira às {dh(p.expira)} · esperando há {dur(espera)}</small>
          </div>
        </>}
        <table className="tmp-tab"><tbody>
          <tr><td>Pagamento nº</td><td>{p.id}</td></tr>
          <tr><td>Meio</td><td>{p.meio === 'pix' ? 'Pix' : p.tipo === 'credit_card' ? `Cartão de crédito (${p.meio})` : p.meio || '–'}</td></tr>
          <tr><td>Criado</td><td>{dh(p.criado)}</td></tr>
          <tr><td>Aprovado</td><td>{dh(p.aprovado)}</td></tr>
          {p.aprovado && <tr className="dest"><td>Tempo até aprovar</td><td>{dur(Date.parse(p.aprovado) - Date.parse(p.criado))}</td></tr>}
          <tr><td>Valor pago</td><td>{brl(p.valor)}</td></tr>
          <tr><td>Taxa do Mercado Pago</td><td>{p.status === 'approved' ? brl(p.taxas) : '–'}</td></tr>
          <tr className="dest"><td>Você recebe</td><td>{p.status === 'approved' ? brl(p.liquido) : '–'}</td></tr>
          <tr className="dest"><td>Dinheiro disponível na conta</td><td>{p.liberacao ? `${dh(p.liberacao)}${p.aprovado ? ` (${Date.parse(p.liberacao) - Date.parse(p.aprovado) < 60000 ? 'na hora' : 'em ' + dur(Date.parse(p.liberacao) - Date.parse(p.aprovado))})` : ''}` : '–'}</td></tr>
          {p.liberado && <tr><td>Situação da liberação</td><td>{p.liberado === 'released' ? 'Liberado ✅' : p.liberado === 'pending' ? 'Aguardando a data' : p.liberado}</td></tr>}
        </tbody></table>
        {p.status === 'approved' && !p.reembolsado && <button className="tmp-reemb" disabled={busy} onClick={reembolsar}>↩️ Devolver o dinheiro (reembolso)</button>}
      </div>}
      <style>{`
.tmp{overflow-y:auto!important;height:100dvh;padding-bottom:20px}
.tmp-top{display:flex;align-items:center;gap:10px;padding:8px 12px;font:700 20px Oswald;color:#fff}
.tmp-box{margin:8px 12px;background:#0008;border:1px solid #ffffff22;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;max-width:520px;align-self:center;width:calc(100% - 24px)}
.tmp-dica{margin:0;font:400 13px Rubik;color:#cbd5e1;line-height:1.4}
.tmp label{display:flex;flex-direction:column;gap:4px;font:500 13px Rubik;color:#e2e8f0}
.tmp input{height:42px;border-radius:12px;border:1px solid #ffffff33;background:#0006;color:#fff;font:600 17px Rubik;padding:0 12px}
.tmp-bts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tmp-bts button{border:none;border-radius:14px;color:#fff;font:700 15px Rubik;padding:12px 8px;display:flex;flex-direction:column;gap:2px}
.tmp-bts small{font:400 11px Rubik;opacity:.9}
.tmp-bts .b1{background:linear-gradient(180deg,#32bcad,#0f766e)}.tmp-bts .b2{background:linear-gradient(180deg,#38bdf8,#0369a1)}
.tmp-bts button:disabled{opacity:.5}
.tmp-erro{background:#7f1d1d;color:#fecaca;border-radius:10px;padding:8px 10px;font:500 13px Rubik}
.tmp-st{align-self:center;border:2px solid;border-radius:20px;padding:6px 16px;font:700 17px Rubik}
.tmp-cli{margin:0;font:500 13px Rubik;color:#fde68a}
.tmp-cliente{background:#fff;color:#111;border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.tmp-cliente b{font:700 17px Rubik}.tmp-cliente small{font:400 12px Rubik;color:#555}
.tmp-cliente img{width:220px;height:220px}
.tmp-cc{font:400 11px monospace;word-break:break-all;background:#f1f5f9;border-radius:8px;padding:8px;max-height:70px;overflow:auto;width:100%}
.tmp-cliente button{border:none;border-radius:10px;background:#32bcad;color:#fff;font:700 15px Rubik;padding:10px 18px}
.tmp-tab{width:100%;border-collapse:collapse;font:400 13px Rubik;color:#e2e8f0}
.tmp-tab td{padding:6px 4px;border-bottom:1px solid #ffffff14}.tmp-tab td:last-child{text-align:right;font-weight:600}
.tmp-tab tr.dest td{color:#4ade80}
.tmp-reemb{border:1px solid #93c5fd;background:#1e3a8a;color:#fff;border-radius:12px;padding:10px;font:600 14px Rubik}
`}</style>
    </div>
  );
}
