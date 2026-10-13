'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Icon, Shell, useApp } from '@/components/kit';
import { OrderRow } from '@/components/order';
import { usePoll } from '@/lib/client';
import { BUCKET_ORDER, bucket } from '@/lib/model';
import { dayOf, inr, todayIST } from '@/lib/format';

const TITLES = {
  verify: 'Verify payment',
  overdue: 'Overdue',
  today: 'Collect today',
  dispatch: 'Ready to dispatch',
  courier: 'Cash with courier',
  waiting: 'Waiting for customer',
  upcoming: 'Coming up',
  making: 'In the making',
  transit: 'On the way',
  done: 'Done',
  cancelled: 'Cancelled',
};
const TODAY_SET = ['verify', 'overdue', 'today', 'dispatch', 'courier', 'waiting'];

export default function Orders() {
  const { t } = useApp();
  const { data, err } = usePoll('/api/orders', 4000);
  const [tab, setTab] = useState('today');
  const [q, setQ] = useState('');
  const orders = data?.orders || [];
  const today = todayIST();

  const filtered = orders.filter((o) => !q.trim() || (o.customer.name + ' ' + o.item).toLowerCase().includes(q.trim().toLowerCase()));
  const groups = BUCKET_ORDER.map((b) => [b, filtered.filter((o) => bucket(o, today) === b)]).filter(([b, l]) => l.length && (tab === 'all' || TODAY_SET.includes(b)));
  const due = orders.filter((o) => ['overdue', 'today'].includes(bucket(o, today)));
  const dueAmt = due.reduce((a, o) => a + o.d.dueNow, 0);
  const received = orders.flatMap((o) => o.payments).filter((p) => dayOf(p.at) === today).reduce((a, p) => a + p.amount, 0);

  return (
    <Shell active="products" title={t('Orders')} back="/">
      <div className="grid2">
        <div className="card">
          <div className="tiny muted">{t('To collect today')}</div>
          <div className="big" style={{ fontSize: 22 }}>{inr(dueAmt)}</div>
          <div className="tiny muted">{t('{n} orders', { n: due.length })}</div>
        </div>
        <div className="card">
          <div className="tiny muted">{t('Received today')}</div>
          <div className="big" style={{ fontSize: 22, color: 'var(--ok)' }}>{inr(received)}</div>
          <div className="tiny muted">{t('all payment types')}</div>
        </div>
      </div>

      <div className="seg">
        <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>{t('Today')}</button>
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{t('All orders')}</button>
      </div>
      <div className="field">
        <input id="search" placeholder={t('Search by customer or item')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search by customer or item')} />
      </div>

      {err && <div className="note bad">{err}</div>}
      {!data && <div className="empty">{t('Loading…')}</div>}
      {data && groups.length === 0 && <div className="empty">{t('Nothing needs you today. New orders will show up here.')}</div>}
      {groups.map(([b, list]) => (
        <section key={b} className="col">
          <div className="sec"><span>{t(TITLES[b])}</span><span>{list.length}</span></div>
          {list.map((o) => <OrderRow key={o.id} o={o} />)}
        </section>
      ))}

      <Link href="/orders/new" className="fab"><Icon n="plus" />{t('New order')}</Link>
    </Shell>
  );
}
