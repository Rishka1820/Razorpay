'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Icon, Pill, Shell, useApp } from '@/components/kit';
import { fmtDateTime } from '@/lib/format';

const ICON = { due: 'rupee', paid: 'rupee', verify: 'clock', change: 'chat', ok: 'check', warn: 'clock' };

export default function Notifications() {
  const { t, notifs, markSeen } = useApp();
  const items = notifs.items;
  const act = items.filter((i) => i.action);
  const rest = items.filter((i) => !i.action);
  useEffect(() => {
    markSeen();
  }, [markSeen, items.length]);

  const row = (i) => (
    <Link key={i.id} href={`/orders/${i.orderId}`} className={`nrow ${i.action ? 'act' : ''}`}>
      <span className={`nd ${i.kind}`}><Icon n={ICON[i.kind] || 'bell'} s={18} /></span>
      <span className="grow">
        <div style={{ fontSize: 14, lineHeight: '20px' }}>{t(i.text, i.params)}</div>
        <div className="tiny muted">{fmtDateTime(i.at)}</div>
      </span>
      {i.action && <Pill tone="warn">{t(i.kind === 'verify' ? 'Verify' : i.kind === 'due' ? 'Collect' : 'Reply')}</Pill>}
    </Link>
  );

  return (
    <Shell title={t('Notifications')} back="/" nav={false}>
      {items.length === 0 && <div className="empty">{t('Nothing new yet. Payments and customer replies will show up here.')}</div>}
      {act.length > 0 && (
        <div className="col">
          <div className="sec"><span>{t('Needs your action')}</span></div>
          {act.map(row)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="col">
          <div className="sec"><span>{t('Earlier')}</span></div>
          {rest.map(row)}
        </div>
      )}
    </Shell>
  );
}
