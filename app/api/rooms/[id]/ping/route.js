import { route } from '../../../../../lib/api.js';
import { ping } from '../../../../../lib/service.js';
export const dynamic = 'force-dynamic';
// "estou aqui": mantém a mesa viva enquanto alguém está na tela dela
export const POST = route(({ user, params, repo }) => ping(repo, user, params.id));
