'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/kit';
import { copyText, usePoll } from '@/lib/client';
import { fmtTime, prettyPhone } from '@/lib/format';

// A chat simulator for the demo video's side screen. It is not WhatsApp and carries no WhatsApp branding.
const CHATS = [
  {
    id: 'priya',
    name: 'Priya Mehra',
    status: 'new order',
    messages: [
      { from: 'them', t: '10:41 am', text: 'Hi Ananya, saw your olive velvet sofa on Instagram. Do you make it in a 3-seater?' },
      { from: 'me', t: '10:43 am', text: 'Hi Priya! Yes, 3-seater in olive velvet, 7 ft. Takes about 3 weeks.' },
      { from: 'them', t: '10:44 am', text: 'What would it cost?' },
      { from: 'me', t: '10:46 am', text: '₹38,000 including delivery to Jaipur. I start work on an advance.' },
      { from: 'them', t: '10:52 am', text: 'That works for me. Please confirm the order: 3-seater sofa in olive velvet, ₹38,000, I need it by 2 Nov. My number is 98290 11234, address is Malviya Nagar, Jaipur. I will pay 50% advance once you send the details.', key: true },
    ],
  },
  {
    id: 'priya2',
    name: 'Priya Mehra',
    status: 'change request',
    messages: [
      { from: 'them', t: '4:12 pm', text: 'Hi Ananya, the frame photos look lovely!' },
      { from: 'me', t: '4:15 pm', text: 'Thank you Priya! It is coming along well.' },
      { from: 'them', t: '4:18 pm', text: 'Can we add 2 matching cushions in the same velvet? How much extra?' },
      { from: 'me', t: '4:21 pm', text: 'Sure, 2 cushions are ₹4,000 extra.' },
      { from: 'them', t: '4:23 pm', text: 'Okay, please update the order. New total ₹42,000.', key: true },
    ],
  },
];

function linkify(text) {
  return String(text).split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#0b57d0', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a> : part
  );
}

const pad = (n) => String(n).padStart(2, '0');

export default function ChatSim() {
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [sel, setSel] = useState([]);
  const [toast, setToast] = useState('');
  const endRef = useRef(null);
  const timers = useRef([]);
  const { data } = usePoll('/api/orders', 2000);
  const liveOrders = (data?.orders || []).filter((o) => !o.sample && (o.thread || []).length > 0);
  const liveChat = (o) => {
    const lead = CHATS[0].name === o.customer.name ? CHATS[0].messages : [];
    return {
      id: 'live:' + o.id,
      live: true,
      orderId: o.id,
      name: o.customer.name,
      phone: prettyPhone(o.customer.phone),
      status: 'order chat',
      messages: [...lead, ...o.thread.map((m) => ({ from: m.from, text: m.text, t: fmtTime(m.at), auto: m.auto }))],
    };
  };
  const liveOpen = open && open.startsWith('live:') ? liveOrders.find((o) => 'live:' + o.id === open) : null;
  const chat = liveOpen ? liveChat(liveOpen) : CHATS.find((c) => c.id === open);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [shown, typing, open]);

  function openChat(id) {
    timers.current.forEach(clearTimeout);
    setOpen(id);
    setShown(999);
    setTyping(false);
    setSel([]);
  }

  function replay() {
    timers.current.forEach(clearTimeout);
    setSel([]);
    setShown(0);
    const msgs = chat.messages;
    let at = 400;
    msgs.forEach((m, i) => {
      if (m.from === 'them') {
        timers.current.push(setTimeout(() => setTyping(true), at));
        at += m.key ? 1800 : 900;
      } else at += 700;
      timers.current.push(setTimeout(() => { setTyping(false); setShown(i + 1); }, at));
      at += 500;
    });
  }

  function chatText(idx) {
    const day = new Date();
    const stamp = `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${String(day.getFullYear()).slice(2)}`;
    return [...idx].sort((a, b) => a - b).map((i) => {
      const m = chat.messages[i];
      return `[${stamp}, ${m.t}] ${m.from === 'me' ? 'Ananya' : chat.name}: ${m.text}`;
    }).join('\n');
  }

  // Same as the share sheet on a phone: the selected messages go straight into the seller app.
  function sendToOrders() {
    const idx = sel.length ? sel : chat.messages.map((_, i) => i);
    try {
      sessionStorage.setItem('incomingChat', chatText(idx));
    } catch {}
    router.push('/orders/new');
  }

  async function copySel() {
    const ok = await copyText(chatText(sel));
    setToast(ok ? 'Copied. Paste it into the seller app.' : 'Copy failed. Select the text by hand.');
    setSel([]);
    setTimeout(() => setToast(''), 2400);
  }

  const toggle = (i) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  if (!chat) {
    return (
      <div className="phone" style={{ background: '#fff' }}>
        <header className="top" style={{ background: '#1f4d3f', color: '#fff' }}><h1>Chats</h1></header>
        <div className="demo-bar"><span>Chat simulator for the demo video. Not WhatsApp.</span></div>
        <div className="main" style={{ background: '#fff' }}>
          {liveOrders.map((o) => {
            const last = o.thread[o.thread.length - 1];
            return (
              <button key={o.id} className="orow" style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0 }} onClick={() => openChat('live:' + o.id)}>
                <div className="avatar" style={{ background: '#dff1ea', color: '#1f4d3f' }}>{o.customer.name.slice(0, 1)}</div>
                <div className="grow">
                  <div className="bold">{o.customer.name}</div>
                  <div className="small muted trunc">{last.text}</div>
                </div>
                <span className="pill ok">order chat</span>
              </button>
            );
          })}
          {CHATS.map((c) => (
            <button key={c.id} className="orow" style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0 }} onClick={() => openChat(c.id)}>
              <div className="avatar" style={{ background: '#dff1ea', color: '#1f4d3f' }}>P</div>
              <div className="grow">
                <div className="bold">{c.name}</div>
                <div className="small muted trunc">{c.messages[c.messages.length - 1].text}</div>
              </div>
              <span className="pill">{c.status}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="phone" style={{ background: '#ece5dd' }}>
      <header className="top" style={{ background: sel.length ? '#2a6b58' : '#1f4d3f', color: '#fff', borderBottom: 0 }}>
        {sel.length ? (
          <>
            <button className="iconbtn" aria-label="Clear selection" onClick={() => setSel([])}><Icon n="x" /></button>
            <h1>{sel.length} selected</h1>
            <button className="iconbtn" aria-label="Copy" onClick={copySel}><Icon n="copy" /></button>
            <button className="iconbtn" aria-label="Send to Orders" onClick={sendToOrders} style={{ gap: 6, fontSize: 13, fontWeight: 600 }}><Icon n="share" /></button>
          </>
        ) : (
          <>
            <button className="iconbtn" aria-label="Back" onClick={() => setOpen(null)}><Icon n="back" /></button>
            <div className="avatar" style={{ background: '#dff1ea', color: '#1f4d3f', width: 34, height: 34 }}>{chat.name.slice(0, 1)}</div>
            <div className="grow"><h1 style={{ fontSize: 16 }}>{chat.name}</h1><div className="sub" style={{ color: 'rgba(255,255,255,.75)' }}>{typing ? 'typing…' : chat.live ? chat.phone : '+91 98290 11234'}</div></div>
            {!chat.live && <button className="iconbtn" aria-label="Replay conversation" title="Replay" onClick={replay}><Icon n="play" /></button>}
          </>
        )}
      </header>
      <div className="main" style={{ gap: 6, paddingBottom: 20 }}>
        {chat.messages.slice(0, chat.live ? 999 : shown).map((m, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => toggle(i)}
            style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              textAlign: 'left',
              background: sel.includes(i) ? '#bfe3d3' : m.from === 'me' ? '#d9fdd3' : '#fff',
              border: m.key && !sel.length ? '1.5px solid #5aa88c' : '1.5px solid transparent',
              borderRadius: 12,
              padding: '8px 10px 6px',
              boxShadow: '0 1px 1px rgba(0,0,0,.12)',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1.4,
              color: '#111',
            }}
          >
            {linkify(m.text)}
            <div style={{ fontSize: 10.5, color: '#667781', textAlign: 'right', marginTop: 2 }}>{m.auto ? 'automatic · ' : ''}{m.t}</div>
          </div>
        ))}
        {typing && <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 14px', color: '#667781' }}>•••</div>}
        <div ref={endRef} />
      </div>
      <div style={{ background: '#f0f2f5', padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))', fontSize: 12.5, color: '#51606b', position: 'sticky', bottom: 0 }}>
        {!chat.live && (
          <button className="btn" style={{ marginBottom: 8 }} onClick={sendToOrders}><Icon n="share" />{sel.length ? 'Send selected messages to Orders' : 'Send this chat to Orders'}</button>
        )}
        {chat.live ? 'Messages the app sends appear here, and so do the customer’s replies and payments. Tap a link to open the customer’s page.' : 'Tap messages to choose only some of them. ▶ replays the conversation.'}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
