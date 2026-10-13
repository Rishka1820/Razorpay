import { route } from '@/lib/http';
import { getFresh, present } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => ({ order: present(await getFresh(params.id)) }));
