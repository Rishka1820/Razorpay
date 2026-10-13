'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Field, Icon, Pill, Sheet, Shell, Spinner, useApp } from '@/components/kit';
import { CancelSheet, ChangeSheet, CollectSheet, DispatchSheet, ManualSheet, ReadySheet, RemitSheet } from '@/components/ordersheets';
import { PaymentList, Steps, Timeline, VersionList, shareMessage, statusChip } from '@/components/order';
import { api, copyText, fileToDataUrl, usePoll, waLink } from '@/lib/client';
import { cumTargets } from '@/lib/model';
import { fmtDate, inr, prettyPhone } from '@/lib/format';

export default function OrderPage({ params }) {
  const { id } = params;
  const { t, toast, role } = useApp();
  const { data, err, setData } = usePoll(`/api/orders/${id}`, 3000);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const o = data?.order;

  useEffect(() => {
    setIsNew(new URLSearchParams(window.location.search).get('new') === '1');
  }, []);

  async function act(type, payload = {}, okMsg) {
    setBusy(true);
    try {
      const r = await api(`/api/orders/${id}/action`, { method: 'POST', body: { type, ...payload } });
      setData(r);
      if (okMsg) toast(t(okMsg));
      return r.order;
    } catch (e) {
      toast(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (err && !o) return <Shell title={t('Order')} back="/orders"><div className="note bad">{err}</div></Shell>;
  if (!o) return <Shell title={t('Order')} back="/orders"><div className="empty">{t('Loading…')}</div></Shell>;

  const d = o.d;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const customerUrl = `${origin}/c/${o.id}`;

  async function share(kind, ord = o) {
    const msg = shareMessage(ord, kind, origin);
    window.open(waLink(ord.customer.phone, msg), '_blank');
    await act('shared', { kind });
  }
  async function copyLink(url) {
    toast((await copyText(url)) ? t('Link copied') : t('Copy failed'));
  }

  const ctx = { o, d, t, toast, busy, act, setSheet, share, copyLink };
  const closed = o.stage === 'cancelled' || (o.stage === 'delivered' && d.remaining === 0);

  return (
    <Shell title={o.customer.name} sub={`${o.item}`} back="/orders" nav={false} right={statusChip(o, t)}>
      {isNew && (
        <div className="card col" style={{ borderColor: '#bcd5fb', background: '#f2f7ff' }}>
          <div className="bold">{o.stage === 'awaiting_acceptance' ? t('Order created. Send it to {name}', { name: o.customer.name.split(' ')[0] }) : t('Order created with the advance noted')}</div>
          <div className="small muted">
            {o.stage === 'awaiting_acceptance'
              ? t('{name} opens the link, checks the terms, taps Accept, then pays the advance.', { name: o.customer.name.split(' ')[0] })
              : t('Send {name} a digital copy so both of you hold the same record.', { name: o.customer.name.split(' ')[0] })}
          </div>
          <button className="btn" onClick={() => share('order')}><Icon n="share" />{t('Send on WhatsApp')}</button>
        </div>
      )}

      {/* money */}
      <div className="card col">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="tiny muted">{t('Agreed total')}{o.versions.filter((v) => v.status === 'accepted').length > 1 ? ` · v${Math.max(...o.versions.filter((v) => v.status === 'accepted').map((v) => v.n))}` : ''}</div>
            <div className="big">{inr(o.total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny muted">{t('Paid so far')}</div>
            <div className="big" style={{ color: 'var(--ok)' }}>{inr(d.paid)}</div>
          </div>
        </div>
        <Steps o={o} />
        <div className="row between small">
          <span className="muted">{t('Still to come')}: <b className="num">{inr(d.remaining)}</b></span>
          {o.deliveryDate && <span className="muted">{t('Deliver by')} {fmtDate(o.deliveryDate)}</span>}
        </div>
        {d.refundDue > 0 && <div className="note bad">{t('Refund {amt} to the customer: they have paid more than the new total.', { amt: inr(d.refundDue) })}</div>}
        {d.pendingVersion && (
          <div className="note warn">{t('Waiting for the customer to accept the change to {amt} (v{n}).', { amt: inr(d.pendingVersion.total), n: d.pendingVersion.n })}
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button className="btn sm ghost" onClick={() => share('change')}><Icon n="share" s={16} />{t('Send on WhatsApp')}</button>
            </div>
          </div>
        )}
      </div>

      {d.pendingClaim && (
        <div className="card col" style={{ borderColor: '#f1cf8c', background: '#fffaf0' }}>
          <div className="bold">{t('{name} says they paid {amt} by UPI', { name: o.customer.name.split(' ')[0], amt: inr(d.pendingClaim.amount) })}</div>
          <div className="small muted">{d.pendingClaim.ref ? t('Reference they gave: {r}', { r: d.pendingClaim.ref }) : t('No reference given.')} {t('Check your bank or UPI app. It counts as paid only after you confirm.')}</div>
          <div className="btnrow">
            <button className="btn ghost" disabled={busy} onClick={() => act('reject_claim', { claimId: d.pendingClaim.id }, 'Marked as not received')}>{t('Not received')}</button>
            <button className="btn" disabled={busy} onClick={() => act('confirm_claim', { claimId: d.pendingClaim.id }, 'Payment confirmed')}>{t('Received')}</button>
          </div>
        </div>
      )}

      {/* next step */}
      {!closed && NextStep()}
      {closed && o.stage !== 'cancelled' && <div className="note ok">{t('This order is closed: delivered and fully paid.')}</div>}
      {o.stage === 'cancelled' && <div className="note bad">{t('This order was cancelled.')}</div>}

      {/* secondary actions */}
      {!closed && ['making', 'ready'].includes(o.stage) && (
        <div className="btnrow">
          {role === 'owner' ? (
            <button className="btn ghost" onClick={() => setSheet('change')}>{t('Propose a change')}</button>
          ) : (
            <button className="btn ghost" onClick={() => toast(t('Only the owner can change the price'))} style={{ opacity: 0.6 }}>{t('Propose a change')}</button>
          )}
        </div>
      )}

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Payments')}</span></div>
        <PaymentList o={o} />
      </section>

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Versions of this order')}</span></div>
        <VersionList o={o} />
        <div className="small muted">{o.acceptedAt ? t('Terms accepted {when} via {how}', { when: fmtDate(o.acceptedAt.slice(0, 10)), how: o.acceptedVia === 'bill' ? t('paper bill') : t('order link') }) : t('Terms not accepted yet')}</div>
      </section>

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Customer')}</span></div>
        <div className="row between small"><span>{o.customer.name}</span><span className="muted num">{prettyPhone(o.customer.phone) || t('No number')}</span></div>
        <div className="btnrow">
          <Link href={`/c/${o.id}`} className="btn soft sm" style={{ width: 'auto' }}>{t('View as customer')}</Link>
          <button className="btn ghost sm" onClick={() => copyLink(customerUrl)}><Icon n="copy" s={16} />{t('Copy link')}</button>
        </div>
      </section>

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('History')}</span></div>
        <Timeline o={o} />
      </section>

      {role === 'owner' && !closed && (
        <button className="btn danger" onClick={() => setSheet('cancel')}>{t('Cancel this order')}</button>
      )}

      {sheet === 'collect' && <CollectSheet c={ctx} />}
      {sheet === 'manual' && <ManualSheet c={ctx} />}
      {sheet === 'change' && <ChangeSheet c={ctx} />}
      {sheet === 'ready' && <ReadySheet c={ctx} />}
      {sheet === 'dispatch' && <DispatchSheet c={ctx} />}
      {sheet === 'remit' && <RemitSheet c={ctx} />}
      {sheet === 'cancel' && <CancelSheet c={ctx} />}
    </Shell>
  );

  /* ---------- next step card ---------- */
  function NextStep() {
    const first = o.customer.name.split(' ')[0];
    if (o.stage === 'awaiting_acceptance') {
      return (
        <div className="card col">
          <div className="bold">{t('Waiting for {name} to accept', { name: first })}</div>
          <div className="small muted">{t('Once they accept, a request for the advance goes out automatically.')}</div>
          <button className="btn" onClick={() => share('order')}><Icon n="share" />{t('Send on WhatsApp')}</button>
          <button className="btn ghost" onClick={() => copyLink(customerUrl)}><Icon n="copy" />{t('Copy order link')}</button>
        </div>
      );
    }
    if (o.stage === 'making') {
      return (
        <div className="card col">
          {d.dueNow > 0 ? (
            <>
              <div className="row between"><div><div className="tiny muted">{t('Due now')} · {t(d.step.name)}</div><div className="big">{inr(d.dueNow)}</div></div>
                {o.activeRequest && <Pill tone="info">{t('Request open')}</Pill>}</div>
              <button className="btn" onClick={() => setSheet('collect')}><Icon n="rupee" />{t('Collect {amt}', { amt: inr(d.dueNow) })}</button>
            </>
          ) : (
            <div className="small muted">{t('Nothing is due right now.')}</div>
          )}
          {d.nextStep && d.dueNow === 0 && (
            <button className="btn soft" disabled={busy} onClick={() => act('unlock_next', {}, 'Next payment is now due')}>
              {t('{name} reached: ask for {amt}', { name: t(d.nextStep.name), amt: inr(d.nextAmount) })}
            </button>
          )}
          <button className="btn ghost" onClick={() => setSheet('ready')}><Icon n="camera" />{t('Mark ready with a photo')}</button>
        </div>
      );
    }
    if (o.stage === 'ready') {
      return (
        <div className="card col">
          {o.photo && <div className="photo"><img src={o.photo} alt="Finished piece" /></div>}
          <div className="tiny muted">{t('How will the balance be paid?')}</div>
          <div className="seg">
            {[['prepaid', 'Before dispatch'], ['cod', 'On delivery'], ['pickup', 'Studio pickup']].map(([k, l]) => (
              <button key={k} className={o.fulfilment === k ? 'on' : ''} onClick={() => act('set_fulfilment', { mode: k })}>{t(l)}</button>
            ))}
          </div>
          {d.dueNow > 0 && (
            <>
              <div className="row between"><div><div className="tiny muted">{t('Due now')} · {t(d.step.name)}</div><div className="big">{inr(d.dueNow)}</div></div>
                {o.activeRequest && <Pill tone="info">{t('Request open')}</Pill>}</div>
              <button className="btn" onClick={() => setSheet('collect')}><Icon n="rupee" />{t('Send “pay {amt} to dispatch”', { amt: inr(d.dueNow) })}</button>
            </>
          )}
          <button className="btn ghost" onClick={() => setSheet('dispatch')}><Icon n="truck" />{o.fulfilment === 'pickup' ? t('Hand over at studio') : t('Dispatch')}</button>
        </div>
      );
    }
    if (o.stage === 'dispatched') {
      return (
        <div className="card col">
          <div className="row"><Icon n="truck" /><div className="grow"><div className="bold">{o.dispatch.courier}</div><div className="small muted">{o.dispatch.tracking || t('No tracking number')}</div></div></div>
          {o.cod?.state === 'pending' && (
            <>
              <div className="note warn">{t('{amt} is to be paid on delivery. If the courier collects cash, that money reaches you later.', { amt: inr(o.cod.amount) })}</div>
              <button className="btn soft" onClick={() => setSheet('collect')}>{t('Let the customer pay online instead')}</button>
              <button className="btn" disabled={busy} onClick={() => act('courier_collected', {}, 'Noted')}>{t('Courier collected cash')}</button>
            </>
          )}
          {o.cod?.state === 'with_courier' && (
            <>
              <div className="note warn">{t('The courier has {amt} in cash. It is not yours until it reaches you.', { amt: inr(o.cod.amount) })}</div>
              <button className="btn" onClick={() => setSheet('remit')}>{t('Courier payment reached me')}</button>
            </>
          )}
          <button className="btn ghost" disabled={busy} onClick={() => act('deliver', {}, 'Marked delivered')}>{t('Mark delivered')}</button>
        </div>
      );
    }
    if (o.stage === 'delivered' && d.remaining > 0) {
      return (
        <div className="card col">
          <div><div className="tiny muted">{t('Still to collect')}</div><div className="big">{inr(d.remaining)}</div></div>
          <button className="btn" onClick={() => setSheet('collect')}>{t('Collect {amt}', { amt: inr(d.dueNow) })}</button>
        </div>
      );
    }
    return null;
  }
}
