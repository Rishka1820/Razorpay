import { route } from '@/lib/http';
import { sendToSeller } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const POST = route(async () => ({ sent: await sendToSeller({ title: 'Razorpay OrderBook', body: 'Notifications are on. You will hear about payments and changes here.', url: '/', tag: 'test' }) }));
