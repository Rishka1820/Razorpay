import { route } from '@/lib/http';
import { mockLinkInfo, mockPay } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => mockLinkInfo(params.linkId));
export const POST = route(async (req, { params }) => {
  const o = await mockPay(params.linkId);
  return { orderId: o.id };
});
