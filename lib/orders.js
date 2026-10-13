// Server-side order logic. The order owns the money: every payment, request and change is recorded on it.
import crypto from 'crypto';
import * as db from './db';
import * as rz from './razorpay';
import { PLANS, DEFAULT_TERMS, derive, frozenAfter } from './model';
import { todayIST, dayOf, normPhone, inr } from './format';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const rid = (p) => p + crypto.randomBytes(5).toString('hex');
const nowISO = () => new Date().toISOString();

export function ev(o, type, by, data = {}, at) {
  o.events.push({ type, by, at: at || nowISO(), data });
  o.updatedAt = nowISO();
}

export function present(o) {
  return { ...o, d: derive(o), today: todayIST() };
}

/* ---------- create ---------- */

export function buildOrder(i) {
  const total = Math.round(Number(i.total));
  if (!i.customer?.name?.trim()) throw new HttpError(400, 'Add the customer name');
  if (!i.item?.trim()) throw new HttpError(400, 'Add what is being made');
  if (!(total > 0)) throw new HttpError(400, 'Add the agreed total');
  const plan = PLANS[i.plan] ? i.plan : '50-50';
  const at = nowISO();
  const o = {
    id: crypto.randomBytes(4).toString('hex'),
    sample: !!i.sample,
    createdAt: at,
    updatedAt: at,
    customer: { name: i.customer.name.trim(), phone: normPhone(i.customer.phone) },
    item: i.item.trim(),
    plan,
    total,
    versions: [{ n: 1, total, note: 'Original order', status: 'proposed', at }],
    terms: i.terms?.trim() || DEFAULT_TERMS,
    deliveryDate: i.deliveryDate || null,
    stage: 'awaiting_acceptance',
    unlocked: 1,
    collectOn: todayIST(),
    source: i.source || 'manual',
    payments: [],
    activeRequest: null,
    seq: 0,
    fulfilment: 'prepaid',
    photo: null,
    dispatch: null,
    cod: null,
    refunds: [],
    events: [],
  };
  ev(o, 'created', 'owner', { source: o.source, createMs: i.createMs || null }, at);
  const adv = Math.round(Number(i.advance?.amount) || 0);
  if (adv > 0) {
    if (adv > total) throw new HttpError(400, 'The advance is more than the total');
    o.payments.push({ id: rid('rec_'), amount: adv, source: 'merchant', method: i.advance.method || 'cash', ref: i.advance.ref || 'Taken in store', stepKey: 'advance', at });
    o.stage = 'making';
    o.acceptedAt = at;
    o.acceptedVia = 'bill';
    o.versions[0].status = 'accepted';
    ev(o, 'bill_advance', 'owner', { amount: adv, method: i.advance.method || 'cash' }, at);
  }
  return o;
}

export async function createOrder(input) {
  const o = buildOrder(input);
  await db.saveOrder(o);
  return o;
}

/* ---------- payment requests ---------- */

async function openRequest(o, by, ctx) {
  const d = derive(o);
  if (d.dueNow <= 0) throw new HttpError(400, 'Nothing is due on this order right now');
  await closeRequest(o, 'replaced', by);
  const d2 = derive(o);
  if (d2.dueNow <= 0) throw new HttpError(400, 'That payment has just come in');
  o.seq += 1;
  const link = await rz.createLink({
    amountInr: d2.dueNow,
    orderId: o.id,
    seq: o.seq,
    description: `${o.item} · ${d2.step.name}`,
    customer: o.customer,
    origin: ctx.origin,
  });
  o.activeRequest = { linkId: link.id, url: link.short_url, amount: d2.dueNow, stepKey: d2.step.key, stepName: d2.step.name, at: nowISO(), collectOn: o.collectOn, mock: !!link.mock };
  ev(o, 'request_created', by, { amount: d2.dueNow, step: d2.step.name });
}

async function closeRequest(o, reason, by) {
  if (!o.activeRequest) return;
  await syncRequest(o);
  if (!o.activeRequest) return; // it was paid while we were looking
  const r = o.activeRequest;
  try {
    await rz.cancelLink(r.linkId);
  } catch (e) {
    await syncRequest(o);
    if (!o.activeRequest) return;
  }
  o.activeRequest = null;
  ev(o, reason === 'replaced' ? 'request_replaced' : 'request_closed', by, { amount: r.amount, reason });
}

export function applyPayment(o, { id, amountInr, method, linkId }) {
  if (o.payments.some((p) => p.id === id)) return false;
  const matches = o.activeRequest && o.activeRequest.linkId === linkId;
  const d = derive(o);
  const payment = { id, amount: amountInr, source: 'razorpay', method: method || 'upi', ref: id, linkId, stepKey: matches ? o.activeRequest.stepKey : d.step.key, at: nowISO() };
  if (!matches) payment.stale = true;
  o.payments.push(payment);
  const requestedAt = matches ? o.activeRequest.at : null;
  const collectOn = matches ? o.activeRequest.collectOn : null;
  if (matches) o.activeRequest = null;
  ev(o, 'payment', 'razorpay', { amount: amountInr, method: payment.method, ref: id, step: payment.stepKey, requestedAt, collectOn, stale: !!payment.stale });
  const d2 = derive(o);
  if (d2.refundDue > 0) ev(o, 'overpaid', 'system', { amount: d2.refundDue });
  return true;
}

// Asks Razorpay whether the open link has been paid. Covers a late or missed webhook.
export async function syncRequest(o) {
  if (!o.activeRequest || o.activeRequest.mock || !rz.live) return false;
  let link;
  try {
    link = await rz.fetchLink(o.activeRequest.linkId);
  } catch {
    return false;
  }
  if (!link || link.status !== 'paid') return false;
  let changed = false;
  for (const p of link.payments || []) {
    if (p.status && p.status !== 'captured') continue;
    changed = applyPayment(o, { id: p.payment_id, amountInr: p.amount / 100, method: p.method, linkId: link.id }) || changed;
  }
  return changed;
}

export async function getFresh(id) {
  const o = await db.getOrder(id);
  if (!o) throw new HttpError(404, 'Order not found');
  if (await syncRequest(o)) await db.saveOrder(o);
  return o;
}

/* ---------- merchant actions ---------- */

const OWNER_ONLY = new Set(['propose_version', 'cancel']);

export async function merchantAction(id, type, p = {}, ctx) {
  const by = ctx.role;
  if (OWNER_ONLY.has(type) && by !== 'owner') throw new HttpError(403, 'Only the owner can do this');
  const o = await getFresh(id);
  const d = derive(o);
  if (o.stage === 'cancelled') throw new HttpError(400, 'This order is cancelled');

  switch (type) {
    case 'shared':
      ev(o, 'shared', by, { kind: p.kind || 'order' });
      break;

    case 'request_payment':
      if (o.stage === 'awaiting_acceptance') throw new HttpError(400, 'The customer has not accepted the order yet');
      await openRequest(o, by, ctx);
      break;

    case 'cancel_request':
      if (!o.activeRequest) throw new HttpError(400, 'There is no open request');
      await closeRequest(o, 'cancelled', by);
      break;

    case 'record_manual': {
      const amount = Math.round(Number(p.amount));
      if (!(amount > 0)) throw new HttpError(400, 'Enter the amount received');
      if (amount > d.remaining) throw new HttpError(400, 'That is more than this order still owes');
      if (!['cash', 'upi_personal'].includes(p.method)) throw new HttpError(400, 'Choose how it was paid');
      await closeRequest(o, 'replaced', by);
      o.payments.push({ id: rid('rec_'), amount, source: 'merchant', method: p.method, ref: (p.ref || '').slice(0, 60) || 'No reference', stepKey: derive(o).step.key, at: nowISO() });
      ev(o, 'manual_payment', by, { amount, method: p.method, ref: p.ref || '' });
      break;
    }

    case 'confirm_claim': {
      const c = (o.claims || []).find((x) => x.id === p.claimId && x.status === 'pending');
      if (!c) throw new HttpError(400, 'That payment note is no longer open');
      if (c.amount > d.remaining) throw new HttpError(400, 'That is more than this order still owes');
      await closeRequest(o, 'replaced', by);
      o.payments.push({ id: rid('rec_'), amount: c.amount, source: 'merchant', method: 'upi_personal', ref: c.ref || 'Customer said paid', stepKey: derive(o).step.key, claimId: c.id, at: nowISO() });
      c.status = 'confirmed';
      c.resolvedAt = nowISO();
      ev(o, 'claim_confirmed', by, { amount: c.amount, ref: c.ref || '' });
      break;
    }

    case 'reject_claim': {
      const c = (o.claims || []).find((x) => x.id === p.claimId && x.status === 'pending');
      if (!c) throw new HttpError(400, 'That payment note is no longer open');
      c.status = 'rejected';
      c.resolvedAt = nowISO();
      ev(o, 'claim_rejected', by, { amount: c.amount });
      break;
    }

    case 'propose_version': {
      if (!['making', 'ready'].includes(o.stage)) throw new HttpError(400, 'Changes can be proposed while the order is being made');
      const total = Math.round(Number(p.total));
      if (!(total > 0)) throw new HttpError(400, 'Enter the new total');
      if (total === o.total) throw new HttpError(400, 'The total is the same as now');
      o.versions.forEach((v) => {
        if (v.status === 'proposed' && v.n > 1) v.status = 'withdrawn';
      });
      const n = o.versions.length + 1;
      o.versions.push({ n, total, note: (p.note || '').slice(0, 200) || 'Change to the order', status: 'proposed', at: nowISO() });
      ev(o, 'version_proposed', by, { n, from: o.total, to: total, note: p.note || '' });
      break;
    }

    case 'unlock_next': {
      if (o.stage !== 'making' || !d.nextStep) throw new HttpError(400, 'There is no next stage to request');
      o.unlocked += 1;
      o.collectOn = todayIST();
      ev(o, 'milestone_unlocked', by, { name: d.nextStep.name, amount: derive(o).dueNow });
      break;
    }

    case 'mark_ready': {
      if (o.stage !== 'making') throw new HttpError(400, 'This order is not in the making stage');
      o.stage = 'ready';
      o.unlocked = d.steps.length;
      o.collectOn = todayIST();
      o.photo = typeof p.photo === 'string' && p.photo.startsWith('data:image/') && p.photo.length < 900000 ? p.photo : null;
      o.fulfilment = ['prepaid', 'cod', 'pickup'].includes(p.mode) ? p.mode : 'prepaid';
      ev(o, 'ready', by, { mode: o.fulfilment, due: derive(o).dueNow, hasPhoto: !!o.photo });
      break;
    }

    case 'set_fulfilment': {
      if (o.stage !== 'ready') throw new HttpError(400, 'Choose this once the piece is ready');
      if (!['prepaid', 'cod', 'pickup'].includes(p.mode)) throw new HttpError(400, 'Unknown delivery option');
      o.fulfilment = p.mode;
      ev(o, 'fulfilment_set', by, { mode: p.mode });
      break;
    }

    case 'dispatch': {
      if (o.stage !== 'ready') throw new HttpError(400, 'Mark the piece ready first');
      const courier = (p.courier || '').trim();
      if (o.fulfilment !== 'pickup' && !courier) throw new HttpError(400, 'Add the courier name');
      if (d.remaining > 0 && o.fulfilment !== 'cod') throw new HttpError(400, `Collect ${inr(d.remaining)} first, or switch to pay on delivery`);
      o.dispatch = { courier: o.fulfilment === 'pickup' ? 'Studio pickup' : courier, tracking: (p.tracking || '').trim(), at: nowISO() };
      if (d.remaining > 0) o.cod = { amount: d.remaining, state: 'pending' };
      o.stage = 'dispatched';
      ev(o, 'dispatched', by, { courier: o.dispatch.courier, tracking: o.dispatch.tracking, cod: d.remaining > 0 ? d.remaining : 0 });
      break;
    }

    case 'courier_collected': {
      if (!o.cod || o.cod.state !== 'pending') throw new HttpError(400, 'No cash is waiting to be collected');
      await closeRequest(o, 'closed', by);
      o.cod.state = 'with_courier';
      o.cod.collectedAt = nowISO();
      ev(o, 'courier_collected', by, { amount: o.cod.amount });
      break;
    }

    case 'remittance_received': {
      if (!o.cod || o.cod.state !== 'with_courier') throw new HttpError(400, 'The courier has not collected cash yet');
      o.payments.push({ id: rid('rec_'), amount: o.cod.amount, source: 'merchant', method: 'cod_cash', ref: (p.ref || '').slice(0, 60) || 'Courier remittance', stepKey: 'before_dispatch', at: nowISO() });
      o.cod.state = 'remitted';
      o.cod.remittedAt = nowISO();
      ev(o, 'remittance_received', by, { amount: o.cod.amount, ref: p.ref || '', collectedAt: o.cod.collectedAt });
      break;
    }

    case 'deliver': {
      if (o.stage !== 'dispatched') throw new HttpError(400, 'This order has not been dispatched');
      o.stage = 'delivered';
      ev(o, 'delivered', by, {});
      break;
    }

    case 'cancel': {
      await closeRequest(o, 'closed', by);
      const paid = d.paid;
      const refundAmount = Math.max(0, Math.min(paid, Math.round(Number(p.refundAmount) || 0)));
      let left = refundAmount;
      const results = [];
      for (const pay of [...o.payments].reverse()) {
        if (left <= 0) break;
        const part = Math.min(left, pay.amount);
        if (pay.source === 'razorpay') {
          try {
            const r = await rz.refund(pay.id, part);
            results.push({ id: pay.id, amount: part, simulated: !!r.simulated });
          } catch (e) {
            results.push({ id: pay.id, amount: part, error: e.message });
          }
        } else {
          results.push({ id: pay.id, amount: part, manual: true });
        }
        left -= part;
      }
      o.refunds = results;
      o.stage = 'cancelled';
      ev(o, 'cancelled', by, { paid, refunded: refundAmount, kept: paid - refundAmount, failed: results.filter((r) => r.error).length });
      break;
    }

    default:
      throw new HttpError(400, 'Unknown action');
  }
  await db.saveOrder(o);
  return o;
}

/* ---------- customer actions ---------- */

export async function customerAction(id, type, p = {}, ctx) {
  const o = await getFresh(id);
  if (o.stage === 'cancelled') throw new HttpError(400, 'This order was cancelled');
  switch (type) {
    case 'accept': {
      if (o.stage !== 'awaiting_acceptance') throw new HttpError(400, 'This order is already accepted');
      o.stage = 'making';
      o.acceptedAt = nowISO();
      o.acceptedVia = 'link';
      o.versions[0].status = 'accepted';
      o.versions[0].acceptedAt = o.acceptedAt;
      ev(o, 'accepted', 'customer', { version: 1, total: o.total });
      if (derive(o).dueNow > 0) await openRequest(o, 'system', ctx);
      break;
    }
    case 'accept_version': {
      const v = o.versions.find((x) => x.n === Number(p.n));
      if (!v || v.status !== 'proposed' || v.n === 1) throw new HttpError(400, 'That change is no longer open');
      const from = o.total;
      o.frozen = { ...(o.frozen || {}), ...frozenAfter(o) };
      v.status = 'accepted';
      v.acceptedAt = nowISO();
      o.total = v.total;
      ev(o, 'version_accepted', 'customer', { n: v.n, from, to: v.total });
      if (o.activeRequest) {
        const stale = o.activeRequest.amount;
        await closeRequest(o, 'replaced', 'system');
        if (derive(o).dueNow > 0) await openRequest(o, 'system', ctx);
        ev(o, 'balance_recalculated', 'system', { was: stale, now: derive(o).dueNow });
      }
      break;
    }
    case 'claim_paid': {
      if (o.stage === 'awaiting_acceptance') throw new HttpError(400, 'Accept the order first');
      const d = derive(o);
      const amount = Math.round(Number(p.amount) || d.dueNow);
      if (!(amount > 0) || amount > d.remaining) throw new HttpError(400, 'Enter the amount you paid');
      o.claims = (o.claims || []).map((c) => (c.status === 'pending' ? { ...c, status: 'withdrawn', resolvedAt: nowISO() } : c));
      o.claims.push({ id: rid('clm_'), amount, ref: (p.ref || '').slice(0, 40), status: 'pending', at: nowISO() });
      ev(o, 'claim_made', 'customer', { amount, ref: p.ref || '' });
      break;
    }
    case 'decline_version': {
      const v = o.versions.find((x) => x.n === Number(p.n));
      if (!v || v.status !== 'proposed' || v.n === 1) throw new HttpError(400, 'That change is no longer open');
      v.status = 'declined';
      ev(o, 'version_declined', 'customer', { n: v.n });
      break;
    }
    default:
      throw new HttpError(400, 'Unknown action');
  }
  await db.saveOrder(o);
  return o;
}

/* ---------- webhook and simulated checkout ---------- */

export async function handleRazorpayEvent(evt) {
  if (evt.event !== 'payment_link.paid') return { ignored: true };
  const pl = evt.payload?.payment_link?.entity;
  const pay = evt.payload?.payment?.entity;
  const orderId = pl?.notes?.order_id;
  if (!pl || !pay || !orderId) return { ignored: true };
  const o = await db.getOrder(orderId);
  if (!o) return { ignored: true };
  const changed = applyPayment(o, { id: pay.id, amountInr: pay.amount / 100, method: pay.method, linkId: pl.id });
  if (changed) await db.saveOrder(o);
  return { applied: changed };
}

export function mockOrderId(linkId) {
  return linkId.split('_')[2];
}

export async function mockLinkInfo(linkId) {
  const o = await db.getOrder(mockOrderId(linkId));
  if (!o) throw new HttpError(404, 'Link not found');
  const active = o.activeRequest && o.activeRequest.linkId === linkId;
  return { orderId: o.id, item: o.item, customer: o.customer.name, active, amount: active ? o.activeRequest.amount : null, paid: o.payments.some((p) => p.linkId === linkId) };
}

export async function mockPay(linkId) {
  const o = await db.getOrder(mockOrderId(linkId));
  if (!o) throw new HttpError(404, 'Link not found');
  if (!o.activeRequest || o.activeRequest.linkId !== linkId) throw new HttpError(400, 'This payment link is no longer active. Ask the seller for a new one.');
  applyPayment(o, { id: rid('pay_mock_'), amountInr: o.activeRequest.amount, method: 'upi', linkId });
  await db.saveOrder(o);
  return o;
}

/* ---------- metrics ---------- */

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function metrics() {
  const all = (await db.listOrders()).filter((o) => !o.sample);
  const events = all.flatMap((o) => o.events.map((e) => ({ ...e, order: o })));
  const has = (o, t) => o.events.some((e) => e.type === t);
  const funnel = [
    ['Orders created', all.length],
    ['Accepted by customer', all.filter((o) => o.acceptedAt).length],
    ['Advance received', all.filter((o) => o.payments.some((p) => p.stepKey === 'advance')).length],
    ['Marked ready', all.filter((o) => has(o, 'ready')).length],
    ['Fully paid', all.filter((o) => o.payments.length && derive(o).remaining === 0).length],
    ['Dispatched', all.filter((o) => has(o, 'dispatched')).length],
  ];
  const createMs = events.filter((e) => e.type === 'created' && e.data.createMs).map((e) => e.data.createMs / 1000);
  const reqToPaid = events.filter((e) => e.type === 'payment' && e.data.requestedAt).map((e) => (new Date(e.at) - new Date(e.data.requestedAt)) / 1000);
  const dueDated = events.filter((e) => e.type === 'payment' && e.data.collectOn);
  const onTime = dueDated.filter((e) => dayOf(e.at) <= e.data.collectOn).length;
  const manual = events.filter((e) => e.type === 'manual_payment' || e.type === 'bill_advance' || e.type === 'remittance_received').length;
  const rz = events.filter((e) => e.type === 'payment').length;
  const cod = events.filter((e) => e.type === 'remittance_received').map((e) => (new Date(e.at) - new Date(e.data.collectedAt)) / 3600000);
  return {
    orders: all.length,
    funnel,
    timeToCreateSec: median(createMs),
    requestToPaidSec: median(reqToPaid),
    collectedOnTime: dueDated.length ? { done: onTime, of: dueDated.length } : null,
    wrongRequests: events.filter((e) => e.type === 'request_replaced').length,
    overpaid: events.filter((e) => e.type === 'overpaid').length,
    manualShare: manual + rz ? { manual, total: manual + rz } : null,
    codHours: median(cod),
  };
}
