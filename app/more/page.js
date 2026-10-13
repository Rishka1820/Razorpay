'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LangSwitch, Pill, Shell, Spinner, useApp } from '@/components/kit';
import { api, getDemoChat, setDemoChat, usePoll } from '@/lib/client';


function b64(k) {
  const pad = '='.repeat((4 - (k.length % 4)) % 4);
  const raw = atob((k + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function PushCard() {
  const { t, toast } = useApp();
  const [state, setState] = useState('checking');
  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub && Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);
  async function turnOn() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'blocked' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api('/api/push/key');
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }));
      await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      await api('/api/push/test', { method: 'POST', body: {} });
      setState('on');
    } catch (e) {
      toast(e.message || t('Could not turn on notifications'));
    }
  }
  async function turnOff() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    setState('off');
  }
  return (
    <div className="card col">
      <div className="sec" style={{ padding: 0 }}><span>{t('Phone notifications')}</span></div>
      <div className="small muted">{t('Get a notification when a payment arrives, a customer approves or asks for a change, or a payment date is reached. It works even when the app is closed.')}</div>
      {state === 'on' && <button className="btn ghost" onClick={turnOff}>{t('Turn off notifications')}</button>}
      {state === 'off' && <button className="btn" onClick={turnOn}>{t('Turn on notifications')}</button>}
      {state === 'blocked' && <div className="note warn">{t('Notifications are blocked for this app. Allow them in your browser or phone settings.')}</div>}
      {state === 'unsupported' && <div className="note warn">{t('On iPhone, add this app to your Home Screen first, then turn notifications on.')}</div>}
    </div>
  );
}

export default function More() {
  const { t, role, setRole, toast } = useApp();
  const { data: status } = usePoll('/api/status');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(true);
  useEffect(() => setDemo(getDemoChat()), []);

  async function reset() {
    setBusy(true);
    try {
      await api('/api/reset', { method: 'POST' });
      toast(t('Sample data reset'));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell active="more" title={t('Account')}>
      <div className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Who\'s using the app')}</span></div>
        <div className="seg">
          <button className={role === 'owner' ? 'on' : ''} onClick={() => setRole('owner')}>{t('Owner')}</button>
          <button className={role === 'staff' ? 'on' : ''} onClick={() => setRole('staff')}>{t('Staff')}</button>
        </div>
        <div className="small muted">{t('Staff can see today\'s list, collect payments and dispatch. Only the owner can change prices, cancel orders and refund.')}</div>
      </div>

      <PushCard />

      <div className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('When I tap Send on WhatsApp')}</span></div>
        <div className="seg">
          <button className={demo ? 'on' : ''} onClick={() => { setDemo(true); setDemoChat(true); }}>{t('Show in customer chat')}</button>
          <button className={!demo ? 'on' : ''} onClick={() => { setDemo(false); setDemoChat(false); }}>{t('Open WhatsApp')}</button>
        </div>
        <div className="small muted">{t('Messages appear in the customer chat screen. “Open WhatsApp” sends from your own phone.')}</div>
      </div>

      <div className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('Language')}</span></div>
        <div style={{ width: 'fit-content' }}><LangSwitch /></div>
      </div>

      <Link href="/metrics" className="card row between"><span className="bold">{t('How we measure success')}</span><span className="muted">›</span></Link>
      <Link href="/chat" className="card row between"><span className="bold">{t('Customer chat')}</span><span className="muted">›</span></Link>

      <div className="card col">
        <div className="sec" style={{ padding: 0 }}><span>{t('What is connected')}</span></div>
        <div className="row between small"><span>{t('Payments')}</span><Pill tone={status?.razorpay === 'simulated' ? 'warn' : 'ok'}>{status ? (t('Razorpay test mode')) : '…'}</Pill></div>
        <div className="row between small"><span>{t('Reading chats and bills')}</span><Pill tone={status?.ai === 'Claude' ? 'ok' : 'warn'}>{status ? (status.ai === 'Claude' ? 'Claude' : t('Simple rules')) : '…'}</Pill></div>
        <div className="row between small"><span>{t('Storage')}</span><Pill tone={status?.storage === 'postgres' ? 'ok' : 'warn'}>{status ? (status.storage === 'postgres' ? 'Postgres' : t('Temporary')) : '…'}</Pill></div>
        <div className="tiny muted">{t('QR codes, automatic WhatsApp sending and courier tracking come next.')}</div>
      </div>

      <button className="btn danger" disabled={busy || role !== 'owner'} onClick={reset}>{busy ? <Spinner /> : null}{t('Reset sample data')}</button>
    </Shell>
  );
}
