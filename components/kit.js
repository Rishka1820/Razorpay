'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { tr } from '@/lib/i18n';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function Providers({ children }) {
  const [lang, setLangState] = useState('en');
  const [role, setRoleState] = useState('owner');
  const [toastMsg, setToastMsg] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    try {
      const l = localStorage.getItem('lang');
      if (l === 'hi' || l === 'en') setLangState(l);
    } catch {}
    fetch('/api/session', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.role && setRoleState(j.role)).catch(() => {});
  }, []);

  const setLang = (l) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch {}
  };
  const setRole = async (r) => {
    await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: r }) });
    setRoleState(r);
  };
  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);
  const t = useCallback((k, v) => tr(lang, k, v), [lang]);

  return (
    <Ctx.Provider value={{ lang, setLang, role, setRole, toast, t }}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  rupee: 'M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4M14 18v2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  check: 'M5 12l5 5 9-10',
  chat: 'M4 5h16v11H9l-5 4z',
  refund: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v7h14v-7',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  truck: 'M2 7h12v9H2zM14 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  x: 'M6 6l12 12M18 6L6 18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  swap: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  play: 'M7 5l12 7-12 7z',
};

export function Icon({ n, s = 20 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[n]} />
    </svg>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="langs" role="group" aria-label="Language">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
      <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिं</button>
    </div>
  );
}

export function Shell({ title, sub, back, right, active, nav = true, children }) {
  const { t, toast } = useApp();
  const router = useRouter();
  const stub = (name) => toast(t('{name} is part of the Razorpay app and is not in this prototype', { name: t(name) }));
  return (
    <div className="phone">
      <header className="top">
        {back && (
          <button className="iconbtn" aria-label="Back" onClick={() => (back === true ? router.back() : router.push(back))}>
            <Icon n="back" />
          </button>
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {sub && <div className="sub trunc">{sub}</div>}
        </div>
        {right}
      </header>
      <main className="main">{children}</main>
      {nav && (
        <nav className="nav" aria-label="Main">
          <Link href="/" className={active === 'home' ? 'on' : ''}><Icon n="home" />{t('Home')}</Link>
          <button onClick={() => stub('Payments')}><Icon n="swap" />{t('Payments')}</button>
          <Link href="/products" className={active === 'products' ? 'on' : ''}><Icon n="grid" />{t('Products')}<span className="new">NEW</span></Link>
          <button onClick={() => stub('Support')}><Icon n="help" />{t('Support')}</button>
          <Link href="/more" className={active === 'more' ? 'on' : ''}><Icon n="user" />{t('Account')}</Link>
        </nav>
      )}
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row between">
          <h2>{title}</h2>
          <button className="iconbtn" aria-label="Close" onClick={onClose} style={{ color: 'var(--muted)' }}><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pill({ tone = '', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Field({ label, ai, children }) {
  return (
    <div className="field">
      <label>{label}{ai && <span className="ai">AI</span>}</label>
      {children}
    </div>
  );
}

export function Spinner() {
  return <span className="spin" aria-label="Loading" />;
}
