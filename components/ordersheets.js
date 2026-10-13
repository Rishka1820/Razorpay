'use client';
import { useState } from 'react';
import { Field, Icon, Pill, Sheet, Spinner } from '@/components/kit';
import { fileToDataUrl } from '@/lib/client';
import { cumTargets, frozenAfter } from '@/lib/model';
import { inr, prettyPhone } from '@/lib/format';

export function CollectSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const r = o.activeRequest;
  const stale = r && r.amount !== d.dueNow;
  const [photo, setPhoto] = useState(null);
  const canPhoto = o.stage === 'making' && d.step.key !== 'advance';
  return (
    <Sheet title={t('Collect payment')} onClose={() => setSheet(null)}>
      <div className="card col summary">
        <div className="eyebrow">{r ? t('Requested') : t('Due now')} · {t(d.step.name)}</div>
        <div className="big">{inr(r ? r.amount : d.dueNow)}</div>
        <div className="small muted">{t('from {name}', { name: o.customer.name })} · {t('Paid {paid} of {total}', { paid: inr(d.paid), total: inr(o.total) })}</div>
      </div>
      {d.dueNow <= 0 && <div className="note ok">{t('Nothing is due. This was just paid.')}</div>}
      {r ? (
        <div className="col">
          <div className="rows">
            <div className="r"><span className="ic"><Icon n="link" s={18} /></span><div className="grow"><div className="k">{t('Link')}</div><div className="v mono">{r.url.replace(/^https?:\/\//, '')}</div></div><button className="btn ghost sm" onClick={() => copyLink(r.url)}><Icon n="copy" s={16} />{t('Copy')}</button></div>
            <div className="r"><span className="ic"><Icon n="user" s={18} /></span><div className="grow"><div className="k">{t('Customer')}</div><div className="v">{o.customer.name} · {prettyPhone(o.customer.phone) || t('No number')}</div></div></div>
            <div className="r"><span className="ic"><Icon n="doc" s={18} /></span><div className="grow"><div className="k">{t('Description')}</div><div className="v">{o.item} · {t(r.stepName)}</div></div></div>
          </div>
          {stale && <div className="note warn">{t('This request is for an old amount. Replace it so the customer pays {amt}.', { amt: inr(d.dueNow) })}</div>}
          <button className="btn" onClick={() => share('pay')}><Icon n="share" />{t('Send on WhatsApp')}</button>
          <div className="btnrow">
            <a className="btn ghost" href={r.url} target="_blank" rel="noreferrer">{t('Open as customer')}</a>
          </div>
          {stale && <button className="btn soft" disabled={busy} onClick={() => act('request_payment', {}, 'Request replaced')}>{t('Replace with {amt}', { amt: inr(d.dueNow) })}</button>}
          <button className="btn danger" disabled={busy} onClick={() => act('cancel_request', {}, 'Request cancelled')}>{t('Cancel this request')}</button>
        </div>
      ) : (
        d.dueNow > 0 && (
          <>
            {canPhoto && (
              <div className="col" style={{ gap: 8 }}>
                {photo && <div className="photo"><img src={photo} alt="Progress" /></div>}
                <label className="btn ghost" htmlFor="pphoto" style={{ cursor: 'pointer' }}><Icon n="camera" />{photo ? t('Retake progress photo') : t('Add a progress photo')}</label>
                <input id="pphoto" type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f, 900, 0.7)); }} />
                <div className="tiny muted">{t('Optional. Your customer sees how the work looks next to the amount you ask for.')}</div>
              </div>
            )}
            <button className="btn" disabled={busy} onClick={() => act('request_payment', { photo }, 'Payment request created')}>
              {busy ? <Spinner /> : <Icon n="link" />}{t('Create payment link for {amt}', { amt: inr(d.dueNow) })}
            </button>
          </>
        )
      )}
      <hr className="divider" />
      <div className="small muted">{t('Did the customer pay you another way?')}</div>
      <button className="btn ghost" onClick={() => setSheet('manual')}>{t('Mark paid outside Razorpay')}</button>
      <div className="tiny muted">{t('An order has one open payment request at a time. A new one replaces the old one.')}</div>
    </Sheet>
  );
}

export function ManualSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [amount, setAmount] = useState(String(d.dueNow || ''));
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  return (
    <Sheet title={t('Mark paid outside Razorpay')} onClose={() => setSheet('collect')}>
      <div className="note warn">{t('This will show as “Recorded by you”, since Razorpay didn\'t confirm it. Any open payment link will be cancelled.')}</div>
      <Field label={t('Amount received (₹)')}><input id="mamt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label={t('How was it paid')}>
        <select id="mmeth" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">{t('Cash')}</option>
          <option value="upi_personal">{t('Personal UPI')}</option>
        </select>
      </Field>
      <Field label={t('Reference (optional)')}><input id="mref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('UPI ref or receipt no.')} /></Field>
      <button className="btn" disabled={busy} onClick={async () => { if (await act('record_manual', { amount, method, ref }, 'Payment recorded')) setSheet(null); }}>{t('Save payment')}</button>
    </Sheet>
  );
}

export function ChangeSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [total, setTotal] = useState(String(o.total));
  const req = d.pendingChangeRequest;
  const [note, setNote] = useState(req ? req.note : '');
  const n = Number(total) || 0;
  const after = n ? Math.max(0, cumTargets(n, o.plan, { ...(o.frozen || {}), ...frozenAfter(o) })[d.idx] - d.paid) : 0;
  return (
    <Sheet title={t('Propose a change')} onClose={() => setSheet(null)}>
      {req && <div className="note warn">{t('The customer asked: “{note}”. Set a new total for them to approve.', { note: req.note })}</div>}
      <div className="small muted">{t('The customer has to approve the change. Until then, the old total stays.')}</div>
      <Field label={t('What changed')}><input id="cnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. 2 more items added')} /></Field>
      <Field label={t('New total (₹)')}><input id="ctotal" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))} /></Field>
      {n > 0 && n !== o.total && (
        <div className="note">
          {t('Already received: {paid}. Remaining after approval: {rem}.', { paid: inr(d.paid), rem: inr(Math.max(0, n - d.paid)) })}{after > 0 ? ' ' + t('Due now: {after}.', { after: inr(after) }) : ''}
          {d.paid > n && ` ${t('You\'d need to refund {amt}.', { amt: inr(d.paid - n) })}`}
        </div>
      )}
      <button className="btn" disabled={busy || !n || n === o.total} onClick={async () => { const x = await act('propose_version', { total: n, note, requestId: req ? req.id : undefined }, 'Change saved. Send it to the customer to accept'); if (x) setSheet(null); }}>
        {t('Send to customer for approval')}
      </button>
    </Sheet>
  );
}

export function ReadySheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [photo, setPhoto] = useState(null);
  const [mode, setMode] = useState('prepaid');
  const opts = [
    ['prepaid', 'Pay before dispatch', 'Customer pays the balance by link, then you ship'],
    ['cod', 'Pay on delivery', 'Customer pays online or in cash when it arrives'],
    ['pickup', 'Pickup', 'Customer collects it and pays in person'],
  ];
  return (
    <Sheet title={t('Mark ready')} onClose={() => setSheet(null)}>
      {photo ? <div className="photo"><img src={photo} alt="Finished piece" /></div> : <div className="photo">{t('Photo of the finished item')}</div>}
      <label className="btn ghost" htmlFor="rphoto" style={{ cursor: 'pointer' }}><Icon n="camera" />{photo ? t('Retake') : t('Add photo')}</label>
      <input id="rphoto" type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f, 900, 0.7)); }} />
      <div className="tiny muted">{t('A photo of the finished item shows the customer it is ready.')}</div>
      {opts.map(([k, a, b]) => (
        <button key={k} className={`choice ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>
          <span className="radio" /><span><span className="bold">{t(a)}</span><br /><span className="small muted">{t(b)}</span></span>
        </button>
      ))}
      <button className="btn" disabled={busy} onClick={async () => { if (await act('mark_ready', { photo, mode }, 'Marked ready')) setSheet(null); }}>{t('Mark ready')}</button>
    </Sheet>
  );
}

export function DispatchSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const pickup = o.fulfilment === 'pickup';
  const blocked = d.remaining > 0 && o.fulfilment !== 'cod';
  return (
    <Sheet title={pickup ? t('Hand over in person') : t('Dispatch')} onClose={() => setSheet(null)}>
      {blocked && (
        <div className="note warn">
          {t('{amt} is still unpaid. Collect it first, or switch to pay on delivery.', { amt: inr(d.remaining) })}
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button className="btn sm ghost" onClick={() => setSheet('collect')}>{t('Collect')}</button>
            <button className="btn sm ghost" onClick={async () => { await act('set_fulfilment', { mode: 'cod' }); }}>{t('Pay on delivery')}</button>
          </div>
        </div>
      )}
      {o.fulfilment === 'cod' && d.remaining > 0 && <div className="note warn">{t('Dispatching with {amt} to be paid on delivery.', { amt: inr(d.remaining) })}</div>}
      {!pickup && (
        <>
          <Field label={t('Courier')}><input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery, DTDC…" /></Field>
          <Field label={t('Tracking number')}><input id="track" value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
        </>
      )}
      <button className="btn" disabled={busy || blocked} onClick={async () => { if (await act('dispatch', { courier, tracking }, 'Dispatched')) setSheet(null); }}>{pickup ? t('Handed over') : t('Dispatch')}</button>
    </Sheet>
  );
}

export function RemitSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [ref, setRef] = useState('');
  return (
    <Sheet title={t('The courier transferred the money to me')} onClose={() => setSheet(null)}>
      <div className="small muted">{t('Record this only once the money is in your account.')}</div>
      <Field label={t('Reference (optional)')}><input id="rref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('Courier remittance ref')} /></Field>
      <button className="btn" disabled={busy} onClick={async () => { if (await act('remittance_received', { ref }, 'Payment recorded')) setSheet(null); }}>{t('Save {amt}', { amt: inr(o.cod.amount) })}</button>
    </Sheet>
  );
}

export function CancelSheet({ c }) {
  const { o, d, t, toast, busy, act, setSheet, share, copyLink } = c;
  const [mode, setMode] = useState('keep');
  const [custom, setCustom] = useState('');
  const amount = mode === 'full' ? d.paid : mode === 'keep' ? 0 : Number(custom) || 0;
  return (
    <Sheet title={t('Cancel this order')} onClose={() => setSheet(null)}>
      <div className="small muted">{t('Paid so far: {amt}. Your terms say the advance is not refundable once work has started.', { amt: inr(d.paid) })}</div>
      {[['keep', 'Keep the advance'], ['full', 'Refund everything'], ['custom', 'Refund part']].map(([k, l]) => (
        <button key={k} className={`choice ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}><span className="radio" /><span className="bold">{t(l)}</span></button>
      ))}
      {mode === 'custom' && <Field label={t('Refund amount (₹)')}><input id="refund" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} /></Field>}
      <button className="btn danger" disabled={busy} onClick={async () => { if (await act('cancel', { refundAmount: amount }, 'Order cancelled')) setSheet(null); }}>{t('Cancel order and refund {amt}', { amt: inr(Math.min(amount, d.paid)) })}</button>
    </Sheet>
  );
}

export function DeliverySheet({ c }) {
  const { o, t, busy, act, setSheet } = c;
  const [date, setDate] = useState(o.deliveryDate || '');
  const [reason, setReason] = useState('');
  return (
    <Sheet title={t('Change delivery date')} onClose={() => setSheet(null)}>
      <div className="small muted">{t('Your customer is told about the new date. The earlier date stays in the order history.')}</div>
      <Field label={t('New delivery date')}>
        <input id="newdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t('Reason (optional)')}>
        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('For example: fabric arrived late')} />
      </Field>
      <button className="btn" disabled={busy || !date || date === o.deliveryDate} onClick={async () => { if (await act('change_delivery', { date, reason }, 'Delivery date updated')) setSheet(null); }}>{t('Update delivery date')}</button>
    </Sheet>
  );
}
