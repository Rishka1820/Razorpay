// Phone notifications for the seller (Web Push). Keys are created once and kept in storage, so no setup is needed.
import webpush from 'web-push';
import { kvGet, kvSet } from './db';
import { buildNotifications } from './notify';

async function keys() {
  let k = await kvGet('vapid');
  if (!k) {
    k = webpush.generateVAPIDKeys();
    await kvSet('vapid', k);
  }
  return k;
}

export async function publicKey() {
  return (await keys()).publicKey;
}

export async function addSubscription(sub) {
  if (!sub?.endpoint) throw Object.assign(new Error('Invalid subscription'), { status: 400 });
  const list = ((await kvGet('push_subs')) || []).filter((s) => s.endpoint !== sub.endpoint);
  list.push(sub);
  await kvSet('push_subs', list.slice(-20));
}

export async function removeSubscription(endpoint) {
  await kvSet('push_subs', ((await kvGet('push_subs')) || []).filter((s) => s.endpoint !== endpoint));
}

export async function sendToSeller(payload) {
  const list = (await kvGet('push_subs')) || [];
  if (!list.length) return 0;
  const k = await keys();
  webpush.setVapidDetails('mailto:orders@razorpay-orderbook.app', k.publicKey, k.privateKey);
  const dead = new Set();
  let sent = 0;
  await Promise.allSettled(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 3600 });
        sent += 1;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) dead.add(s.endpoint);
      }
    })
  );
  if (dead.size) await kvSet('push_subs', list.filter((s) => !dead.has(s.endpoint)));
  return sent;
}

const fill = (text, params = {}) => text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');

// Sends a phone notification for events the customer (or the system) caused after position `from`.
export async function pushNewEvents(o, from) {
  try {
    const items = buildNotifications([{ ...o, sample: false }]).filter((n) => {
      const i = Number(n.id.split(':')[1]);
      const e = o.events[i];
      return Number.isInteger(i) && i >= from && e && e.by !== 'owner' && e.by !== 'staff';
    });
    for (const n of items.reverse()) {
      await sendToSeller({ title: 'Razorpay OrderBook', body: fill(n.text, n.params), url: `/orders/${o.id}`, tag: n.id });
    }
  } catch {}
}
