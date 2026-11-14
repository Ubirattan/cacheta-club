'use client';
// JOGO RESPONSÁVEL: o cliente define limite de depósito, limite de tempo por dia e autoexclusão.
// Diminuir vale na hora; aumentar ou tirar só depois de 24 h; autoexclusão não pode ser cancelada.
import { useState, useEffect } from 'react';
import Shell from '../../components/Shell.js';
import { api } from '../../lib/supabase-browser.js';
import { toast, Modal } from '../../components/ui.js';

const PER = [['dia', 'Por dia'], ['semana', 'Em 7 dias'], ['mes', 'Em 30 dias']];
const EXCL = [[1, '24 horas'], [7, '7 dias'], [30, '30 dias'], [90, '3 meses'], [180, '6 meses']];
const brl = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const quando = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const txt = v => (v == null ? '' : String(v).replace('.', ','));
const lerNum = v => (String(v).trim() === '' ? null : Number(String(v).replace(',', '.')));

function Body({ user }) {
  const [st, setSt] = useState(null), [busy, setBusy] = useState(false);
  const [dep, setDep] = useState({ dia: '', semana: '', mes: '' }), [tempo, setTempo] = useState('');
  const [excl, setExcl] = useState(null);   // período escolhido, esperando confirmação
  const aplica = s => { setSt(s); setDep(Object.fromEntries(PER.map(([k]) => [k, txt(s.deposito[k].valor)]))); setTempo(txt(s.tempo.valor)); };
  useEffect(() => { if (user) api('/api/jr', { op: 'status' }).then(aplica).catch(e => toast(e.message)); }, [user]);
  if (!st) return <div className="empty">Carregando…</div>;

  async function salvar() {
    const body = { op: 'limites', deposito: Object.fromEntries(PER.map(([k]) => [k, lerNum(dep[k])])), tempo: lerNum(tempo) };
    setBusy(true);
    try {
      const s = await api('/api/jr', body); aplica(s);
      const pend = PER.some(([k]) => s.deposito[k].pendente) || s.tempo.pendente;
      toast(pend ? 'Salvo! Limites menores já valem. Aumentos valem em 24 h.' : 'Limites salvos');
    } catch (e) { toast(e.message); }
    setBusy(false);
  }
  async function excluir() {
    setBusy(true);
    try { aplica(await api('/api/jr', { op: 'excluir', dias: excl })); setExcl(null); toast('Autoexclusão ativada'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  const pendTxt = l => l.pendente ? <small className="jr-pend">→ {l.pendente.valor == null ? 'sem limite' : l.pendente.valor} a partir de {quando(l.pendente.vale)}</small> : null;

  return <div className="jr">
    {st.exclusaoAte && <div className="jr-excl-on">⛔ Você está em <b>autoexclusão até {quando(st.exclusaoAte)}</b>. Até lá não dá pra jogar, apostar nem comprar fichas. Se o jogo estiver te fazendo mal, procure apoio, como os Jogadores Anônimos.</div>}
    <div className="jr-grade">
      <div className="panel jr-box">
        <h3>💰 Limite de depósito</h3>
        <p className="hint">Quanto você pode colocar em fichas. Deixe vazio pra não ter limite.</p>
        {PER.map(([k, nome]) => <div key={k} className="jr-lin">
          <label>{nome}</label>
          <input className="mini-in" inputMode="decimal" placeholder="sem limite" value={dep[k]} onChange={e => setDep(d => ({ ...d, [k]: e.target.value.replace(/[^0-9,.]/g, '') }))} />
          <small>usado {brl(st.depositado[k])}</small>
          {pendTxt(st.deposito[k])}
        </div>)}
      </div>
      <div className="panel jr-box">
        <h3>⏱ Limite de tempo</h3>
        <p className="hint">Minutos de jogo por dia. Quando acabar, os jogos travam até amanhã.</p>
        <div className="jr-lin">
          <label>Por dia</label>
          <input className="mini-in" inputMode="numeric" placeholder="sem limite" value={tempo} onChange={e => setTempo(e.target.value.replace(/[^0-9]/g, ''))} />
          <small>hoje {st.usoHoje} min</small>
          {pendTxt(st.tempo)}
        </div>
        <button className="go jr-salvar" disabled={busy} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar limites'}</button>
        <p className="hint">Diminuir vale na hora. Aumentar ou tirar um limite só vale depois de 24 h.</p>
      </div>
      <div className="panel jr-box">
        <h3>⛔ Autoexclusão</h3>
        <p className="hint">Dá uma pausa: fica sem jogar, apostar e comprar fichas pelo tempo escolhido. <b>Não dá pra cancelar antes do fim.</b></p>
        <div className="jr-excl">{EXCL.map(([d, n]) => <button key={d} className="pillbtn dark" disabled={busy} onClick={() => setExcl(d)}>{n}</button>)}</div>
      </div>
    </div>
    {excl && <Modal onClose={() => setExcl(null)}>
      <h2>Autoexclusão</h2>
      <p>Você vai ficar <b>{EXCL.find(x => x[0] === excl)[1]}</b> sem poder jogar, apostar ou comprar fichas. <b>Não dá pra desfazer.</b> Suas fichas continuam guardadas.</p>
      <button className="go" style={{ background: 'linear-gradient(180deg,#ef4444,#991b1b)' }} disabled={busy} onClick={excluir}>Confirmar autoexclusão</button>
      <button className="sec" onClick={() => setExcl(null)}>Cancelar</button>
    </Modal>}
    <style>{`
.jr{display:flex;flex-direction:column;gap:8px;min-height:0}
.jr-excl-on{background:#7f1d1d;border:1px solid #ef4444;border-radius:12px;padding:8px 12px;font:400 13px Rubik;color:#fecaca}
.jr-excl-on b{color:#fff}
.jr-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.jr-box{padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.jr-box h3{font-size:clamp(16px,3.2vmin,20px)}
.jr-box .hint{margin:0}
.jr-lin{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:2px 8px}
.jr-lin label{font:600 14px Oswald;color:#eadfca;min-width:70px}
.jr-lin input{width:100%}
.jr-lin small{grid-column:2;font:400 11px Rubik;color:#a8a29e}
.jr-lin .jr-pend{color:#fbbf24}
.jr-salvar{margin-top:4px;padding:9px;font-size:16px}
.jr-excl{display:flex;flex-wrap:wrap;gap:6px}
.jr-excl .pillbtn{padding:7px 12px;font-size:14px}
@media (orientation:portrait){.jr-grade{grid-template-columns:1fr}}
`}</style>
  </div>;
}
export default function JogoResponsavel() { return <Shell required title="🛡 Jogo responsável">{auth => <Body {...auth} />}</Shell>; }
