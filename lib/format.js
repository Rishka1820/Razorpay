// Shared by server and client. Dates are handled as Asia/Kolkata calendar days.
export const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

export function todayIST() {
  return ymdFmt.format(new Date());
}

export function dayOf(iso) {
  return ymdFmt.format(new Date(iso));
}

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00+05:30');
  d.setDate(d.getDate() + n);
  return ymdFmt.format(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function fmtTime(iso) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
    .toLowerCase();
}

export function fmtDateTime(iso) {
  return `${fmtDate(dayOf(iso))}, ${fmtTime(iso)}`;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}

export function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d;
}

export function prettyPhone(p) {
  const d = normPhone(p);
  if (d.length === 12) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return p || '';
}
