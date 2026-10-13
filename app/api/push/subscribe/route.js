import { route } from '@/lib/http';
import { addSubscription, removeSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const POST = route(async (req) => {
  const { subscription } = await req.json();
  await addSubscription(subscription);
  return { ok: true };
});
export const DELETE = route(async (req) => {
  const { endpoint } = await req.json();
  await removeSubscription(endpoint);
  return { ok: true };
});
