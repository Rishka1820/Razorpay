import { route } from '@/lib/http';
import { publicKey } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const GET = route(async () => ({ key: await publicKey() }));
