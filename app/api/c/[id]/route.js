import { route, originOf } from '@/lib/http';
import { getFresh, customerAction, present } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => ({ order: present(await getFresh(params.id)) }));

export const POST = route(async (req, { params }) => {
  const { type, ...payload } = await req.json();
  const o = await customerAction(params.id, type, payload, { origin: originOf(req) });
  return { order: present(o) };
});
