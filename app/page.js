'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Icon, LangSwitch, Pill, Sheet, Shell, useApp } from '@/components/kit';
import { OrderRow } from '@/components/order';
import { usePoll } from '@/lib/client';
import { bucket, totalDues } from '@/lib/model';
import { dayOf, inr, todayIST } from '@/lib/format';
import { BUSINESS } from '@/lib/config';

export default function Home() {
  const { t, toast, role } = useApp();
  const router = useRouter();
  const { data } = usePoll('/api/orders', 5000);
  const [sheet, setSheet] = useState(false);
  const orders = data?.orders || [];
  const today = todayIST();
  const collect = orders.filter((o) => ['overdue', 'today'].includes(bucket(o, today)));
  const attention = orders.filter((o) => ['verify', 'request'].includes(bucket(o, today)));
  const collectAmt = collect.reduce((a, o) => a + o.d.dueNow, 0);
  const receivedToday = orders.flatMap((o) => o.payments).filter((p) => dayOf(p.at) === today).reduce((a, p) => a + p.amount, 0);
  const dues = totalDues(orders);
  const stub = (name) => toast(t('{name} is part of the Razorpay app, but not this prototype', { name: t(name) }));

  const shortcuts = [
    { n: 'qr', label: 'QR codes', on: () => stub('QR code') },
    { n: 'link', label: 'Payment links', on: () => setSheet(true) },
    { n: 'list', label: 'Orders', hot: true, on: () => router.push('/orders') },
    { n: 'grid', label: 'All products', on: () => router.push('/products') },
  ];
  const hr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Shell
      active="home"
      title={BUSINESS.name}
      sub={`${t(greeting)} · ${BUSINESS.city} · ${role === 'owner' ? t('Owner') : t('Staff')}`}
      right={<><LangSwitch /><Bell /></>}
    >
      <div className="card col" style={{ gap: 14 }}>
        <div className="two">
          <div>
            <div className="small muted">{t('Received today')}</div>
            <div className="big" style={{ fontSize: 26, lineHeight: '32px' }}>{inr(receivedToday)}</div>
          </div>
          <div>
            <div className="small muted">{t('Total dues')}</div>
            <div className="big" style={{ fontSize: 26, lineHeight: '32px' }}>{inr(dues.amount)}</div>
            <div className="tiny muted">{t('across {n} orders', { n: dues.count })}</div>
          </div>
        </div>
        <Link href="/orders/new" className="btn"><Icon n="plus" />{t('New order')}</Link>
      </div>

      {attention.length > 0 && (
        <div className="col">
          <div className="sec"><span>{t('Needs your attention')}</span></div>
          {attention.map((o) => <OrderRow key={o.id} o={o} />)}
        </div>
      )}

      {collect.length > 0 && (
        <div className="col">
          <div className="sec"><span>{t('To collect today')} · {inr(collectAmt)}</span></div>
          {collect.slice(0, 3).map((o) => <OrderRow key={o.id} o={o} />)}
        </div>
      )}


    </Shell>
  );
}
