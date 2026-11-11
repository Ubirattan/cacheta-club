// Cadastro sem confirmação por e-mail: o servidor cria a conta já confirmada
// e o navegador entra logo em seguida com e-mail e senha.
import { NextResponse } from 'next/server';
import { adminClient } from '../../../lib/repo-supabase.js';
import { normPix } from '../../../lib/pix.js';
export const dynamic = 'force-dynamic';

const tentativas = new Map(); // limite simples por IP (por instância)
function limitado(ip) {
  const agora = Date.now(), t = (tentativas.get(ip) || []).filter(x => agora - x < 10 * 60 * 1000);
  t.push(agora); tentativas.set(ip, t);
  return t.length > 8;
}
const erro = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return erro('Dados inválidos'); }
  const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '?').split(',')[0].trim();
  if (limitado(ip)) return erro('Muitas tentativas. Espere alguns minutos.', 429);
  const nick = String(b.nick || '').trim().slice(0, 16);
  const email = String(b.email || '').trim().toLowerCase();
  const pass = String(b.pass || '');
  if (nick.length < 2) return erro('Escolha um apelido com pelo menos 2 letras');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return erro('E-mail inválido');
  if (pass.length < 6 || pass.length > 72) return erro('A senha precisa ter de 6 a 72 caracteres');
  let pix; try { pix = normPix(b.pixTipo, b.pix); } catch (e) { return erro(e.message); }
  try {
    const { data, error } = await adminClient().auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { nickname: nick } });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return erro('Esse e-mail já tem conta. Use "Entrar".');
      return erro('Não foi possível criar a conta: ' + error.message);
    }
    const uid = data?.user?.id;
    if (uid) {
      const { error: e2 } = await adminClient().from('user_private').upsert({ user_id: uid, pix_tipo: pix.tipo, pix_chave: pix.chave, updated_at: new Date().toISOString() });
      if (e2) console.error('chave pix no cadastro:', e2.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return erro('Erro no servidor, tente de novo', 500);
  }
}
