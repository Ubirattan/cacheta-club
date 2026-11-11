// Aviso automático do GeraPix quando o Pix é pago.
import { NextResponse } from 'next/server';
import { repo } from '../../../../lib/repo-supabase.js';
import { gerapixWebhook } from '../../../../lib/gerapix.js';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body = {}; try { body = await req.json(); } catch {}
  try {
    const r = await gerapixWebhook(repo, req.headers.get('authorization'), body);
    if (!r.ok && r.reason === 'token inválido') return NextResponse.json({ ok: false }, { status: 401 });
  } catch (e) { console.error('gerapix webhook', e); }
  return NextResponse.json({ ok: true });
}
