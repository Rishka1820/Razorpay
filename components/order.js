'use client';
import Link from 'next/link';
import { Pill, useApp } from './kit';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';
import { bucket, PLANS } from '@/lib/model';

export const STEP_LABEL = { advance: 'Advance', frame_ready: 'Midway', before_dispatch: 'Before dispatch' };

export function statusChip(o, t) {
  const b = bucket(o, o.today);
  const map = {
    verify: ['warn', 'Verify payment'],
    request: ['warn', 'Change requested'],
    overdue: ['bad', 'Overdue'],
    today: ['info', 'Collect today'],
    dispatch: ['ok', 'Ready to dispatch'],
    courier: ['warn', 'Cash with courier'],
    waiting: ['warn', 'Waiting for customer'],
    upcoming: ['info', 'Payment coming up'],
    making: ['', 'In the making'],
    transit: ['', 'On the way'],
    done: ['ok', 'Done'],
    cancelled: ['bad', 'Cancelled'],
  };
  const [tone, label] = map[b];
  return <Pill tone={tone}>{t(label)}</Pill>;
}

export function Steps({ o }) {
  const { t } = useApp();
  const d = o.d;
  const n = d.steps.length;
  let prev = 0;
  const segs = d.steps.map((s, i) => {
    const from = prev;
    const to = d.cum[i];
    prev = to;
    const filled = Math.max(0, Math.min(d.paid, to) - from);
    const size = to - from;
    let cls = 'seg1';
    let style;
    if (filled >= size) cls += ' paid';
    else if (filled > 0) {
      cls += ' part';
      style = { '--w': `${(filled / size) * 100}%` };
    } else if (i === d.idx && d.dueNow > 0) cls += ' due';
    return { cls, style, size, name: s.name, to };
  });
  const cols = { gridTemplateColumns: segs.map((s) => `${s.size}fr`).join(' ') };
  return (
    <div className="steps" aria-label="Payment progress">
      <div style={{ display: 'grid', gap: 4, ...cols }}>
        {segs.map((s, i) => <div key={i} className={s.cls} style={s.style} />)}
      </div>
      <div className="steplabels" style={cols}>
        {segs.map((s, i) => <div key={i}>{t(s.name)}<br /><b style={{ fontWeight: 600 }}>{inr(s.to)}</b></div>)}
      </div>
    </div>
  );
}

export function OrderRow({ o }) {
  const { t } = useApp();
  const d = o.d;
  const b = bucket(o, o.today);
  const showDue = ['overdue', 'today', 'upcoming'].includes(b);
  return (
    <Link href={`/orders/${o.id}`} className="orow">
      <div className="avatar">{o.customer.name.slice(0, 1).toUpperCase()}</div>
      <div className="grow">
        <div className="bold trunc">{o.customer.name}</div>
        <div className="small muted trunc">{o.item}</div>
        <div style={{ marginTop: 4 }}>{statusChip(o, t)}</div>
      </div>
      <div className="amt">
        {showDue ? (
          <>
            <div style={{ fontSize: 16 }}>{inr(d.dueNow)}</div>
            <div className="tiny muted" style={{ fontWeight: 500 }}>{t(d.step.name)}</div>
          </>
        ) : b === 'courier' ? (
          <>
            <div style={{ fontSize: 16 }}>{inr(o.cod.amount)}</div>
            <div className="tiny muted" style={{ fontWeight: 500 }}>{t('with courier')}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16 }}>{inr(o.total)}</div>
            <div className="tiny muted" style={{ fontWeight: 500 }}>{d.remaining > 0 ? t('{amt} to go', { amt: inr(d.remaining) }) : t('paid')}</div>
          </>
        )}
      </div>
    </Link>
  );
}

const METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', cash: 'Cash', upi_personal: 'Personal UPI', bank: 'Bank transfer', cod_cash: 'Cash on delivery' };
export const methodLabel = (m, t) => t(METHOD[m] || m || 'Payment');

export function eventLine(e, t, o) {
  const d = e.data || {};
  const A = (n) => inr(n);
  switch (e.type) {
    case 'created': return t('Order created from {src}', { src: t(d.source === 'bill' ? 'a bill photo' : d.source === 'chat' ? 'a chat' : 'scratch') });
    case 'bill_advance': return t('Advance {amt} recorded from the bill ({m})', { amt: A(d.amount), m: methodLabel(d.method, t) });
    case 'shared': return t(d.kind === 'remind' ? 'Payment reminder sent' : d.kind === 'pay' ? 'Payment request sent to the customer' : d.kind === 'change' ? 'Change sent for approval' : 'Order link shared');
    case 'called': return t('You called the customer');
    case 'accepted': return t('Customer accepted the order and terms');
    case 'request_created': return t('Payment request sent: {amt} ({step})', { amt: A(d.amount), step: t(d.step) });
    case 'request_replaced': return t('Old request for {amt} cancelled and replaced', { amt: A(d.amount) });
    case 'request_closed': return t('Payment request for {amt} closed', { amt: A(d.amount) });
    case 'payment': return t('{amt} received via Razorpay ({m})', { amt: A(d.amount), m: methodLabel(d.method, t) }) + (d.stale ? ' · ' + t('paid on an older link') : '');
    case 'change_requested': return t('Customer asked for a change: {note}', { note: d.note });
    case 'change_request_declined': return t('You said no to the change request');
    case 'claim_made': return t('Customer says they paid {amt} directly by UPI', { amt: A(d.amount) });
    case 'claim_confirmed': return t('You confirmed {amt} received by UPI', { amt: A(d.amount) });
    case 'claim_rejected': return t('You marked {amt} as not received', { amt: A(d.amount) });
    case 'overpaid': return t('The customer paid {amt} more than the total. It needs to be refunded.', { amt: A(d.amount) });
    case 'manual_payment': return t('{amt} recorded by you ({m})', { amt: A(d.amount), m: methodLabel(d.method, t) });
    case 'version_proposed': return t('Change proposed: {from} to {to}', { from: A(d.from), to: A(d.to) });
    case 'version_accepted': return t('Customer accepted the change: {from} to {to}', { from: A(d.from), to: A(d.to) });
    case 'version_declined': return t('Customer declined the change');
    case 'balance_recalculated': return t('Amount due recalculated: {was} to {now}', { was: A(d.was), now: A(d.now) });
    case 'milestone_unlocked': return t('{name} stage reached: {amt} now due', { name: t(d.name), amt: A(d.amount) });
    case 'ready': return t('Marked ready, photo {p}', { p: t(d.hasPhoto ? 'added' : 'not added') });
    case 'fulfilment_set': return t('Delivery set to: {m}', { m: t(d.mode === 'cod' ? 'Pay on delivery' : d.mode === 'pickup' ? 'Pickup' : 'Pay before dispatch') });
    case 'dispatched': return d.cod ? t('Dispatched with {c}. {amt} to be paid on delivery', { c: d.courier, amt: A(d.cod) }) : t('Dispatched with {c}', { c: d.courier });
    case 'courier_collected': return t('Courier collected {amt} in cash', { amt: A(d.amount) });
    case 'remittance_received': return t('Courier payment of {amt} reached you', { amt: A(d.amount) });
    case 'delivered': return t('Delivered');
    case 'cancelled': return t('Order cancelled. Refunded {r}, kept {k}', { r: A(d.refunded), k: A(d.kept) });
    default: return e.type;
  }
}

export function eventTone(type) {
  if (['payment', 'claim_confirmed', 'accepted', 'version_accepted', 'remittance_received', 'delivered'].includes(type)) return 'ok';
  if (['manual_payment', 'bill_advance', 'courier_collected', 'overpaid', 'claim_made', 'claim_rejected', 'change_requested'].includes(type)) return 'warn';
  if (['request_created', 'version_proposed', 'dispatched'].includes(type)) return 'blue';
  return '';
}

export function Timeline({ o }) {
  const { t } = useApp();
  const items = [...o.events].reverse();
  return (
    <div className="tl">
      {items.map((e, i) => (
        <div className="it" key={i}>
          <span className={`dot ${eventTone(e.type)}`} />
          <div className="grow">
            <div style={{ fontSize: 13.5 }}>{eventLine(e, t, o)}</div>
            <div className="tiny muted">{fmtDateTime(e.at)} · {t(e.by === 'razorpay' ? 'Razorpay' : e.by === 'customer' ? 'Customer' : e.by === 'staff' ? 'Staff' : e.by === 'system' ? 'Automatic' : 'Owner')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaymentList({ o }) {
  const { t } = useApp();
  if (!o.payments.length) return <div className="small muted">{t('No payments yet')}</div>;
  return (
    <div className="col" style={{ gap: 10 }}>
      {o.payments.map((p) => (
        <div className="row between" key={p.id} style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="bold num">{inr(p.amount)}</div>
            <div className="tiny muted trunc">{methodLabel(p.method, t)} · {fmtDateTime(p.at)}</div>
          </div>
          {p.source === 'razorpay' ? <Pill tone="ok">{t('Confirmed by Razorpay')}</Pill> : <Pill tone="warn">{t('Recorded by you')}</Pill>}
        </div>
      ))}
    </div>
  );
}

export function VersionList({ o }) {
  const { t } = useApp();
  const tone = { accepted: 'ok', proposed: 'info', declined: 'bad', withdrawn: '' };
  return (
    <div className="col" style={{ gap: 10 }}>
      {o.versions.map((v) => (
        <div className="row between" key={v.n} style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="bold num">v{v.n} · {inr(v.total)}</div>
            <div className="tiny muted">{v.note}{v.acceptedAt ? ` · ${t('accepted')} ${fmtDateTime(v.acceptedAt)}` : ''}</div>
          </div>
          <Pill tone={tone[v.status]}>{t(v.status === 'proposed' && v.n === 1 ? 'Awaiting acceptance' : v.status[0].toUpperCase() + v.status.slice(1))}</Pill>
        </div>
      ))}
    </div>
  );
}

export function shareMessage(o, kind, origin) {
  const url = `${origin}/c/${o.id}`;
  const name = o.customer.name.split(' ')[0];
  const d = o.d;
  if (kind === 'order') return `Hi ${name}, here is your order for ${o.item} (${inr(o.total)}). Please open it, check the details and tap Accept: ${url}`;
  if (kind === 'change') return `Hi ${name}, I have added the change we discussed. The new total is ${inr(d.pendingVersion ? d.pendingVersion.total : o.total)}. Please check and accept it here: ${url}`;
  if (kind === 'remind') {
    const link = o.activeRequest?.url || url;
    const due = o.collectOn ? ` (due ${fmtDate(o.collectOn)})` : '';
    return `Hi ${name}, a gentle reminder: ${inr(o.activeRequest?.amount ?? d.dueNow)} for your ${o.item}${due}. You can pay here: ${link}\nIf you have already paid, please reply here and I will check.`;
  }
  if (kind === 'pay') {
    const link = o.activeRequest?.url || url;
    if (o.stage === 'ready') return `Hi ${name}, your ${o.item} is ready! Photo and details are here: ${url}\nPlease pay ${inr(o.activeRequest?.amount ?? d.dueNow)} to dispatch: ${link}`;
    return `Hi ${name}, ${inr(o.activeRequest?.amount ?? d.dueNow)} is due for your ${o.item} (${t0(d.step.name)}). Pay here: ${link}`;
  }
  return url;
}
const t0 = (s) => s;
