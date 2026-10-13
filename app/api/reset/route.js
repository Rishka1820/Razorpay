import { route } from '@/lib/http';
import * as db from '@/lib/db';
import { seedSamples } from '@/lib/seed';
import { getRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  if (getRole() !== 'owner') throw Object.assign(new Error('Only the owner can reset the demo'), { status: 403 });
  await db.clearAll();
  await seedSamples();
  return { ok: true };
});
