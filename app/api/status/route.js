import { route } from '@/lib/http';
import { live } from '@/lib/razorpay';
import { aiLive } from '@/lib/ai';
import { storage } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ({ razorpay: live ? 'test keys' : 'simulated', ai: aiLive ? 'Claude' : 'simple rules', storage }));
