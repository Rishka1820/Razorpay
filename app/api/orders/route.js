import { route } from '@/lib/http';
import * as db from '@/lib/db';
import { createOrder, present } from '@/lib/orders';
import { seedSamples } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  let list = await db.listOrders();
  if (list.length === 0) {
    await seedSamples();
    list = await db.listOrders();
  }
  return { orders: list.map(present) };
});

export const POST = route(async (req) => {
  const body = await req.json();
  const o = await createOrder(body);
  return { order: present(o) };
});
