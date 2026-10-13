import { route, originOf } from '@/lib/http';
import { merchantAction, present } from '@/lib/orders';
import { getRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const POST = route(async (req, { params }) => {
  const { type, ...payload } = await req.json();
  const o = await merchantAction(params.id, type, payload, { role: getRole(), origin: originOf(req) });
  return { order: present(o) };
});
