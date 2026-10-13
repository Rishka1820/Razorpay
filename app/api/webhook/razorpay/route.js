import { verifyWebhook } from '@/lib/razorpay';
import { handleRazorpayEvent } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get('x-razorpay-signature'))) {
    return Response.json({ error: 'Bad signature' }, { status: 400 });
  }
  try {
    return Response.json(await handleRazorpayEvent(JSON.parse(raw)));
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
