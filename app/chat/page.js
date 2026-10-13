'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/kit';
import { copyText } from '@/lib/client';

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

const pad = (n) => String(n).padStart(2, '0');

export default function ChatSim() {
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [sel, setSel] = useState([]);
  const [toast, setToast] = useState('');
  const endRef = useRef(null);
  const timers = useRef([]);
  const chat = CHATS.find((c) => c.id === open);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [shown, typing, open]);

  function openChat(id) {
    timers.current.forEach(clearTimeout);
    setOpen(id);
    setShown(CHATS.find((c) => c.id === id).messages.length);
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

  async function copySel() {
    const day = new Date();
    const stamp = `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${String(day.getFullYear()).slice(2)}`;
    const lines = sel.sort((a, b) => a - b).map((i) => {
      const m = chat.messages[i];
      return `[${stamp}, ${m.t}] ${m.from === 'me' ? 'Ananya' : chat.name}: ${m.text}`;
    });
    const ok = await copyText(lines.join('\n'));
    setToast(ok ? 'Copied. Paste it into the seller app.' : 'Copy failed. Select the text by hand.');
    setSel([]);
    setTimeout(() => setToast(''), 2400);
  }

  const toggle = (i) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  if (!chat) {
    return (
      <div className="phone" style={{ background: '#fff' }}>
        <header className="top" style={{ background: '#1f4d3f' }}><h1>Chats</h1></header>
        <div className="demo-bar"><span>Chat simulator for the demo video. Not WhatsApp.</span></div>
        <div className="main" style={{ background: '#fff' }}>
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
      <header className="top" style={{ background: sel.length ? '#2a6b58' : '#1f4d3f' }}>
        {sel.length ? (
          <>
            <button className="iconbtn" aria-label="Clear selection" onClick={() => setSel([])}><Icon n="x" /></button>
            <h1>{sel.length} selected</h1>
            <button className="iconbtn" aria-label="Copy" onClick={copySel}><Icon n="copy" /></button>
          </>
        ) : (
          <>
            <button className="iconbtn" aria-label="Back" onClick={() => setOpen(null)}><Icon n="back" /></button>
            <div className="avatar" style={{ background: '#dff1ea', color: '#1f4d3f', width: 34, height: 34 }}>P</div>
            <div className="grow"><h1 style={{ fontSize: 16 }}>{chat.name}</h1><div className="sub">{typing ? 'typing…' : '+91 98290 11234'}</div></div>
            <button className="iconbtn" aria-label="Replay conversation" title="Replay" onClick={replay}><Icon n="play" /></button>
          </>
        )}
      </header>
      <div className="main" style={{ gap: 6, paddingBottom: 20 }}>
        {chat.messages.slice(0, shown).map((m, i) => (
          <button
            key={i}
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
            {m.text}
            <div style={{ fontSize: 10.5, color: '#667781', textAlign: 'right', marginTop: 2 }}>{m.t}</div>
          </button>
        ))}
        {typing && <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: 12, padding: '8px 14px', color: '#667781' }}>•••</div>}
        <div ref={endRef} />
      </div>
      <div style={{ background: '#f0f2f5', padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))', fontSize: 12.5, color: '#51606b', position: 'sticky', bottom: 0 }}>
        Tap a message to select it, then tap the copy icon at the top. ▶ replays the conversation.
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
