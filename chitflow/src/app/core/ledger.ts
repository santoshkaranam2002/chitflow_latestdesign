import { ChitGroup, GroupMembership, Member, Payment } from './data';

// ============================================================
// LEDGER — pure calculation helpers shared by Payments, Member
// Profile and Reports. Everything is computed from the records the
// API actually returned; when a value can't be known (e.g. an old
// membership with no join date) the helpers return null / '' so the
// UI can show "Unavailable" instead of a guess.
// ============================================================

export type EffStatus = 'Paid' | 'Partial' | 'Pending' | 'Overdue';
export type OverallStatus = EffStatus | 'No dues';
export type MembershipState = 'Active' | 'Left' | 'Completed';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today as YYYY-MM-DD in the user's local time zone (IST in India). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '2026-10-12' -> '12 Oct 2026'. Returns '' for empty / invalid input. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mi = +m[2] - 1;
  if (mi < 0 || mi > 11) return '';
  return `${+m[3]} ${MONTH_NAMES[mi]} ${m[1]}`;
}

/** Calendar month (1-12) and year of a YYYY-MM-DD date, or null. */
export function monthYear(iso?: string | null): { month: number; year: number } | null {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/);
  return m ? { year: +m[1], month: +m[2] } : null;
}

/** Amount actually received for a payment row. */
export function paidOf(p: Payment): number {
  if (p.paidAmount !== undefined && p.paidAmount !== null) return Number(p.paidAmount) || 0;
  return p.status === 'Paid' ? p.amount : 0;
}

/** Amount still owed on a payment row (never negative). */
export function outstandingOf(p: Payment): number {
  return Math.max(0, round2((p.amount || 0) - paidOf(p)));
}

/**
 * Real status of a payment, derived from the stored record:
 *  - fully received            -> Paid
 *  - due date passed, unpaid   -> Overdue   (even if partly paid)
 *  - partly received           -> Partial
 *  - otherwise                 -> Pending
 */
export function effStatus(p: Payment, today = todayISO()): EffStatus {
  const paid = paidOf(p);
  if (p.status === 'Paid' || paid >= (p.amount || 0) - 0.009) return 'Paid';
  if (p.dueDate && p.dueDate < today) return 'Overdue';
  if (paid > 0 || p.status === 'Partial') return 'Partial';
  return 'Pending';
}

export function round2(n: number) { return Math.round(n * 100) / 100; }

/** State of a member inside one group. */
export function membershipState(ms: GroupMembership | undefined, group: ChitGroup | undefined): MembershipState {
  if (ms?.status === 'Left') return 'Left';
  if (ms?.status === 'Completed' || group?.status === 'Completed') return 'Completed';
  return 'Active';
}

/** Whole years / months / days between two YYYY-MM-DD dates. */
export function diffYMD(fromIso: string, toIso: string): { years: number; months: number; days: number; totalDays: number } | null {
  const a = String(fromIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const b = String(toIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !b) return null;
  const from = new Date(+a[1], +a[2] - 1, +a[3]);
  const to = new Date(+b[1], +b[2] - 1, +b[3]);
  if (to < from) return null;
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86400000);
  return { years, months, days, totalDays };
}

/** '1 yr 3 mo', '5 mo', '12 days' — or '' when dates are unknown. */
export function durationLabel(fromIso?: string | null, toIso?: string | null): string {
  if (!fromIso) return '';
  const d = diffYMD(fromIso, toIso || todayISO());
  if (!d) return '';
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years} yr${d.years > 1 ? 's' : ''}`);
  if (d.months) parts.push(`${d.months} mo`);
  if (!parts.length) return d.totalDays <= 0 ? 'Joined today' : `${d.totalDays} day${d.totalDays > 1 ? 's' : ''}`;
  return parts.join(' ');
}

/** Overall status of a set of installments (worst one wins). */
export function overallStatus(installments: Payment[], today = todayISO()): OverallStatus {
  if (!installments.length) return 'No dues';
  const st = installments.map(p => effStatus(p, today));
  if (st.includes('Overdue')) return 'Overdue';
  if (st.includes('Partial')) return 'Partial';
  if (st.includes('Pending')) return 'Pending';
  return 'Paid';
}

// ────────────────────────────────────────────────────────────
// Member x Group summary
// ────────────────────────────────────────────────────────────

export interface MemberGroupSummary {
  key: string;                       // `${memberId}-${groupId}`
  member: Member;
  group: ChitGroup;
  membership?: GroupMembership;
  chitNumber?: number;
  state: MembershipState;

  installments: Payment[];           // oldest month first
  payouts: Payment[];

  monthsBilled: number;              // months that have a due record
  monthsPaid: number;
  monthsPartial: number;
  monthsPending: number;             // billed but not fully paid (incl. partial / overdue)
  monthsOverdue: number;
  monthsRemaining: number;           // chit months still to come (0 if left)

  totalDue: number;
  totalPaid: number;
  outstanding: number;
  payoutReceived: number;
  wonMonth?: number;

  status: OverallStatus;
  paidPct: number;                   // paid months / chit duration (0-100)

  joinedOn: string;                  // '' = unavailable
  leftOn: string;
  leaveReason: string;
  duration: string;                  // '' = unavailable
  estimatedFuture: number;           // remaining months x monthly installment (before dividends)
}

export function summarize(
  member: Member,
  group: ChitGroup,
  membership: GroupMembership | undefined,
  payments: Payment[],
  today = todayISO()
): MemberGroupSummary {
  const mine = payments.filter(p => p.memberId === member.id && p.groupId === group.id);
  const installments = mine.filter(p => p.type === 'Installment').sort((a, b) => a.monthIndex - b.monthIndex);
  const payouts = mine.filter(p => p.type === 'Winner Payout');
  const st = installments.map(p => effStatus(p, today));
  const state = membershipState(membership, group);

  const monthsPaid = st.filter(s => s === 'Paid').length;
  const totalDue = round2(installments.reduce((s, p) => s + (p.amount || 0), 0));
  const totalPaid = round2(installments.reduce((s, p) => s + paidOf(p), 0));
  const monthsRemaining = state === 'Active' ? Math.max(0, (group.durationMonths || 0) - (group.currentMonth || 0)) : 0;
  const joinedOn = membership?.joinedOn || '';
  const leftOn = membership?.leftOn || '';
  const endForDuration = state === 'Active' ? today : (leftOn || '');

  return {
    key: `${member.id}-${group.id}`,
    member, group, membership,
    chitNumber: membership?.chitNumber,
    state,
    installments, payouts,
    monthsBilled: installments.length,
    monthsPaid,
    monthsPartial: st.filter(s => s === 'Partial').length,
    monthsPending: installments.length - monthsPaid,
    monthsOverdue: st.filter(s => s === 'Overdue').length,
    monthsRemaining,
    totalDue,
    totalPaid,
    outstanding: round2(Math.max(0, totalDue - totalPaid)),
    payoutReceived: round2(payouts.reduce((s, p) => s + paidOf(p), 0)),
    wonMonth: payouts[0]?.monthIndex,
    status: overallStatus(installments, today),
    paidPct: group.durationMonths ? Math.min(100, Math.round((monthsPaid / group.durationMonths) * 100)) : 0,
    joinedOn,
    leftOn,
    leaveReason: membership?.leaveReason || '',
    duration: joinedOn && endForDuration ? durationLabel(joinedOn, endForDuration) : '',
    estimatedFuture: round2(monthsRemaining * (group.monthlyInstallment || 0)),
  };
}

// ────────────────────────────────────────────────────────────
// Group month-by-month summary
// ────────────────────────────────────────────────────────────

export interface MonthRow {
  groupId: number;
  monthIndex: number;
  dueDate: string;
  members: number;        // installment rows that month
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  pendingCount: number;
  billed: number;
  collected: number;
  outstanding: number;
  ratePct: number;
}

export function monthlySummary(groupId: number, payments: Payment[], today = todayISO()): MonthRow[] {
  const rows = new Map<number, MonthRow>();
  for (const p of payments) {
    if (p.groupId !== groupId || p.type !== 'Installment') continue;
    let r = rows.get(p.monthIndex);
    if (!r) {
      r = { groupId, monthIndex: p.monthIndex, dueDate: p.dueDate, members: 0, paidCount: 0, partialCount: 0,
            overdueCount: 0, pendingCount: 0, billed: 0, collected: 0, outstanding: 0, ratePct: 0 };
      rows.set(p.monthIndex, r);
    }
    const s = effStatus(p, today);
    r.members++;
    if (s === 'Paid') r.paidCount++;
    else if (s === 'Partial') r.partialCount++;
    else if (s === 'Overdue') r.overdueCount++;
    else r.pendingCount++;
    r.billed += p.amount || 0;
    r.collected += paidOf(p);
    if (!r.dueDate && p.dueDate) r.dueDate = p.dueDate;
  }
  return Array.from(rows.values())
    .map(r => ({
      ...r,
      billed: round2(r.billed),
      collected: round2(r.collected),
      outstanding: round2(Math.max(0, r.billed - r.collected)),
      ratePct: r.billed ? Math.round((r.collected / r.billed) * 100) : 0,
    }))
    .sort((a, b) => a.monthIndex - b.monthIndex);
}

// ────────────────────────────────────────────────────────────
// CSV export
// ────────────────────────────────────────────────────────────

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ₹ compact: 1,25,000 -> '₹1.25L', 9,500 -> '₹9,500' */
export function inrShort(n: number): string {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

/** Date the chit finishes: start date + duration (months). '' when there is no start date. */
export function maturityDate(startISO?: string | null, months = 0): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startISO ?? '');
  if (!m || !months) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1 + months, +m[3]));
  return d.toISOString().slice(0, 10);
}
