import { route } from '@/lib/http';
import { getRole, setRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ({ role: getRole() }));
export const POST = route(async (req) => {
  const { role } = await req.json();
  if (!['owner', 'staff'].includes(role)) throw Object.assign(new Error('Unknown role'), { status: 400 });
  setRole(role);
  return { role };
});
