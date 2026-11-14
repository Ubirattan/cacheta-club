// Aviso no celular do admin quando algo quebra no servidor (erro 500, API do futebol, pagamento).
// Usa a mesma notificação das vendas (ligar no painel admin). Pra não encher o celular:
// o mesmo erro só avisa de novo depois de 30 min, e no máximo 1 aviso a cada 3 min no total.
import { notifyAdmins } from './push.js';

const CHAVE = 'alerta_erro';
export const MESMO_ERRO_MS = 30 * 60 * 1000, ENTRE_AVISOS_MS = 3 * 60 * 1000;

// devolve true se mandou o aviso
export async function avisarErro(repo, onde, erro, agora = Date.now(), notificar = notifyAdmins) {
  try {
    const msg = String(erro?.message || erro || 'erro').replace(/\s+/g, ' ').slice(0, 160);
    const [r] = await repo.sel('app_settings', { key: CHAVE });
    const v = r?.value && typeof r.value === 'object' ? r.value : { ultimo: 0, por: {} };
    const k = (onde + ':' + msg.slice(0, 60)).slice(0, 120);
    if (agora - (v.ultimo || 0) < ENTRE_AVISOS_MS) return false;
    if (agora - (v.por?.[k] || 0) < MESMO_ERRO_MS) return false;
    const por = Object.fromEntries(Object.entries(v.por || {}).filter(([, t]) => agora - t < MESMO_ERRO_MS));
    por[k] = agora;
    const novo = { ultimo: agora, por };
    if (r) await repo.upd('app_settings', { key: CHAVE }, { value: novo }); else await repo.ins('app_settings', { key: CHAVE, value: novo });
    await notificar(repo, '⚠️ Erro no site', `${onde}: ${msg}`);
    return true;
  } catch (e) { console.error('alerta:', e?.message); return false; }
}
