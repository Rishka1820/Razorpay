'use client';
import { Shell, useApp } from '@/components/kit';
import { usePoll } from '@/lib/client';

const secs = (s) => (s == null ? '–' : s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

export default function Metrics() {
  const { t } = useApp();
  const { data: m } = usePoll('/api/metrics', 5000);
  const max = m ? Math.max(1, ...m.funnel.map((f) => f[1])) : 1;
  const cards = m && [
    ['Time to create an order', secs(m.timeToCreateSec), 'Target: under 2 minutes'],
    ['Request to payment', secs(m.requestToPaidSec), 'How long customers take after a request'],
    ['Collected by the agreed date', m.collectedOnTime ? `${m.collectedOnTime.done} of ${m.collectedOnTime.of}` : '–', 'Main measure of success'],
    ['Old requests replaced', String(m.wrongRequests), 'Counted so wrong amounts stay visible'],
    ['Payments recorded by hand', m.manualShare ? `${m.manualShare.manual} of ${m.manualShare.total}` : '–', 'Shows whether Razorpay replaces the notebook'],
    ['Courier cash to your account', m.codHours == null ? '–' : `${m.codHours.toFixed(1)} h`, 'Pay-on-delivery orders only'],
  ];
  return (
    <Shell title={t('How we measure success')} back="/more" nav={false}>
      <div className="note">{t('These numbers come from orders you create here. Sample orders aren\'t counted.')}</div>
      {m && m.orders === 0 && <div className="empty">{t('Create an order and your numbers will show up here.')}</div>}
      {m && m.orders > 0 && (
        <>
          <section className="card col">
            <div className="sec" style={{ padding: 0 }}><span>{t('Order journey')}</span></div>
            {m.funnel.map(([label, n]) => (
              <div key={label} className="col" style={{ gap: 4 }}>
                <div className="row between small"><span>{t(label)}</span><b className="num">{n}</b></div>
                <div style={{ height: 8, background: '#e4e9f3', borderRadius: 6 }}><div style={{ height: 8, width: `${(n / max) * 100}%`, background: 'var(--blue)', borderRadius: 6 }} /></div>
              </div>
            ))}
          </section>
          <div className="grid2">
            {cards.map(([label, value, hint]) => (
              <div className="card" key={label}>
                <div className="tiny muted">{t(label)}</div>
                <div className="big" style={{ fontSize: 22 }}>{value}</div>
                <div className="tiny muted">{t(hint)}</div>
              </div>
            ))}
          </div>
          <div className="small muted">{t('Duplicate payments flagged: {n}', { n: m.overpaid })}</div>
        </>
      )}
    </Shell>
  );
}
