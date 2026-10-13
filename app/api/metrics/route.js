import { route } from '@/lib/http';
import { metrics } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export const GET = route(async () => metrics());
