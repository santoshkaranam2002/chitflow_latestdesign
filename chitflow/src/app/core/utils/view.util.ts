import { Auction } from '../data';

/** Look-and-feel helpers (colours / pill classes). No business data in here. */

const TONES = [
  { icon: 'users', bg: '#ffe6d8', color: '#f26a1b' },
  { icon: 'wallet', bg: '#ece8fd', color: '#6c55d9' },
  { icon: 'coin', bg: '#dcf5e6', color: '#1b8a4b' },
  { icon: 'gavel', bg: '#fff0c9', color: '#d99a06' },
  { icon: 'grid', bg: '#fde2e2', color: '#e5432d' },
];
export const groupTone = (id: number) => TONES[Math.abs(id) % TONES.length];

const AVATARS = ['#f26a1b', '#6c55d9', '#1b8a4b', '#d99a06', '#e5432d', '#2f80ed'];
export const avatarColor = (id: number) => AVATARS[Math.abs(id) % AVATARS.length];

/** payment status -> pill class */
export function payPill(status: string): string {
  return status === 'Paid' || status === 'No dues' ? 'pill--ok' : status === 'Overdue' ? 'pill--bad' : 'pill--pd';
}

/** auction status -> pill class */
export function auctionPill(status: string): string {
  return status === 'Live' ? 'pill--live' : status === 'Completed' ? 'pill--dn' : status === 'Pending Confirmation' ? 'pill--pd' : 'pill--up';
}

/** '10:00 AM' / '14:30' -> 'HH:mm' (empty if unknown) */
export function to24(t?: string | null): string {
  const m = (t ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return '';
  let h = +m[1];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** 'HH:mm' -> '02:30 PM' (format the backend stores) */
export function to12(t?: string | null): string {
  if (!t) return '';
  const [hs, min] = t.split(':');
  let h = +hs;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${min} ${ap}`;
}

/** Real date-time of an auction (scheduled date + start time). */
export function auctionDate(a: Pick<Auction, 'scheduledDate' | 'startTime'>): Date {
  const [y, m, d] = (a.scheduledDate || '').split('-').map(Number);
  const [hh, mm] = (to24(a.startTime) || '00:00').split(':').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

/** 'Today' / 'Tomorrow' / 'In 5 days' */
export function whenLabel(d: Date): string {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return diff > 1 ? `In ${diff} days` : `${-diff} day${diff === -1 ? '' : 's'} ago`;
}

/** Message from an unknown thrown value */
export function errMsg(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return (e as { message?: string })?.message || fallback;
}

/** '2026-11-19 10:41:07' -> '19 Nov, 10:41' (falls back to the original text) */
export function fmtStamp(s?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s ?? '');
  if (!m) return s ?? '';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1];
  return `${+m[3]} ${mon}, ${m[4]}:${m[5]}`;
}
