// Turns order events into notifications for the seller. Pure, so the app shell and the page can share it.
import { inr } from './format';

export function buildNotifications(orders) {
  const out = [];
  for (const o of orders) {
    if (o.sample) continue;
    const name = o.customer.name;
    const first = name.split(' ')[0];
    const lastClaim = o.events.map((e, i) => (e.type === 'claim_made' ? i : -1)).filter((i) => i >= 0).pop();
    const lastReq = o.events.map((e, i) => (e.type === 'change_requested' ? i : -1)).filter((i) => i >= 0).pop();
    const lastDue = o.events.map((e, i) => (e.type === 'milestone_unlocked' || e.type === 'ready' ? i : -1)).filter((i) => i >= 0).pop();
    const dueOpen = !!o.d && o.d.dueNow > 0 && !o.activeRequest && !['cancelled', 'delivered'].includes(o.stage);
    const claimOpen = (o.claims || []).some((c) => c.status === 'pending');
    const reqOpen = (o.changeRequests || []).some((c) => c.status === 'open');
    if (o.d && o.d.auto && o.d.autoDate && !o.events.some((e) => e.type === 'milestone_unlocked' && e.data?.name === o.d.step.name)) {
      out.push({ id: `${o.id}:auto:${o.d.step.key}`, at: new Date(`${o.d.autoDate}T00:00:00+05:30`).toISOString(), orderId: o.id, kind: 'due', action: dueOpen, text: '{amt} to collect from {name} today ({step})', params: { amt: inr(o.d.dueNow), name: first, step: o.d.step.name } });
    }
    o.events.forEach((e, i) => {
      const base = { id: `${o.id}:${i}`, at: e.at, orderId: o.id };
      const d = e.data || {};
      if (e.type === 'milestone_unlocked') out.push({ ...base, kind: 'due', action: dueOpen && i === lastDue, text: '{amt} to collect from {name} today ({step})', params: { amt: inr(d.amount), name: first, step: d.name } });
      else if (e.type === 'ready') out.push({ ...base, kind: 'due', action: dueOpen && i === lastDue, text: '{name}\'s order is ready. {amt} to collect before dispatch', params: { amt: inr(d.due || 0), name: first } });
      else if (e.type === 'payment') out.push({ ...base, kind: 'paid', text: '{amt} received from {name} through Razorpay', params: { amt: inr(d.amount), name } });
      else if (e.type === 'claim_made') out.push({ ...base, kind: 'verify', action: claimOpen && i === lastClaim, text: '{name} says they paid {amt} outside Razorpay. Please verify it.', params: { amt: inr(d.amount), name: first } });
      else if (e.type === 'claim_confirmed') out.push({ ...base, kind: 'paid', text: 'You confirmed {amt} from {name}', params: { amt: inr(d.amount), name: first } });
      else if (e.type === 'change_requested') out.push({ ...base, kind: 'change', action: reqOpen && i === lastReq, text: '{name} asked for a change: {note}', params: { name: first, note: d.note } });
      else if (e.type === 'version_accepted') out.push({ ...base, kind: 'ok', text: '{name} approved the new total of {amt}', params: { name: first, amt: inr(d.to) } });
      else if (e.type === 'version_declined') out.push({ ...base, kind: 'warn', text: '{name} said not now to the change', params: { name: first } });
      else if (e.type === 'accepted') out.push({ ...base, kind: 'ok', text: '{name} accepted the order', params: { name: first } });
    });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
