import type { D1Like } from '../types';
import { dbPing } from '../db/queries';

export async function healthResponse(db: D1Like, version: string) {
  const ok = await dbPing(db);
  return Response.json({ ok, version, db: ok ? 'ok' : 'error' }, { status: ok ? 200 : 500 });
}
