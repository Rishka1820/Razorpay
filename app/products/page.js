'use client';
import { useRouter } from 'next/navigation';
import { Icon, Shell, useApp } from '@/components/kit';

export default function Products() {
  const { t, toast } = useApp();
  const router = useRouter();
  const stub = (name) => toast(t('{name} opens in the full Razorpay app', { name: t(name) }));
  const items = [
    { n: 'link', h: 'Payment links', d: 'Collect payments instantly by sharing a simple link' },
    { n: 'qr', h: 'QR Codes', d: 'Collect payments with a QR code' },
    { n: 'doc', h: 'Payment pages', d: 'Create a custom branded page to collect payments online' },
    { n: 'swap', h: 'Subscriptions', d: 'Set up recurring payments and automate billing' },
    { n: 'doc', h: 'Invoices', d: 'Send professional invoices and get paid faster' },
  ];
  return (
    <Shell active="products" title={t('Products')}>
      <div className="sec"><span>{t('Share and collect')}</span></div>
      <div className="pgrid">
        <button className="pcard hot" onClick={() => router.push('/orders')}>
          <span className="ic"><Icon n="list" s={20} /></span>
          <span className="h">{t('Orders')}</span>
          <span className="d">{t('Made to order? Keep the advance, stage payments and balance on one order, with changes your customer approves.')}</span>
        </button>
        {items.map((x) => (
          <button key={x.h} className="pcard" onClick={() => stub(x.h)}>
            <span className="ic"><Icon n={x.n} s={20} /></span>
            <span className="h">{t(x.h)}</span>
            <span className="d">{t(x.d)}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
}
