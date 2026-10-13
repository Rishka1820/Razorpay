'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Icon, Pill, Shell, Spinner, useApp } from '@/components/kit';
import { api, fileToDataUrl } from '@/lib/client';
import { PLANS, cumTargets } from '@/lib/model';
import { inr, prettyPhone } from '@/lib/format';

const EMPTY = { name: '', phone: '', item: '', total: '', advance: '', advMethod: 'cash', advRef: '', deliveryDate: '', plan: '50-50', ai: {}, engine: null };

export default function NewOrder() {
  const { t, toast } = useApp();
  const router = useRouter();
  const t0 = useRef(Date.now());
  const [mode, setMode] = useState('chat');
  const [text, setText] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function pickImage(file) {
    if (!file) return;
    try {
      setImg(await fileToDataUrl(file, 1400, 0.8));
    } catch (e) {
      toast(e.message);
    }
  }

  async function read() {
    setBusy(true);
    try {
      const { fields: p } = await api('/api/parse', { method: 'POST', body: mode === 'bill' ? { image: img } : { text } });
      const pct = p.advance_percent_agreed;
      setForm({
        name: p.customer_name || '',
        phone: p.phone || '',
        item: p.item || '',
        total: p.total_inr || '',
        advance: mode === 'bill' && p.advance_received_inr ? p.advance_received_inr : '',
        advMethod: ['cash', 'upi_personal', 'bank'].includes(p.advance_method) ? p.advance_method : 'cash',
        advRef: mode === 'bill' ? 'Bill photo' : '',
        deliveryDate: p.delivery_date || '',
        plan: pct && pct <= 40 ? '40-30-30' : '50-50',
        notes: p.notes || '',
        engine: p.engine,
        ai: { name: !!p.customer_name, phone: !!p.phone, item: !!p.item, total: !!p.total_inr, advance: !!p.advance_received_inr, deliveryDate: !!p.delivery_date },
        source: mode,
      });
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      const adv = Number(form.advance) || 0;
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: {
          customer: { name: form.name, phone: form.phone },
          item: form.item,
          total: Number(form.total),
          plan: form.plan,
          deliveryDate: form.deliveryDate || null,
          source: form.source || 'manual',
          advance: adv > 0 ? { amount: adv, method: form.advMethod, ref: form.advRef } : null,
          createMs: Date.now() - t0.current,
        },
      });
      router.replace(`/orders/${order.id}?new=1`);
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  }

  const total = Number(form?.total) || 0;
  const cum = total ? cumTargets(total, form.plan) : [];
  const engineNote = {
    claude: ['ok', 'Read by Claude. Check every field before you continue.'],
    rules: ['warn', 'Read with simple rules because no AI key is set. Check every field.'],
    demo: ['warn', 'Demo reading: no AI key is set, so this is a sample bill. With a key, Claude reads your own photo.'],
  };

  return (
    <Shell title={t('New order')} back="/orders" nav={false}>
      {!form && (
        <>
          <div className="seg">
            <button className={mode === 'chat' ? 'on' : ''} onClick={() => setMode('chat')}>{t('Paste a chat')}</button>
            <button className={mode === 'bill' ? 'on' : ''} onClick={() => setMode('bill')}>{t('Scan a bill')}</button>
            <button className={mode === 'manual' ? 'on' : ''} onClick={() => { setMode('manual'); setForm({ ...EMPTY, source: 'manual' }); }}>{t('Type it')}</button>
          </div>

          {mode === 'chat' && (
            <div className="card col">
              <Field label={t('Copy the customer’s message from WhatsApp or Instagram and paste it here')}>
                <textarea id="chat" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Paste here…')} />
              </Field>
              <button className="btn" disabled={busy || !text.trim()} onClick={read}>{busy ? <Spinner /> : <Icon n="chat" />}{t('Read order from chat')}</button>
            </div>
          )}

          {mode === 'bill' && (
            <div className="card col">
              <div className="small muted">{t('Customer came to the studio and you gave a written bill? Photograph it and the order is created with the advance already noted.')}</div>
              {img ? <div className="photo"><img src={img} alt="Bill" /></div> : <div className="photo">{t('No photo yet')}</div>}
              <label className="btn ghost" htmlFor="billfile" style={{ cursor: 'pointer' }}>
                <Icon n="camera" />{img ? t('Retake') : t('Photograph the bill')}
              </label>
              <input id="billfile" type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
              <button className="btn" disabled={busy || !img} onClick={read}>{busy ? <Spinner /> : <Icon n="doc" />}{t('Read the bill')}</button>
            </div>
          )}
        </>
      )}

      {form && (
        <>
          {form.engine && <div className={`note ${engineNote[form.engine][0]}`}>{t(engineNote[form.engine][1])}</div>}
          <div className="card col">
            <Field label={t('Customer name')} ai={form.ai.name}>
              <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label={t('WhatsApp number')} ai={form.ai.phone}>
              <input id="phone" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98xxxxxxxx" />
              {!form.phone && <span className="tiny" style={{ color: 'var(--warn)' }}>{t('Needed to share the order and payment links')}</span>}
            </Field>
            <Field label={t('What is being made')} ai={form.ai.item}>
              <input id="item" value={form.item} onChange={(e) => set('item', e.target.value)} />
            </Field>
            <div className="grid2">
              <Field label={t('Agreed total (₹)')} ai={form.ai.total}>
                <input id="total" inputMode="numeric" value={form.total} onChange={(e) => set('total', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label={t('Deliver by')} ai={form.ai.deliveryDate}>
                <input id="date" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="card col">
            <div className="bold">{t('Payment plan')}</div>
            <div className="seg">
              {Object.entries(PLANS).map(([k, p]) => (
                <button key={k} className={form.plan === k ? 'on' : ''} onClick={() => set('plan', k)}>{p.label}</button>
              ))}
            </div>
            {total > 0 && (
              <div className="small muted num">
                {PLANS[form.plan].steps.map((s, i) => `${t(s.name)} ${inr(cum[i] - (cum[i - 1] || 0))}`).join(' · ')}
              </div>
            )}
          </div>

          <div className="card col">
            <div className="row between"><div className="bold">{t('Advance already received?')}</div>{form.ai.advance && <span className="ai">AI</span>}</div>
            <div className="small muted">{t('Only fill this if the customer has already paid you. Otherwise they accept the order and pay the advance by link.')}</div>
            <div className="grid2">
              <Field label={t('Amount (₹)')}>
                <input id="adv" inputMode="numeric" value={form.advance} onChange={(e) => set('advance', e.target.value.replace(/\D/g, ''))} placeholder="0" />
              </Field>
              <Field label={t('How')}>
                <select id="advm" value={form.advMethod} onChange={(e) => set('advMethod', e.target.value)}>
                  <option value="cash">{t('Cash')}</option>
                  <option value="upi_personal">{t('Personal UPI')}</option>
                  <option value="bank">{t('Bank transfer')}</option>
                </select>
              </Field>
            </div>
            {Number(form.advance) > 0 && <div className="note warn">{t('This will be marked “Recorded by you”, because the money did not come through Razorpay.')}</div>}
          </div>

          <button className="btn" disabled={busy} onClick={create}>{busy ? <Spinner /> : <Icon n="check" />}{t('Create order')}</button>
          <button className="btn ghost" onClick={() => setForm(null)}>{t('Start again')}</button>
        </>
      )}
    </Shell>
  );
}
