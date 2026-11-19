import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DataStore, MembershipStatus, Payment } from '../../core/data';
import {
  EffStatus, MemberGroupSummary, downloadCsv, durationLabel, effStatus, fmtDate, outstandingOf, paidOf, round2, summarize, todayISO,
} from '../../core/ledger';
import { ToastService } from '../../core/services/toast.service';
import { avatarColor, errMsg, groupTone, payPill } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Avatar } from '../../shared/avatar/avatar';
import { PhotoPicker } from '../../shared/photo-picker/photo-picker';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../shared/progress-ring/progress-ring';
import { RecordPayment } from '../../shared/record-payment/record-payment';
import { Tabs } from '../../shared/tabs/tabs';

/** Member profile + full payment ledger (group-wise), all from the backend. */
@Component({
  selector: 'app-member-details',
  imports: [NgClass, FormsModule, RouterLink, Avatar, PhotoPicker, CountUp, EmptyState, Icon, PageHeader, InrPipe, ProgressRing, RecordPayment, Tabs],
  templateUrl: './member-details.html',
  styleUrl: './member-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDetails {
  /** long lists show 30 rows at a time */
  protected readonly limit = signal(30);
  protected more(): void { this.limit.update((n) => n + 30); }
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(DataStore);
  private readonly today = todayISO();

  readonly id = input<string>();
  /** ?groupId= – open with this group selected */
  readonly groupId = input<string>();

  protected readonly member = computed(() => this.store.member(this.id() ?? 0));
  protected readonly view = signal('groups');
  protected readonly groupFilter = signal<'All' | number>('All');
  protected readonly statusFilter = signal<'All' | EffStatus>('All');
  protected readonly expanded = signal<string | null>(null);

  protected readonly statusOptions: ('All' | EffStatus)[] = ['All', 'Paid', 'Partial', 'Pending', 'Overdue'];

  constructor() {
    effect(() => {
      const g = Number(this.groupId() || 0);
      if (g) untracked(() => this.groupFilter.set(g));
    });
  }

  // ── per-group summaries (full history) ──
  protected readonly summaries = computed<MemberGroupSummary[]>(() => {
    const m = this.member();
    if (!m) return [];
    const rows: MemberGroupSummary[] = [];
    for (const ms of this.store.memberships()) {
      if (ms.memberId !== m.id) continue;
      const g = this.store.group(ms.groupId);
      if (g) rows.push(summarize(m, g, ms, this.store.payments(), this.today));
    }
    const order: Record<string, number> = { Active: 0, Completed: 1, Left: 2 };
    return rows.sort((a, b) => (order[a.state] - order[b.state]) || (b.joinedOn || '').localeCompare(a.joinedOn || ''));
  });
  protected readonly scoped = computed(() => {
    const id = this.groupFilter();
    return id === 'All' ? this.summaries() : this.summaries().filter((s) => s.group.id === id);
  });

  protected readonly totals = computed(() => {
    const s = this.scoped();
    const totalPaid = round2(s.reduce((a, x) => a + x.totalPaid, 0));
    const totalDue = round2(s.reduce((a, x) => a + x.totalDue, 0));
    const outstanding = round2(s.reduce((a, x) => a + x.outstanding, 0));
    const monthsPaid = s.reduce((a, x) => a + x.monthsPaid, 0);
    const monthsPending = s.reduce((a, x) => a + x.monthsPending, 0);
    const overdue = s.reduce((a, x) => a + x.monthsOverdue, 0);
    const remaining = s.reduce((a, x) => a + x.monthsRemaining, 0);
    const payouts = round2(s.reduce((a, x) => a + x.payoutReceived, 0));
    const status: string = overdue ? 'Overdue' : s.some((x) => x.status === 'Partial') ? 'Partial' : monthsPending ? 'Pending' : totalDue ? 'Paid' : 'No dues';
    return { totalPaid, totalDue, outstanding, monthsPaid, monthsPending, overdue, remaining, payouts, status, rate: totalDue ? Math.round((totalPaid / totalDue) * 100) : 0 };
  });

  protected readonly firstJoined = computed(() => this.summaries().map((s) => s.joinedOn).filter(Boolean).sort()[0] || '');

  // ── payment history (group + status filter) ──
  private readonly memberPayments = computed(() => {
    const m = this.member();
    const gf = this.groupFilter();
    return m ? this.store.payments().filter((p) => p.memberId === m.id && (gf === 'All' || p.groupId === gf)) : [];
  });
  protected readonly history = computed(() => {
    const sf = this.statusFilter();
    return this.memberPayments()
      .filter((p) => sf === 'All' || this.st(p) === sf)
      .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || b.monthIndex - a.monthIndex);
  });
  protected count(s: 'All' | EffStatus): number {
    const rows = this.memberPayments();
    return s === 'All' ? rows.length : rows.filter((p) => this.st(p) === s).length;
  }

  protected readonly tabs = computed(() => [
    { id: 'groups', label: 'Groups', count: this.scoped().length },
    { id: 'payments', label: 'Payment history', count: this.memberPayments().length },
  ]);

  protected monthCells(s: MemberGroupSummary) {
    const byMonth = new Map(s.installments.map((p) => [p.monthIndex, p]));
    const n = Math.max(s.group.durationMonths || 0, ...s.installments.map((p) => p.monthIndex));
    return Array.from({ length: n }, (_, i) => {
      const m = i + 1;
      const p = byMonth.get(m);
      return { m, p, status: p ? effStatus(p, this.today) : m > (s.group.currentMonth || 0) ? 'Upcoming' : 'No due' };
    });
  }
  protected cellTitle(c: { m: number; p?: Payment; status: string }): string {
    return c.p ? `Month ${c.m}: ${c.status} · ₹${paidOf(c.p).toLocaleString('en-IN')} of ₹${c.p.amount.toLocaleString('en-IN')}` : `Month ${c.m}: ${c.status === 'Upcoming' ? 'upcoming' : 'no due recorded'}`;
  }
  protected toggle(key: string): void { this.expanded.set(this.expanded() === key ? null : key); }
  protected showGroup(s: MemberGroupSummary): void {
    this.groupFilter.set(s.group.id);
    this.statusFilter.set('All');
    this.view.set('payments');
  }

  // ── record payment ──
  protected readonly recording = signal<Payment | null>(null);

  // ── edit member ──
  protected readonly editing = signal(false);
  protected readonly draft = signal({ name: '', phone: '', email: '', address: '', nominee: '', bankAccount: '', status: 'Active', photo: '' });
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly memberStatuses = ['Active', 'Inactive', 'Completed', 'Suspended'];

  protected startEdit(): void {
    const m = this.member();
    if (!m) return;
    this.draft.set({ name: m.name, phone: m.phone, email: m.email, address: m.address, nominee: m.nominee, bankAccount: m.bankAccount, status: m.status, photo: m.photo ?? '' });
    this.error.set('');
    this.editing.set(true);
  }
  protected setDraft(key: string, value: string): void { this.draft.update((d) => ({ ...d, [key]: value })); }
  protected saveEdit(): void {
    const m = this.member();
    if (!m) return;
    if (!this.draft().name.trim() || !this.draft().phone.trim()) { this.error.set('Name and phone are required.'); return; }
    this.saving.set(true);
    this.store.updateMember(m.id, this.draft()).subscribe({
      next: () => { this.saving.set(false); this.editing.set(false); this.toast.show('Member updated', 'success', 'check'); },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not save changes.')); },
    });
  }
  protected remove(): void {
    const m = this.member();
    if (!m) return;
    if (!confirm(`Remove ${m.name} from ChitFlow? This also removes them from every group they're in.`)) return;
    this.store.deleteMember(m.id).subscribe({
      next: () => { this.toast.show('Member removed', 'success', 'trash'); this.router.navigateByUrl('/members'); },
      error: (e) => this.toast.show(errMsg(e, 'Could not delete this member.'), 'info', 'alert'),
    });
  }

  // ── leave / complete / re-activate a membership ──
  protected readonly leaveFor = signal<MemberGroupSummary | null>(null);
  protected readonly leave = signal({ date: todayISO(), reason: '', status: 'Left' as MembershipStatus });
  protected openLeave(s: MemberGroupSummary, status: MembershipStatus): void {
    this.leave.set({ date: todayISO(), reason: '', status });
    this.error.set('');
    this.leaveFor.set(s);
  }
  protected setLeave(key: 'date' | 'reason', v: string): void { this.leave.update((l) => ({ ...l, [key]: v })); }
  protected saveLeave(): void {
    const s = this.leaveFor();
    const id = s?.membership?.id;
    if (!s || !id) { this.error.set('This membership cannot be updated (missing record id). Refresh and try again.'); return; }
    if (!this.leave().date) { this.error.set('Pick the date.'); return; }
    if (s.joinedOn && this.leave().date < s.joinedOn) { this.error.set('Date cannot be before the joining date.'); return; }
    this.saving.set(true);
    this.store.updateMembership(id, { status: this.leave().status, leftOn: this.leave().date, leaveReason: this.leave().reason }).subscribe({
      next: () => { this.saving.set(false); this.leaveFor.set(null); this.toast.show(this.leave().status === 'Left' ? 'Marked as left' : 'Marked as completed', 'success', 'check'); },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not update membership.')); },
    });
  }
  protected reactivate(s: MemberGroupSummary): void {
    const id = s.membership?.id;
    if (!id) return;
    if (!confirm(`Re-activate ${s.member.name} in ${s.group.name}? They will get dues again from the next auction.`)) return;
    this.store.updateMembership(id, { status: 'Active' }).subscribe({
      next: () => this.toast.show('Membership re-activated', 'success', 'check'),
      error: (e) => this.toast.show(errMsg(e, 'Could not re-activate'), 'info', 'alert'),
    });
  }

  // ── helpers ──
  protected st(p: Payment): EffStatus { return p.type === 'Installment' ? effStatus(p, this.today) : 'Paid'; }
  protected paid = paidOf;
  protected bal = outstandingOf;
  protected fmt = fmtDate;
  protected since(d?: string): string { return d ? durationLabel(d) : ''; }
  protected groupName(id: number): string { return this.store.group(id)?.name ?? `Group #${id}`; }
  protected pill = payPill;
  protected color = avatarColor;
  protected tone = groupTone;
  protected label(s: string): string { return s === 'Partial' ? 'Part paid' : s; }
  protected readonly Math = Math;

  /** Opens the browser's print dialog: choose "Save as PDF" for a statement. */
  protected print(): void { window.print(); }

  protected exportCsv(): void {
    const m = this.member();
    if (!m) return;
    downloadCsv(`${m.code || 'member'}-history-${this.today}.csv`, [
      ['Group', 'Chit No.', 'Membership', 'Joined', 'Left', 'Leave reason', 'Months paid', 'Months pending', 'Months remaining', 'Total paid', 'Outstanding', 'Status'],
      ...this.summaries().map((s) => [s.group.name, s.chitNumber ?? '', s.state, s.joinedOn || 'Unavailable', s.leftOn, s.leaveReason, s.monthsPaid, s.monthsPending, s.monthsRemaining, s.totalPaid, s.outstanding, s.status]),
      [],
      ['Group', 'Chit month', 'Type', 'Amount', 'Received', 'Balance', 'Due date', 'Paid date', 'Method', 'Transaction', 'Status'],
      ...this.store.payments().filter((p) => p.memberId === m.id).map((p) => [this.groupName(p.groupId), p.monthIndex, p.type, p.amount, paidOf(p), outstandingOf(p), p.dueDate, p.paidDate ?? '', p.method ?? '', p.transactionId ?? '', this.st(p)]),
    ]);
  }
}
