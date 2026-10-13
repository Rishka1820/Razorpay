'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Field, Icon, Pill, Sheet, Shell, Spinner, useApp } from '@/components/kit';
import { CancelSheet, ChangeSheet, CollectSheet, DeliverySheet, DispatchSheet, ManualSheet, ReadySheet, RemitSheet } from '@/components/ordersheets';
import { PaymentList, Steps, Timeline, VersionList, shareMessage, statusChip, stepLabel } from '@/components/order';
import { api, copyText, fileToDataUrl, getDemoChat, usePoll, waLink } from '@/lib/client';
import { bucket, cumTargets } from '@/lib/model';
import { addDays, daysBetween, fmtDate, inr, prettyPhone } from '@/lib/format';

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
  const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const customerUrl = `${origin}/c/${o.id}`;

  async function share(kind, ord = o) {
    const msg = shareMessage(ord, kind, origin);
    if (getDemoChat()) {
      await act('shared', { kind, text: msg });
      return;
    }
    window.open(waLink(ord.customer.phone, msg), '_blank');
    await act('shared', { kind, text: msg });
  }
  async function copyLink(url) {
    toast((await copyText(url)) ? t('Link copied') : t('Copy failed'));
  }

  async function remind() {
    let ord = o;
    if (!o.activeRequest || o.activeRequest.amount !== d.dueNow) {
      ord = await act('request_payment', {});
      if (!ord) return;
    }
    await share('remind', ord);
  }
  const chase = !['awaiting_acceptance', 'cancelled'].includes(o.stage) && d.dueNow > 0 && ['overdue', 'today'].includes(bucket(o, o.today));
  const lateDays = o.collectOn ? daysBetween(o.collectOn, o.today) : 0;

  const ctx = { o, d, t, toast, busy, act, setSheet, share, copyLink };
  const closed = o.stage === 'cancelled' || (o.stage === 'delivered' && d.remaining === 0);

  return (
    <Shell title={o.customer.name} sub={`${o.item}`} back="/orders" nav={false} right={statusChip(o, t)}>
      {isNew && (o.stage === 'awaiting_acceptance' || o.acceptedVia === 'bill') && (
        <div className="card col" style={{ borderColor: '#bcd5fb', background: '#f2f7ff' }}>
          <div className="bold">{o.stage === 'awaiting_acceptance' ? t('Order created. Send it to {name}', { name: o.customer.name.split(' ')[0] }) : t('Advance received. Order confirmed.')}</div>
          <div className="small muted">
            {o.stage === 'awaiting_acceptance'
              ? t('{name} opens the link, reads the terms, taps Accept and pays the advance.', { name: o.customer.name.split(' ')[0] })
              : t('Send {name} a digital copy so both of you hold the same record.', { name: o.customer.name.split(' ')[0] })}
          </div>
          <button className="btn" onClick={() => share('order')}><Icon n="share" />{t('Send on WhatsApp')}</button>
        </div>
      )}

      {/* money */}
      <div className="card col summary">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="tiny muted">{t('Agreed total')}{o.versions.filter((v) => v.status === 'accepted').length > 1 ? ` · ${t('Revision {n}', { n: Math.max(...o.versions.filter((v) => v.status === 'accepted').map((v) => v.n)) - 1 })}` : ''}</div>
            <div className="big">{inr(o.total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tiny muted">{t('Paid so far')}</div>
            <div className="big" style={{ color: 'var(--ok)' }}>{inr(d.paid)}</div>
          </div>
        </div>
        <Steps o={o} />
        <div className="row between small">
          <span className="muted">{t('Remaining balance')}: <b className="num">{inr(d.remaining)}</b></span>
          {o.deliveryDate && <span className="muted">{t('Deliver by')} {fmtDate(o.deliveryDate)}</span>}
        </div>
        {d.refundDue > 0 && <div className="note bad">{t('Refund {amt} to the customer. They\'ve paid more than the new total.', { amt: inr(d.refundDue) })}</div>}
        {d.pendingVersion && (
          <div className="note warn">{t('Waiting for the customer to approve the revised total of {amt}.', { amt: inr(d.pendingVersion.total) })} {t('The original order stays agreed until they approve.')}
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button className="btn sm ghost" onClick={() => share('change')}><Icon n="share" s={16} />{t('Send on WhatsApp')}</button>
            </div>
          </div>
        )}
      </div>

      {d.pendingClaim && (
        <div className="card col" style={{ borderColor: '#f1cf8c', background: '#fffaf0' }}>
          <div className="bold">{t('{name} reported a {amt} UPI payment', { name: o.customer.name.split(' ')[0], amt: inr(d.pendingClaim.amount) })}</div>
          <div className="small muted">{d.pendingClaim.ref ? t('Reference they shared: {r}', { r: d.pendingClaim.ref }) : t('They didn\'t share a reference.')} {t('Check your bank or UPI app. It counts as paid only when you tap Received.')}</div>
          <div className="btnrow">
            <button className="btn ghost" disabled={busy} onClick={() => act('reject_claim', { claimId: d.pendingClaim.id }, 'Marked as not received')}>{t('Not received')}</button>
            <button className="btn" disabled={busy} onClick={() => act('confirm_claim', { claimId: d.pendingClaim.id }, 'Payment confirmed')}>{t('Confirm {amt} received', { amt: inr(d.pendingClaim.amount) })}</button>
          </div>
        </div>
      )}

      {chase && (
        <div className="card col">
          <div className="bold">{lateDays > 0 ? t('{amt} is overdue by {n} days', { amt: inr(d.dueNow), n: lateDays }) : t('{amt} is due today', { amt: inr(d.dueNow) })}</div>
          <div className="btnrow">
            <a className="btn ghost" href={o.customer.phone ? `tel:+${o.customer.phone}` : undefined} aria-disabled={!o.customer.phone} onClick={() => o.customer.phone && act('called')} style={o.customer.phone ? undefined : { opacity: 0.45, pointerEvents: 'none' }}><Icon n="phone" />{t('Call')}</a>
            <button className="btn" disabled={busy} onClick={remind}><Icon n="chat" />{t('Remind on WhatsApp')}</button>
          </div>
          <div className="tiny muted">{t('The reminder includes a payment link for the exact amount due.')}</div>
        </div>
      )}

      {d.pendingChangeRequest && (
        <div className="card col" style={{ borderColor: '#f1cf8c', background: '#fffaf0' }}>
          <div className="bold">{t(({ cancel: '{name} asked to cancel', issue: '{name} reported an issue' })[d.pendingChangeRequest.kind] || '{name} asked for a change', { name: o.customer.name.split(' ')[0] })}</div>
          <div className="small" style={{ background: '#fff', borderRadius: 10, padding: 10 }}>“{d.pendingChangeRequest.note}”</div>
          {d.pendingChangeRequest.kind === 'cancel' ? (
            <>
              <div className="small muted">{t('{paid} has been paid. If you cancel, you choose how much to refund.', { paid: inr(d.paid) })}</div>
              <div className="btnrow">
                <button className="btn ghost" disabled={busy || role !== 'owner'} onClick={() => act('decline_change_request', { requestId: d.pendingChangeRequest.id }, 'Request declined')}>{t('Keep the order')}</button>
                <button className="btn" disabled={busy || role !== 'owner'} onClick={() => setSheet('cancel')}>{t('Cancel the order')}</button>
              </div>
            </>
          ) : d.pendingChangeRequest.kind === 'issue' ? (
            <>
              <div className="small muted">{t('Reply to your customer, fix it, or adjust the order. Payment reminders continue as agreed.')}</div>
              <div className="btnrow">
                <a className="btn ghost" href={o.customer.phone ? `tel:+${o.customer.phone}` : undefined} style={o.customer.phone ? undefined : { opacity: 0.45, pointerEvents: 'none' }}><Icon n="phone" />{t('Call')}</a>
                <button className="btn" disabled={busy} onClick={() => act('resolve_request', { requestId: d.pendingChangeRequest.id }, 'Marked as handled')}>{t('Mark as handled')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="small muted">{t('Set the new price. The customer must accept it before anything changes.')}</div>
              <div className="btnrow">
                <button className="btn ghost" disabled={busy || role !== 'owner'} onClick={() => act('decline_change_request', { requestId: d.pendingChangeRequest.id }, 'Request declined')}>{t('Can\'t do this')}</button>
                <button className="btn" disabled={busy} onClick={() => (role === 'owner' ? setSheet('change') : toast(t('Only the owner can change prices')))}>{t('Set the price')}</button>
              </div>
            </>
          )}
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
            <button className="btn ghost" onClick={() => setSheet('change')}>{t('Revise order')}</button>
          ) : (
            <div className="col" style={{ gap: 4, flex: 1 }}>
              <button className="btn ghost" disabled>{t('Revise order')}</button>
              <div className="tiny muted">{t('Only the owner can revise an order. Ask the owner.')}</div>
            </div>
          )}
          {role === 'owner' && <button className="btn ghost" onClick={() => setSheet('delivery')}>{t('Change delivery date')}</button>}
        </div>
      )}

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Payments')}</span></div>
        <PaymentList o={o} />
      </section>

      <section className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Order history')}</span></div>
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
        <div className="sec" style={{ padding: 0 }}><span>{t('Activity')}</span></div>
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
      {sheet === 'delivery' && <DeliverySheet c={ctx} />}
    </Shell>
  );

  /* ---------- next step card ---------- */
  function NextStep() {
    const first = o.customer.name.split(' ')[0];
    if (o.stage === 'awaiting_acceptance') {
      return (
        <div className="card col">
          <div className="bold">{t('Waiting for {name} to accept', { name: first })}</div>
          <div className="small muted">{t('As soon as they accept, they\'ll get a request to pay the advance.')}</div>
          <button className="btn" onClick={() => share('order')}><Icon n="share" />{t('Send on WhatsApp')}</button>
          <button className="btn ghost" onClick={() => copyLink(customerUrl)}><Icon n="copy" />{t('Copy order link')}</button>
        </div>
      );
    }
    if (o.stage === 'making') {
      return (
        <div className="card col">
          {d.auto && !o.activeRequest && <div className="note warn">{t('The agreed date for {name} has arrived. Has the work reached this stage? If not, move the date.', { name: t(stepLabel(o, d.step)) })}</div>}
          {d.dueNow > 0 ? (
            <>
              <div className="row between"><div><div className="tiny muted">{t('Due now')} · {t(stepLabel(o, d.step))}</div><div className="big">{inr(d.dueNow)}</div></div>
                {o.activeRequest && <Pill tone="info">{t('Request open')}</Pill>}</div>
              <button className="btn" onClick={() => setSheet('collect')}><Icon n="rupee" />{o.activeRequest ? t('View payment request') : t('Ask for {amt}', { amt: inr(d.dueNow) })}</button>
              {d.auto && !o.activeRequest && <button className="btn ghost" disabled={busy} onClick={() => act('set_stage_date', { key: d.step.key, date: addDays(o.today, 7) }, 'Date moved by a week')}>{t('Not yet. Move the date by a week')}</button>}
            </>
          ) : (
            <div className="small muted">{t('Nothing is due right now.')}</div>
          )}
          {d.nextStep && d.dueNow === 0 && d.nextDate && <div className="small muted">{t('{name} payment is due on {date}. You can ask for it earlier if the work gets there sooner.', { name: t(d.nextStep.name), date: fmtDate(d.nextDate) })}</div>}
          {d.nextStep && d.dueNow === 0 && (
            <button className="btn soft" disabled={busy} onClick={() => act('unlock_next', {}, 'Next payment is now due')}>
              {t('Ask for {amt} · {name}', { amt: inr(d.nextAmount), name: t(d.nextStep.name) })}
            </button>
          )}
          <button className="btn ghost" onClick={() => setSheet('ready')}><Icon n="camera" />{t('Mark order ready')}</button>
        </div>
      );
    }
    if (o.stage === 'ready') {
      return (
        <div className="card col">
          {o.photo && <div className="photo"><img src={o.photo} alt="Finished piece" /></div>}
          <div className="tiny muted">{t('How will the balance be paid?')}</div>
          <div className="seg">
            {[['prepaid', 'Before dispatch'], ['cod', 'On delivery'], ['pickup', 'Pickup']].map(([k, l]) => (
              <button key={k} className={o.fulfilment === k ? 'on' : ''} onClick={() => act('set_fulfilment', { mode: k })}>{t(l)}</button>
            ))}
          </div>
          {d.dueNow > 0 && (
            <>
              <div className="row between"><div><div className="tiny muted">{t('Due now')} · {t(stepLabel(o, d.step))}</div><div className="big">{inr(d.dueNow)}</div></div>
                {o.activeRequest && <Pill tone="info">{t('Request open')}</Pill>}</div>
              <button className="btn" onClick={() => setSheet('collect')}><Icon n="rupee" />{o.activeRequest ? t('View payment request') : t(o.fulfilment === 'pickup' ? 'Ask for {amt} before pickup' : 'Ask for {amt} before dispatch', { amt: inr(d.dueNow) })}</button>
            </>
          )}
          <button className="btn ghost" onClick={() => setSheet('dispatch')}><Icon n="truck" />{o.fulfilment === 'pickup' ? t('Hand over in person') : t('Dispatch')}</button>
        </div>
      );
    }
    if (o.stage === 'dispatched') {
      return (
        <div className="card col">
          <div className="row"><Icon n="truck" /><div className="grow"><div className="bold">{o.dispatch.courier}</div><div className="small muted">{o.dispatch.tracking || t('No tracking number')}</div></div></div>
          {o.cod?.state === 'pending' && (
            <>
              <div className="note warn">{t('The customer will pay {amt} in cash on delivery. The courier then transfers it to you.', { amt: inr(o.cod.amount) })}</div>
              <button className="btn soft" onClick={() => setSheet('collect')}>{t('Let the customer pay online instead')}</button>
              <button className="btn" disabled={busy} onClick={() => act('courier_collected', {}, 'Noted')}>{t('Courier collected the cash')}</button>
            </>
          )}
          {o.cod?.state === 'with_courier' && (
            <>
              <div className="note warn">{t('The courier collected {amt} in cash from the customer. Waiting for the courier to transfer it to you.', { amt: inr(o.cod.amount) })}</div>
              <button className="btn" onClick={() => setSheet('remit')}>{t('The courier transferred the money to me')}</button>
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
          <button className="btn" onClick={() => setSheet('collect')}>{o.activeRequest ? t('View payment request') : t('Ask for {amt}', { amt: inr(d.dueNow) })}</button>
        </div>
      );
    }
    return null;
  }
}
