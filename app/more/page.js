'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LangSwitch, Pill, Shell, Spinner, useApp } from '@/components/kit';
import { api, getDemoChat, setDemoChat, usePoll } from '@/lib/client';

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
