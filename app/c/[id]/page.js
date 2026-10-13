'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Field, Icon, LangSwitch, Pill, Sheet, Spinner, useApp } from '@/components/kit';
import { Steps, VersionList, methodLabel } from '@/components/order';
import { api, usePoll } from '@/lib/client';
import { fmtDate, fmtDateTime, inr } from '@/lib/format';

// What the customer sees. No login: the link is the key.
export default function CustomerPage({ params }) {
  const { id } = params;
  const { t, toast } = useApp();
  const { data, err, setData } = usePoll(`/api/c/${id}`, 3000);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [chgOpen, setChgOpen] = useState(false);
  const [chgNote, setChgNote] = useState('');
  const [ref, setRef] = useState('');
  const o = data?.order;

  async function act(type, payload = {}) {
    setBusy(true);
    try {
      const r = await api(`/api/c/${id}`, { method: 'POST', body: { type, ...payload } });
      setData(r);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  const bar = (
    <div className="demo-bar">
      <span>{t('Prototype: you are seeing what the customer sees')}</span>
      <Link href={`/orders/${id}`}>{t('Back to seller app')}</Link>
    </div>
  );

  if (err && !o) return <div className="phone">{bar}<div className="main"><div className="note bad">{err}</div></div></div>;
  if (!o) return <div className="phone">{bar}<div className="main"><div className="empty">{t('Loading…')}</div></div></div>;

  const d = o.d;
  const r = o.activeRequest;
  const pending = d.pendingVersion;
  const first = o.customer.name.split(' ')[0];

  return (
    <div className="phone">
      {bar}
      <header className="top" style={{ position: 'static' }}>
        <div className="grow">
          <h1>Ananya Interiors</h1>
          <div className="sub">{t('Order for {name}', { name: o.customer.name })}</div>
        </div>
        <LangSwitch />
      </header>
      <main className="main" style={{ paddingBottom: 30 }}>
        <div className="card col summary">
          {o.photo && <div className="photo"><img src={o.photo} alt="Your finished piece" /></div>}
          <div className="bold" style={{ fontSize: 17 }}>{o.item}</div>
          <div className="row between">
            <div><div className="tiny muted">{t('Agreed total')}</div><div className="big">{inr(o.total)}</div></div>
            <div style={{ textAlign: 'right' }}><div className="tiny muted">{t('You have paid')}</div><div className="big" style={{ color: 'var(--ok)' }}>{inr(d.paid)}</div></div>
          </div>
          {o.stage !== 'awaiting_acceptance' && <Steps o={o} />}
          {o.deliveryDate && <div className="small muted">{t('Delivery by')} {fmtDate(o.deliveryDate)}</div>}
        </div>

        {o.stage === 'cancelled' && <div className="note bad">{t('This order was cancelled.')}</div>}

        {/* 1. accept */}
        {o.stage === 'awaiting_acceptance' && (
          <div className="card col">
            <div className="bold">{t('Check and accept your order')}</div>
            <div className="small" style={{ background: '#f6f8fc', borderRadius: 10, padding: 10 }}>{o.terms}</div>
            <div className="small muted">{t('Your payment plan')}: {d.steps.map((s, i) => `${t(s.name)} ${inr(d.cum[i] - (d.cum[i - 1] || 0))}`).join(' · ')}</div>
            <button className="btn" disabled={busy} onClick={() => act('accept')}>{busy ? <Spinner /> : <Icon n="check" />}{t('Accept order')}</button>
            <div className="tiny muted">{t('Your acceptance is saved with the date and time.')}</div>
          </div>
        )}

        {/* 2. change to approve */}
        {pending && (
          <div className="card col" style={{ borderColor: '#f1cf8c', background: '#fffaf0' }}>
            <div className="bold">{t('Change to your order')}</div>
            <div className="row between"><span className="num muted">{inr(o.total)}</span><Icon n="back" s={16} /><span className="big" style={{ fontSize: 22 }}>{inr(pending.total)}</span></div>
            <div className="small">{pending.note}</div>
            <div className="small muted">{t('What you have already paid ({paid}) stays counted.', { paid: inr(d.paid) })}</div>
            <div className="btnrow">
              <button className="btn ghost" disabled={busy} onClick={() => act('decline_version', { n: pending.n })}>{t('Not now')}</button>
              <button className="btn" disabled={busy} onClick={() => act('accept_version', { n: pending.n })}>{t('Accept change')}</button>
            </div>
          </div>
        )}

        {/* ask for a change */}
        {['making', 'ready'].includes(o.stage) && !pending && !d.pendingChangeRequest && (
          <button className="btn ghost" onClick={() => setChgOpen(true)}>{t('Ask for a change')}</button>
        )}
        {d.pendingChangeRequest && (
          <div className="note warn">{t('You asked for a change: “{note}”. Ananya will send the new price for you to approve.', { note: d.pendingChangeRequest.note })}</div>
        )}
        {(o.changeRequests || []).length > 0 && !d.pendingChangeRequest && !pending && o.changeRequests[o.changeRequests.length - 1].status === 'declined' && (
          <div className="note bad">{t('Ananya could not make that change.')}</div>
        )}

        {/* 3. pay */}
        {r && o.stage !== 'cancelled' && (
          <div className="card col" style={{ borderColor: '#bcd5fb', background: '#f2f7ff' }}>
            <div className="tiny muted">{t('Payment due')} · {t(r.stepName)}</div>
            <div className="big">{inr(r.amount)}</div>
            <a className="btn" href={r.url}><Icon n="rupee" />{t('Pay {amt}', { amt: inr(r.amount) })}</a>
            <div className="tiny muted">{t('Secure payment by Razorpay: UPI, cards, netbanking.')}</div>
            {!d.pendingClaim && (
              <button className="btn ghost sm" onClick={() => setClaimOpen(true)}>{t('I paid {name} directly by UPI', { name: 'Ananya' })}</button>
            )}
          </div>
        )}
        {d.pendingClaim && (
          <div className="note warn">{t('You told Ananya you paid {amt}. It will show as paid once she confirms it.', { amt: inr(d.pendingClaim.amount) })}</div>
        )}
        {(o.claims || []).some((c) => c.status === 'rejected') && !d.pendingClaim && r && (
          <div className="note bad">{t('Ananya could not see your last UPI payment. Please check, or use the payment button above.')}</div>
        )}
        {!r && o.stage !== 'awaiting_acceptance' && o.stage !== 'cancelled' && d.remaining > 0 && !pending && (
          <div className="note">{t('Nothing to pay right now. {name} will send the next payment request when it is due.', { name: 'Ananya' })}</div>
        )}
        {d.remaining === 0 && o.payments.length > 0 && o.stage !== 'cancelled' && <div className="note ok">{t('Fully paid. Thank you, {name}!', { name: first })}</div>}
        {o.cod && o.cod.state !== 'remitted' && d.remaining > 0 && <div className="note warn">{t('{amt} to be paid when your order arrives.', { amt: inr(o.cod.amount) })}</div>}

        {o.dispatch && (
          <div className="card row">
            <Icon n="truck" />
            <div className="grow"><div className="bold">{t('Dispatched with {c}', { c: o.dispatch.courier })}</div><div className="small muted num">{o.dispatch.tracking || ''}</div></div>
          </div>
        )}

        <section className="card col">
          <div className="sec" style={{ padding: 0 }}><span>{t('Payments and receipts')}</span></div>
          {o.payments.length === 0 && <div className="small muted">{t('No payments yet')}</div>}
          {o.payments.map((p) => (
            <button key={p.id} className="row between" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => setReceipt(p)}>
              <span><b className="num">{inr(p.amount)}</b><br /><span className="tiny muted">{methodLabel(p.method, t)} · {fmtDateTime(p.at)}</span></span>
              <Pill tone="info">{t('Receipt')}</Pill>
            </button>
          ))}
        </section>

        <section className="card col">
          <div className="sec" style={{ padding: 0 }}><span>{t('Versions of this order')}</span></div>
          <VersionList o={o} />
          {o.acceptedAt && <div className="small muted">{t('You accepted the terms on {when}', { when: fmtDateTime(o.acceptedAt) })}</div>}
        </section>
      </main>

      {chgOpen && (
        <Sheet title={t('Ask for a change')} onClose={() => setChgOpen(false)}>
          <div className="small muted">{t('Tell Ananya what you would like. She will send a new price. Nothing changes until you accept it.')}</div>
          <Field label={t('What would you like to change?')}><textarea value={chgNote} onChange={(e) => setChgNote(e.target.value)} placeholder={t('e.g. 2 matching cushions in the same velvet')} /></Field>
          <button className="btn" disabled={busy || !chgNote.trim()} onClick={async () => { await act('request_change', { note: chgNote }); setChgOpen(false); setChgNote(''); }}>{t('Send to Ananya')}</button>
        </Sheet>
      )}

      {claimOpen && (
        <Sheet title={t('Paid directly by UPI')} onClose={() => setClaimOpen(false)}>
          <div className="small muted">{t('Pay to ananya.interiors@okaxis, then tell Ananya here. She will check her account and confirm.')}</div>
          <div className="card row between"><span className="muted small">{t('Amount')}</span><b className="num">{inr(d.dueNow)}</b></div>
          <Field label={t('UPI reference (optional)')}><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="4123 5567 8890" /></Field>
          <button className="btn" disabled={busy} onClick={async () => { await act('claim_paid', { amount: d.dueNow, ref }); setClaimOpen(false); setRef(''); }}>{t('Tell Ananya I have paid')}</button>
        </Sheet>
      )}

      {receipt && (
        <Sheet title={t('Receipt')} onClose={() => setReceipt(null)}>
          <div className="card col">
            <div className="big">{inr(receipt.amount)}</div>
            <div className="small">{o.item}</div>
            <hr className="divider" />
            <div className="row between small"><span className="muted">{t('Paid to')}</span><span>Ananya Interiors</span></div>
            <div className="row between small"><span className="muted">{t('Paid by')}</span><span>{o.customer.name}</span></div>
            <div className="row between small"><span className="muted">{t('Method')}</span><span>{methodLabel(receipt.method, t)}</span></div>
            <div className="row between small"><span className="muted">{t('Date')}</span><span>{fmtDateTime(receipt.at)}</span></div>
            <div className="row between small"><span className="muted">{t('Reference')}</span><span className="num">{receipt.ref}</span></div>
            <div className="row between small"><span className="muted">{t('Order balance after this')}</span><span className="num">{inr(Math.max(0, o.total - o.payments.filter((x) => x.at <= receipt.at).reduce((a, x) => a + x.amount, 0)))}</span></div>
          </div>
          {receipt.source !== 'razorpay' && <div className="note warn">{t('This payment was noted by the seller. It was not paid through Razorpay.')}</div>}
        </Sheet>
      )}
    </div>
  );
}
