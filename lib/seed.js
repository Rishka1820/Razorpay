// Sample orders so the Today screen has something realistic on first open. Marked as samples; metrics ignore them.
import * as db from './db';
import { buildOrder, ev } from './orders';
import { todayIST, addDays } from './format';

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

function shift(o, hours) {
  // move all timestamps on the order back so the history looks lived in
  const ms = hours * 3600000;
  const mv = (iso) => (iso ? new Date(new Date(iso).getTime() - ms).toISOString() : iso);
  o.createdAt = mv(o.createdAt);
  o.acceptedAt = mv(o.acceptedAt);
  o.events.forEach((e) => (e.at = mv(e.at)));
  o.payments.forEach((p) => (p.at = mv(p.at)));
  o.versions.forEach((v) => (v.at = mv(v.at)));
  return o;
}

export async function seedSamples() {
  const t = todayIST();
  const out = [];

  // 1. Dining table, 40/30/30, frame ready, collect today
  let o = buildOrder({ sample: true, customer: { name: 'Meera Kapoor', phone: '9810055501' }, item: 'Sheesham dining table, 6 seater', total: 42000, plan: '40-30-30', deliveryDate: addDays(t, 14), source: 'chat' });
  o.stage = 'making';
  o.acceptedAt = hoursAgo(220);
  o.versions[0].status = 'accepted';
  o.payments.push({ id: 'pay_sample_1', amount: 16800, source: 'razorpay', method: 'upi', ref: 'pay_sample_1', stepKey: 'advance', at: hoursAgo(216) });
  o.unlocked = 2;
  o.collectOn = t;
  ev(o, 'accepted', 'customer', { version: 1, total: 42000 });
  ev(o, 'payment', 'razorpay', { amount: 16800, method: 'upi', ref: 'pay_sample_1', step: 'advance' });
  ev(o, 'milestone_unlocked', 'owner', { name: 'Frame ready', amount: 12600 });
  out.push(shift(o, 0));

  // 2. Bed, overdue balance
  o = buildOrder({ sample: true, customer: { name: 'Sandeep Rathore', phone: '9929012345' }, item: 'Teak bed with storage, queen', total: 54000, plan: '50-50', deliveryDate: addDays(t, 2), advance: { amount: 27000, method: 'cash', ref: 'Bill 114' }, source: 'bill' });
  o.stage = 'ready';
  o.unlocked = 2;
  o.collectOn = addDays(t, -2);
  ev(o, 'ready', 'owner', { mode: 'prepaid', due: 27000, hasPhoto: false });
  out.push(shift(o, 300));

  // 3. Console, being made
  o = buildOrder({ sample: true, customer: { name: 'Neha Gupta', phone: '9784011122' }, item: 'Hand-painted console table', total: 16500, plan: '50-50', deliveryDate: addDays(t, 9), source: 'chat' });
  o.stage = 'making';
  o.acceptedAt = hoursAgo(70);
  o.versions[0].status = 'accepted';
  o.payments.push({ id: 'pay_sample_3', amount: 8250, source: 'razorpay', method: 'upi', ref: 'pay_sample_3', stepKey: 'advance', at: hoursAgo(68) });
  ev(o, 'accepted', 'customer', { version: 1, total: 16500 });
  ev(o, 'payment', 'razorpay', { amount: 8250, method: 'upi', ref: 'pay_sample_3', step: 'advance' });
  out.push(shift(o, 0));

  // 4. Swing dispatched, cash with courier
  o = buildOrder({ sample: true, customer: { name: 'Arjun Shah', phone: '9825098250' }, item: 'Teak jhula, 4 ft', total: 29000, plan: '50-50', advance: { amount: 14500, method: 'upi_personal', ref: 'UPI 4410' }, source: 'bill' });
  o.stage = 'dispatched';
  o.unlocked = 2;
  o.fulfilment = 'cod';
  o.dispatch = { courier: 'Delhivery', tracking: 'DLV88120044', at: hoursAgo(30) };
  o.cod = { amount: 14500, state: 'with_courier', collectedAt: hoursAgo(5) };
  ev(o, 'ready', 'owner', { mode: 'cod', due: 14500, hasPhoto: false });
  ev(o, 'dispatched', 'owner', { courier: 'Delhivery', tracking: 'DLV88120044', cod: 14500 });
  ev(o, 'courier_collected', 'owner', { amount: 14500 });
  out.push(shift(o, 120));

  // 5. Mirror waiting for acceptance
  o = buildOrder({ sample: true, customer: { name: 'Isha Verma', phone: '9001122334' }, item: 'Rattan wall mirror, 3 ft', total: 9500, plan: '50-50', deliveryDate: addDays(t, 10), source: 'chat' });
  out.push(shift(o, 20));

  // 6. Bookshelf, done
  o = buildOrder({ sample: true, customer: { name: 'Rohit Jain', phone: '9414033221' }, item: 'Open bookshelf, 6 ft', total: 22000, plan: '50-50', advance: { amount: 11000, method: 'cash', ref: 'Bill 98' }, source: 'bill' });
  o.stage = 'delivered';
  o.unlocked = 2;
  o.payments.push({ id: 'pay_sample_6', amount: 11000, source: 'razorpay', method: 'upi', ref: 'pay_sample_6', stepKey: 'before_dispatch', at: hoursAgo(100) });
  o.dispatch = { courier: 'Studio pickup', tracking: '', at: hoursAgo(98) };
  ev(o, 'payment', 'razorpay', { amount: 11000, method: 'upi', ref: 'pay_sample_6', step: 'before_dispatch' });
  ev(o, 'dispatched', 'owner', { courier: 'Studio pickup', tracking: '', cod: 0 });
  ev(o, 'delivered', 'owner', {});
  out.push(shift(o, 200));

  for (const x of out) await db.saveOrder(x);
  return out.length;
}
