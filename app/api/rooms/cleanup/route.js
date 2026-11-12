import { route } from '../../../../lib/api.js';
import { cleanupRooms } from '../../../../lib/service.js';
export const dynamic = 'force-dynamic';
// chamado pelo lobby: fecha mesas abandonadas há 10 min (roda no máximo 1 vez por minuto)
export const POST = route(({ repo }) => cleanupRooms(repo));
