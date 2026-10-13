// Demo sign-in: a signed cookie that says whether the merchant app is being used by the owner or by staff.
// The server checks it on every action, so staff restrictions are enforced here and not only hidden in the UI.
import { cookies } from 'next/headers';
import crypto from 'crypto';

const secret = process.env.SESSION_SECRET || 'dev-only-secret';
const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('hex').slice(0, 24);

export function getRole() {
  const c = cookies().get('role')?.value;
  if (c) {
    const [r, s] = c.split('.');
    if ((r === 'owner' || r === 'staff') && s === sign(r)) return r;
  }
  return 'owner';
}

export function setRole(role) {
  cookies().set('role', `${role}.${sign(role)}`, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}
