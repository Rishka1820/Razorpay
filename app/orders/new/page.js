'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Icon, Pill, Shell, Spinner, useApp } from '@/components/kit';
import { api, fileToDataUrl } from '@/lib/client';
import { PLANS, cumTargets, defaultStageDates } from '@/lib/model';
import { inr, prettyPhone } from '@/lib/format';

const EMPTY = { name: '', phone: '', item: '', total: '', advance: '', advMethod: 'cash', advRef: '', deliveryDate: '', plan: '40-30-30', ai: {}, engine: null };

const SAMPLE = `[10:02] Priya: Hi, I'd like your 3-seater sofa in olive velvet\n[10:05] Tanushree: Sure! Final price ₹38,000. Delivery by 2 Nov\n[10:06] Priya: Okay, confirm my order: 3-seater sofa in olive velvet, ₹38,000. I'll pay 40% advance\n[10:07] Tanushree: Done`;

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

  // A chat can arrive without copy and paste: from the customer chat, or shared from WhatsApp into the installed app.
  useEffect(() => {
    let incoming = '';
    try {
      const q = new URLSearchParams(window.location.search);
      incoming = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n');
      if (!incoming) {
        incoming = sessionStorage.getItem('incomingChat') || '';
        sessionStorage.removeItem('incomingChat');
      }
    } catch {}
    if (incoming.trim()) {
      setMode('chat');
      setText(incoming);
      read(incoming, 'chat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function read(chatText, forceMode) {
    const m = forceMode || mode;
    const body = m === 'bill' ? { image: img } : { text: typeof chatText === 'string' ? chatText : text };
    setBusy(true);
    try {
      const { fields: p } = await api('/api/parse', { method: 'POST', body });
      const pct = p.advance_percent_agreed;
      setForm({
        name: p.customer_name || '',
        phone: p.phone || '',
        item: p.item || '',
        total: p.total_inr || '',
        advance: m === 'bill' && p.advance_received_inr ? p.advance_received_inr : '',
        advMethod: ['cash', 'upi_personal', 'bank'].includes(p.advance_method) ? p.advance_method : 'cash',
        advRef: m === 'bill' ? 'Bill photo' : '',
        deliveryDate: p.delivery_date || '',
        plan: !pct ? '40-30-30' : pct === 40 ? '40-30-30' : pct === 50 ? '50-50' : PLANS[`${Math.round(pct / 5) * 5}-${100 - Math.round(pct / 5) * 5}`] ? `${Math.round(pct / 5) * 5}-${100 - Math.round(pct / 5) * 5}` : '50-50',
        statedPct: pct || null,
        flags: p.flags || {},
        notes: p.notes || '',
        engine: p.engine,
        midDate: undefined,
        ai: { name: !!p.customer_name, phone: !!p.phone, item: !!p.item, total: !!p.total_inr, advance: !!p.advance_received_inr, deliveryDate: !!p.delivery_date },
        source: m,
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
          stageDates: form.plan === '40-30-30' ? { frame_ready: form.midDate ?? defaultStageDates(form.plan, form.deliveryDate).frame_ready } : {},
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
    rules: ['ok', 'Filled in from your chat. Check every field before you continue.'],
    demo: ['warn', 'Sample bill shown. Claude reads your own photo once it is connected.'],
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
              <Field label={t('Paste a chat from WhatsApp or Instagram, or share it straight to this app')}>
                <textarea id="chat" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Paste here…')} />
              </Field>
              <button className="btn ghost" onClick={() => setText(SAMPLE)}>{t('Try a sample conversation')}</button>
              <button className="btn" disabled={busy || !text.trim()} onClick={() => read()}>{busy ? <Spinner /> : <Icon n="chat" />}{t('Read order from chat')}</button>
            </div>
          )}

          {mode === 'bill' && (
            <div className="card col">
              <div className="small muted">{t('Gave the customer a paper bill? Take a photo and we\'ll create the order, with the advance already noted.')}</div>
              {img ? <div className="photo"><img src={img} alt="Bill" /></div> : <div className="photo">{t('No photo yet')}</div>}
              <label className="btn ghost" htmlFor="billfile" style={{ cursor: 'pointer' }}>
                <Icon n="camera" />{img ? t('Retake') : t('Photograph the bill')}
              </label>
              <input id="billfile" type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
              <button className="btn" disabled={busy || !img} onClick={() => read()}>{busy ? <Spinner /> : <Icon n="doc" />}{t('Read the bill')}</button>
            </div>
          )}
        </>
      )}

      {form && (
        <>
          {form.engine && <div className={`note ${engineNote[form.engine][0]}`}>{t(engineNote[form.engine][1])}</div>}
          {form.flags?.total_ambiguous && (
            <div className="note warn">{t('The chat mentions more than one price')}: {form.flags.alternatives.map((v) => inr(v)).join(', ')}. {t('We used the latest one. Please confirm the total.')}</div>
          )}
          {form.statedPct && form.statedPct !== 40 && form.statedPct !== 50 && (
            <div className="note ok">{t('The chat says')} {form.statedPct}% {t('advance, so the plan below uses it. Change it if that is not what was agreed.')}</div>
          )}
          <div className="card col">
            <Field label={t('Customer name')} ai={form.ai.name}>
              <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              {form.source === 'chat' && !form.name && <span className="tiny" style={{ color: 'var(--warn)' }}>{t('Customer name not found in the chat')}</span>}
            </Field>
            <Field label={t('WhatsApp number')} ai={form.ai.phone}>
              <input id="phone" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="98xxxxxxxx" />
              {!form.phone && <span className="tiny" style={{ color: 'var(--warn)' }}>{t('Needed to send the order and payment links')}</span>}
            </Field>
            <Field label={t('What is being made')} ai={form.ai.item}>
              <input id="item" value={form.item} onChange={(e) => set('item', e.target.value)} />
            </Field>
            <div className="grid2">
              <Field label={t('Agreed total (₹)')} ai={form.ai.total}>
                <input id="total" inputMode="numeric" value={form.total} onChange={(e) => set('total', e.target.value.replace(/\D/g, ''))} />
                {form.source === 'chat' && !form.total && <span className="tiny" style={{ color: 'var(--warn)' }}>{t('Price not found in the chat')}</span>}
              </Field>
              <Field label={t('Deliver by')} ai={form.ai.deliveryDate}>
                <input id="date" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
                {form.source === 'chat' && !form.deliveryDate && <span className="tiny" style={{ color: 'var(--warn)' }}>{t('Date not found in the chat')}</span>}
              </Field>
            </div>
          </div>

          <div className="card col">
            <div className="bold">{t('Payment plan')}</div>
            <div className="seg">
              {Object.entries(PLANS).filter(([k]) => k === '40-30-30' || k === '50-50' || k === form.plan).map(([k, p]) => (
                <button key={k} className={form.plan === k ? 'on' : ''} onClick={() => set('plan', k)}>{p.label}</button>
              ))}
            </div>
            {total > 0 && (
              <div className="small muted num">
                {PLANS[form.plan].steps.map((s, i) => `${t(s.name)} ${inr(cum[i] - (cum[i - 1] || 0))}`).join(' · ')}
              </div>
            )}
          </div>

          {form.plan === '40-30-30' && form.deliveryDate && (
            <div className="card col">
              <div className="bold">{t('Midway payment date (suggested, please confirm)')}</div>
              <div className="small muted">{t('Agreed with the customer now. On this date the app asks you to collect it. You can also ask earlier.')}</div>
              <input id="mid" type="date" value={form.midDate ?? (defaultStageDates(form.plan, form.deliveryDate).frame_ready || '')} onChange={(e) => set('midDate', e.target.value)} />
            </div>
          )}

          <div className="card col">
            <div className="row between"><div className="bold">{t('Advance already received?')}</div></div>
            <div className="small muted">{t('Fill this in only if the customer has already paid you. Otherwise they\'ll accept the order and pay the advance by link.')}</div>
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
            {Number(form.advance) > 0 && <div className="note warn">{t('This will show as “Recorded by you”, because the money didn\'t come through Razorpay.')}</div>}
          </div>

          <button className="btn" disabled={busy} onClick={create}>{busy ? <Spinner /> : <Icon n="check" />}{t('Create order')}</button>
          <button className="btn ghost" onClick={() => setForm(null)}>{t('Start again')}</button>
        </>
      )}
    </Shell>
  );
}
