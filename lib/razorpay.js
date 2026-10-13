// Razorpay Payment Links. Runs against the real API when keys are set, otherwise a simulated checkout.
import crypto from 'crypto';

const KEY = process.env.RAZORPAY_KEY_ID;
const SECRET = process.env.RAZORPAY_KEY_SECRET;
export const live = !!(KEY && SECRET);

async function rz(path, method = 'GET', body) {
  const res = await fetch('https://api.razorpay.com/v1' + path, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.description || 'Razorpay request failed');
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function createLink({ amountInr, orderId, seq, description, customer, origin }) {
  if (!live) {
    const id = `plink_mock_${orderId}_${seq}`;
    return { id, short_url: `${origin}/mockpay/${id}`, mock: true };
  }
  const body = {
    amount: Math.round(amountInr * 100),
    currency: 'INR',
    accept_partial: false,
    reference_id: `${orderId}-${seq}-${Date.now().toString(36)}`.slice(0, 40),
    description: description.slice(0, 200),
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: `${origin}/c/${orderId}`,
    callback_method: 'get',
    notes: { order_id: orderId, seq: String(seq) },
  };
  if (customer?.name) body.customer = { name: customer.name };
  if (customer?.phone && customer.phone.length === 12) body.customer = { ...body.customer, contact: '+' + customer.phone };
  const link = await rz('/payment_links', 'POST', body);
  return { id: link.id, short_url: link.short_url, mock: false };
}

export async function cancelLink(linkId) {
  if (!live || linkId.startsWith('plink_mock_')) return { status: 'cancelled' };
  return rz(`/payment_links/${linkId}/cancel`, 'POST');
}

export async function fetchLink(linkId) {
  if (!live || linkId.startsWith('plink_mock_')) return null;
  return rz(`/payment_links/${linkId}`);
}

export async function refund(paymentId, amountInr) {
  if (!live || paymentId.startsWith('pay_mock_')) return { simulated: true };
  return rz(`/payments/${paymentId}/refund`, 'POST', { amount: Math.round(amountInr * 100) });
}

export function verifyWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
