'use client';
import { BUSINESS } from '@/lib/config';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/kit';
import { api, usePoll } from '@/lib/client';
import { inr } from '@/lib/format';

// Stand-in for Razorpay's hosted test checkout. Only used when no Razorpay keys are set.
export default function MockPay({ params }) {
  const { linkId } = params;
  const router = useRouter();
  const { data, err } = usePoll(`/api/mockpay/${linkId}`);
  const [method, setMethod] = useState('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function pay() {
    setBusy(true);
    try {
      const r = await api(`/api/mockpay/${linkId}`, { method: 'POST' });
      router.replace(`/c/${r.orderId}?paid=1`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="phone" style={{ background: '#fff' }}>
      <div className="demo-bar"><span>Simulated checkout. With Razorpay test keys, this page is Razorpay’s hosted checkout.</span></div>
      <main className="main" style={{ gap: 14 }}>
        <div className="row">
          <div className="avatar" style={{ background: '#e8f0ff' }}>A</div>
          <div className="grow"><div className="bold">{BUSINESS.name}</div><div className="small muted trunc">{data ? data.item : ' '}</div></div>
        </div>
        {err && <div className="note bad">{err}</div>}
        {data && !data.active && <div className="note bad">{data.paid ? 'This link has already been paid.' : 'This payment link is no longer active. The seller replaced or cancelled it. Ask for a new one.'}</div>}
        {data?.active && (
          <>
            <div className="card"><div className="tiny muted">Amount</div><div className="big">{inr(data.amount)}</div></div>
            {[['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking']].map(([k, l]) => (
              <button key={k} className={`choice ${method === k ? 'on' : ''}`} onClick={() => setMethod(k)}><span className="radio" /><span className="bold">{l}</span></button>
            ))}
            {error && <div className="note bad">{error}</div>}
            <button className="btn" disabled={busy} onClick={pay}>{busy ? <Spinner /> : null}Pay {inr(data.amount)}</button>
            <div className="tiny muted" style={{ textAlign: 'center' }}>Test mode. No real money moves.</div>
          </>
        )}
      </main>
    </div>
  );
}
