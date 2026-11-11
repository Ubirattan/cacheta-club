'use client';
// Cliente do Supabase no navegador (chave pública) + chamadas para a nossa API.
import { createClient } from '@supabase/supabase-js';

// Endereço e chave PÚBLICA do projeto (podem ficar no código: a segurança vem do RLS do banco).
// Se as variáveis existirem no Netlify, elas têm prioridade.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvozttyypufegzizvpnu.supabase.co';
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_b71pP0nR_yRCv1VTfEuI4A_v1b9xvnz';

let client = null;
export function sb() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return client;
}
export async function api(path, body) {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Erro de conexão');
  return out;
}
