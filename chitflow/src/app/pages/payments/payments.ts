import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DataStore, Payment } from '../../core/data';
import {
  EffStatus, MONTH_NAMES, MemberGroupSummary, MonthRow, downloadCsv, effStatus, fmtDate, monthYear, monthlySummary,
  outstandingOf, paidOf, round2, summarize, todayISO,
} from '../../core/ledger';
import { TabOption } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { errMsg, payPill } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { RecordPayment } from '../../shared/record-payment/record-payment';
import { Tabs } from '../../shared/tabs/tabs';

type View = 'ledger' | 'monthly' | 'outstanding' | 'transactions';

@Component({
  selector: 'app-payments',
  imports: [NgClass, FormsModule, RouterLink, CountUp, EmptyState, Icon, PageHeader, InrPipe, RecordPayment, Tabs],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payments {
  /** long lists show 30 rows at a time */
  protected readonly limit = signal(30);
  protected more(): void { this.limit.update((n) => n + 30); }
  protected readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);
  private readonly today = todayISO();
  protected readonly months = MONTH_NAMES;

  protected readonly view = signal('ledger');
  protected readonly filtering = signal(false);
  protected readonly groupFilter = signal<'All' | number>('All');
  protected readonly memberFilter = signal<'All' | number>('All');
  protected readonly monthFilter = signal(0);
  protected readonly yearFilter = signal<'All' | number>('All');
  protected readonly statusFilter = signal<'All' | EffStatus>('All');
  protected readonly search = signal('');
  protected readonly statuses: ('All' | EffStatus)[] = ['All', 'Paid', 'Partial', 'Pending', 'Overdue'];

  protected readonly tabs: TabOption[] = [
    { id: 'ledger', label: 'Ledger' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'outstanding', label: 'Dues' },
    { id: 'transactions', label: 'All' },
  ];

  /** Members in the member dropdown (scoped to the chosen group). */
  protected readonly memberOptions = computed(() => {
    const gf = this.groupFilter();
    const list = gf === 'All' ? this.store.members() : this.store.groupMembers(gf);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  });
  protected readonly yearOptions = computed(() => {
    const ys = new Set<number>();
    for (const p of this.store.payments()) { const my = monthYear(p.dueDate); if (my) ys.add(my.year); }
    return Array.from(ys).sort((a, b) => b - a);
  });
  protected readonly hasFilters = computed(() =>
    this.groupFilter() !== 'All' || this.memberFilter() !== 'All' || this.monthFilter() !== 0 || this.yearFilter() !== 'All' || this.statusFilter() !== 'All' || !!this.search().trim());

  protected clearFilters(): void {
    this.groupFilter.set('All'); this.memberFilter.set('All'); this.monthFilter.set(0);
    this.yearFilter.set('All'); this.statusFilter.set('All'); this.search.set('');
  }
  protected onGroup(v: string): void {
    this.groupFilter.set(v === 'All' ? 'All' : +v);
    const mf = this.memberFilter();
    if (mf !== 'All' && !this.memberOptions().some((m) => m.id === mf)) this.memberFilter.set('All');
  }

  private inPeriod(p: Payment): boolean {
    const mf = this.monthFilter(), yf = this.yearFilter();
    if (!mf && yf === 'All') return true;
    const my = monthYear(p.dueDate);
    return !!my && (!mf || my.month === mf) && (yf === 'All' || my.year === yf);
  }
  private matchesSearch(memberId: number): boolean {
    const q = this.search().trim().toLowerCase();
    if (!q) return true;
    const m = this.store.member(memberId);
    return !!m && (m.name.toLowerCase().includes(q) || (m.phone || '').includes(q) || (m.code || '').toLowerCase().includes(q));
  }

  private readonly scopedPayments = computed(() => {
    const gf = this.groupFilter(), mf = this.memberFilter();
    return this.store.payments().filter((p) => (gf === 'All' || p.groupId === gf) && (mf === 'All' || p.memberId === mf) && this.inPeriod(p) && this.matchesSearch(p.memberId));
  });
  private readonly scopedInstallments = computed(() => this.scopedPayments().filter((p) => p.type === 'Installment'));

  protected readonly kpi = computed(() => {
    const inst = this.scopedInstallments();
    const billed = round2(inst.reduce((s, p) => s + (p.amount || 0), 0));
    const collected = round2(inst.reduce((s, p) => s + paidOf(p), 0));
    const overdue = inst.filter((p) => effStatus(p, this.today) === 'Overdue');
    return {
      billed, collected,
      outstanding: round2(Math.max(0, billed - collected)),
      payout: round2(this.scopedPayments().filter((p) => p.type === 'Winner Payout').reduce((s, p) => s + paidOf(p), 0)),
      overdueCount: overdue.length,
      overdueAmount: round2(overdue.reduce((s, p) => s + outstandingOf(p), 0)),
      rate: billed ? Math.round((collected / billed) * 100) : 0,
    };
  });

  /** received per month – last 6 months of activity, for the little bar chart */
  protected readonly bars = computed(() => {
    const byMonth = new Map<string, number>();
    for (const p of this.scopedInstallments()) {
      const d = p.paidDate || '';
      if (d.length >= 7 && paidOf(p) > 0) byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + paidOf(p));
    }
    const rows = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.map(([k, v]) => ({ label: MONTH_NAMES[+k.slice(5, 7) - 1], value: v, h: (v / max) * 56 }));
  });

  // ── LEDGER: one row per member per group ──
  protected readonly ledger = computed<MemberGroupSummary[]>(() => {
    const gf = this.groupFilter(), mf = this.memberFilter(), sf = this.statusFilter();
    const scoped = this.scopedPayments();
    const rows: MemberGroupSummary[] = [];
    for (const ms of this.store.memberships()) {
      if (gf !== 'All' && ms.groupId !== gf) continue;
      if (mf !== 'All' && ms.memberId !== mf) continue;
      if (!this.matchesSearch(ms.memberId)) continue;
      const member = this.store.member(ms.memberId);
      const group = this.store.group(ms.groupId);
      if (!member || !group) continue;
      const s = summarize(member, group, ms, scoped, this.today);
      if (sf !== 'All' && s.status !== sf) continue;
      rows.push(s);
    }
    const order: Record<string, number> = { Overdue: 0, Partial: 1, Pending: 2, Paid: 3, 'No dues': 4 };
    return rows.sort((a, b) => (order[a.status] - order[b.status]) || (b.outstanding - a.outstanding) || a.member.name.localeCompare(b.member.name));
  });

  // ── MONTHLY SUMMARY ──
  protected readonly monthly = computed<(MonthRow & { groupName: string })[]>(() => {
    const gf = this.groupFilter();
    const scoped = this.scopedPayments();
    const groups = gf === 'All' ? this.store.groups() : this.store.groups().filter((g) => g.id === gf);
    const out: (MonthRow & { groupName: string })[] = [];
    for (const g of groups) for (const r of monthlySummary(g.id, scoped, this.today)) out.push({ ...r, groupName: g.name });
    const sf = this.statusFilter();
    const rows = sf === 'All' ? out : out.filter((r) => (sf === 'Paid' ? r.outstanding === 0 : sf === 'Overdue' ? r.overdueCount > 0 : sf === 'Partial' ? r.partialCount > 0 : r.pendingCount > 0));
    return rows.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || a.groupName.localeCompare(b.groupName));
  });

  // ── OUTSTANDING ──
  protected readonly outstandingRows = computed(() => this.ledger().filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding));
  protected readonly groupBalances = computed(() => {
    const gf = this.groupFilter();
    const scoped = this.scopedInstallments();
    const groups = gf === 'All' ? this.store.groups() : this.store.groups().filter((g) => g.id === gf);
    return groups.map((g) => {
      const rows = scoped.filter((p) => p.groupId === g.id);
      const billed = round2(rows.reduce((s, p) => s + p.amount, 0));
      const collected = round2(rows.reduce((s, p) => s + paidOf(p), 0));
      return { group: g, billed, collected, outstanding: round2(Math.max(0, billed - collected)), rate: billed ? Math.round((collected / billed) * 100) : 0 };
    }).filter((r) => r.billed > 0).sort((a, b) => b.outstanding - a.outstanding);
  });

  // ── ALL TRANSACTIONS ──
  protected readonly transactions = computed(() => {
    const sf = this.statusFilter();
    return this.scopedPayments()
      .filter((p) => sf === 'All' || (p.type === 'Installment' && effStatus(p, this.today) === sf) || (p.type !== 'Installment' && sf === 'Paid'))
      .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || b.monthIndex - a.monthIndex);
  });

  // ── record / mark paid ──
  protected readonly recording = signal<Payment | null>(null);
  protected readonly marking = signal<number | null>(null);
  protected markPaid(p: Payment): void {
    this.marking.set(p.id);
    this.store.markPaymentPaid(p.id).subscribe({
      next: () => { this.marking.set(null); this.toast.show('Marked as paid', 'success', 'check'); },
      error: (e) => { this.marking.set(null); this.toast.show(errMsg(e, 'Could not update this payment'), 'info', 'alert'); },
    });
  }

  // ── helpers ──
  protected st(p: Payment): EffStatus | 'Paid' { return p.type === 'Installment' ? effStatus(p, this.today) : 'Paid'; }
  protected paid = paidOf;
  protected bal = outstandingOf;
  protected fmt = fmtDate;
  protected pill = payPill;
  protected label(s: string): string { return s === 'Partial' ? 'Part paid' : s; }
  protected memberName(id: number): string { return this.store.member(id)?.name ?? `Member #${id}`; }
  protected groupName(id: number): string { return this.store.group(id)?.name ?? `Group #${id}`; }

  protected exportCsv(): void {
    const v = this.view(), stamp = this.today;
    if (v === 'ledger') {
      downloadCsv(`member-ledger-${stamp}.csv`, [
        ['Member', 'Code', 'Group', 'Chit No.', 'Membership', 'Months billed', 'Months paid', 'Months pending', 'Months remaining', 'Total due', 'Total paid', 'Outstanding', 'Status'],
        ...this.ledger().map((r) => [r.member.name, r.member.code, r.group.name, r.chitNumber ?? '', r.state, r.monthsBilled, r.monthsPaid, r.monthsPending, r.monthsRemaining, r.totalDue, r.totalPaid, r.outstanding, r.status]),
      ]);
    } else if (v === 'monthly') {
      downloadCsv(`monthly-summary-${stamp}.csv`, [
        ['Group', 'Chit month', 'Due date', 'Members', 'Paid', 'Partial', 'Pending', 'Overdue', 'Billed', 'Collected', 'Outstanding', 'Collection %'],
        ...this.monthly().map((r) => [r.groupName, r.monthIndex, r.dueDate, r.members, r.paidCount, r.partialCount, r.pendingCount, r.overdueCount, r.billed, r.collected, r.outstanding, r.ratePct]),
      ]);
    } else if (v === 'outstanding') {
      downloadCsv(`outstanding-${stamp}.csv`, [
        ['Member', 'Code', 'Phone', 'Group', 'Months pending', 'Overdue months', 'Outstanding'],
        ...this.outstandingRows().map((r) => [r.member.name, r.member.code, r.member.phone, r.group.name, r.monthsPending, r.monthsOverdue, r.outstanding]),
      ]);
    } else {
      downloadCsv(`payments-${stamp}.csv`, [
        ['Member', 'Group', 'Chit month', 'Type', 'Amount', 'Received', 'Balance', 'Due date', 'Paid date', 'Method', 'Transaction', 'Status'],
        ...this.transactions().map((p) => [this.memberName(p.memberId), this.groupName(p.groupId), p.monthIndex, p.type, p.amount, paidOf(p), outstandingOf(p), p.dueDate, p.paidDate ?? '', p.method ?? '', p.transactionId ?? '', this.st(p)]),
      ]);
    }
  }
}
