// Pure order logic shared by the server and the browser.
import { todayIST } from './format';

export const PLANS = {
  '50-50': {
    label: '50 / 50',
    steps: [
      { pct: 50, key: 'advance', name: 'Advance' },
      { pct: 50, key: 'before_dispatch', name: 'Before dispatch' },
    ],
  },
  '40-30-30': {
    label: '40 / 30 / 30',
    steps: [
      { pct: 40, key: 'advance', name: 'Advance' },
      { pct: 30, key: 'frame_ready', name: 'Frame ready' },
      { pct: 30, key: 'before_dispatch', name: 'Before dispatch' },
    ],
  },
};

export const DEFAULT_TERMS =
  'Made to order. The advance pays for materials and is not refundable once work has started. The balance is due before dispatch. Changes in size, fabric or design are added as a new version with a new price that you accept first.';

// Cumulative amount that must be paid by the end of each stage. Stages that are already fully paid keep
// their old target when the price changes, so a change adds to the later stages and never re-asks for the advance.
export function cumTargets(total, plan, frozen = {}) {
  const steps = PLANS[plan].steps;
  let acc = 0;
  let prev = 0;
  return steps.map((s, i) => {
    acc += s.pct;
    let v = i === steps.length - 1 ? total : frozen[i] ?? Math.round((total * acc) / 100);
    if (i < steps.length - 1) v = Math.min(v, total);
    v = Math.max(v, Math.min(prev, total));
    prev = v;
    return v;
  });
}

export function frozenAfter(o) {
  const d = derive(o);
  const out = {};
  d.cum.forEach((c, i) => {
    if (i < d.steps.length - 1 && d.paid >= c) out[i] = c;
  });
  return out;
}

export function derive(o) {
  const steps = PLANS[o.plan].steps;
  const cum = cumTargets(o.total, o.plan, o.frozen || {});
  const paid = o.payments.reduce((a, p) => a + p.amount, 0);
  const idx = Math.min(o.unlocked, steps.length) - 1;
  const dueNow = Math.max(0, cum[idx] - paid);
  const remaining = Math.max(0, o.total - paid);
  const refundDue = Math.max(0, paid - o.total);
  const nextAmount = idx + 1 < steps.length ? Math.max(0, cum[idx + 1] - Math.max(paid, cum[idx])) : 0;
  return {
    steps,
    cum,
    paid,
    idx,
    step: steps[idx],
    dueNow,
    remaining,
    refundDue,
    nextAmount,
    nextStep: steps[idx + 1] || null,
    pendingVersion: (o.versions || []).find((v) => v.status === 'proposed' && v.n > 1) || null,
  };
}

// Which list an order belongs to on the Orders screen.
export function bucket(o, today = todayIST()) {
  const d = o.d || derive(o);
  if (o.stage === 'cancelled') return 'cancelled';
  if (o.stage === 'awaiting_acceptance') return 'waiting';
  if (o.cod && o.cod.state === 'with_courier') return 'courier';
  if (o.stage === 'delivered' && d.remaining === 0) return 'done';
  if (d.dueNow > 0) {
    if (o.collectOn < today) return 'overdue';
    if (o.collectOn === today) return 'today';
    return 'upcoming';
  }
  if (o.stage === 'ready') return 'dispatch';
  if (o.stage === 'dispatched') return 'transit';
  if (o.stage === 'delivered') return 'done';
  return 'making';
}

export const BUCKET_ORDER = ['overdue', 'today', 'dispatch', 'courier', 'waiting', 'upcoming', 'making', 'transit', 'done', 'cancelled'];
