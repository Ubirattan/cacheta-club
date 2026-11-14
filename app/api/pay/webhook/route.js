// Aviso automático do Mercado Pago quando um pagamento muda.
// O conteúdo do aviso não é confiado: o servidor consulta o pagamento na API do Mercado Pago.
import { NextResponse } from 'next/server';
import { repo } from '../../../../lib/repo-supabase.js';
import { avisarErro } from '../../../../lib/alerta.js';
import { processPayment } from '../../../../lib/payments.js';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const url = new URL(req.url);
    let body = {}; try { body = await req.json(); } catch {}
    const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
    const id = (body.data && body.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id');
    if (type === 'payment' && id) await processPayment(repo, id);
  } catch (e) { console.error('webhook', e); await avisarErro(repo, 'Pix Mercado Pago (aviso)', e); }
  return NextResponse.json({ ok: true }); // sempre 200, senão o Mercado Pago fica reenviando
}
export const GET = POST;
