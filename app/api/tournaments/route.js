import { route } from '../../../lib/api.js';
import { joinTournament, leaveTournament, tournamentsTick } from '../../../lib/tournament.js';
export const dynamic = 'force-dynamic';
// body.op: join | leave | tick
export const POST = route(({ user, body, repo }) =>
  body.op === 'join' ? joinTournament(repo, user, body.id)
  : body.op === 'leave' ? leaveTournament(repo, user, body.id)
  : tournamentsTick(repo), { jrEntrada: ['join'] });
