import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DataStore, Payment } from '../../core/data';
import {
  EffStatus, MemberGroupSummary, downloadCsv, effStatus, fmtDate, monthlySummary, paidOf, round2, summarize, todayISO,
} from '../../core/ledger';
import { avatarColor, payPill } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

interface Cell { m: number; status: EffStatus | 'Upcoming' | 'No due'; p?: Payment; }

@Component({
  selector: 'app-report-detail',
  imports: [NgClass, FormsModule, CountUp, EmptyState, Icon, PageHeader, InrPipe],
  templateUrl: './report-detail.html',
  styleUrl: './report-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDetail {
  protected readonly store = inject(DataStore);
  private readonly today = todayISO();

  /** ?type= one of insights | group | member | auction */
  readonly type = input<string>('group');
  /** ?groupId= for the group insights report */
  readonly groupId = input<string>();
  private readonly picked = signal<number | null>(null);

  protected readonly title = computed(() => ({ insights: 'Group Insights', group: 'Group Wise Summary', member: 'Member Wise Summary', auction: 'Auction Report' } as Record<string, string>)[this.type()] ?? 'Group Wise Summary');

  // ── selected group (insights) ──
  protected readonly selectedGroupId = computed(() => {
    const p = this.picked() ?? Number(this.groupId() || 0);
    const gs = this.store.groups();
    return p && gs.some((g) => g.id === p) ? p : gs[0]?.id ?? null;
  });
  protected readonly group = computed(() => (this.selectedGroupId() ? this.store.group(this.selectedGroupId()!) : undefined));
  protected pickGroup(v: string): void { this.picked.set(+v); }

  protected readonly memberRows = computed<MemberGroupSummary[]>(() => {
    const g = this.group();
    if (!g) return [];
    const rows: MemberGroupSummary[] = [];
    for (const ms of this.store.memberships()) {
      if (ms.groupId !== g.id) continue;
      const m = this.store.member(ms.memberId);
      if (m) rows.push(summarize(m, g, ms, this.store.payments(), this.today));
    }
    return rows.sort((a, b) => (a.chitNumber ?? 999) - (b.chitNumber ?? 999));
  });
  protected readonly months = computed(() => (this.group() ? monthlySummary(this.group()!.id, this.store.payments(), this.today) : []));
  protected readonly insight = computed(() => {
    const g = this.group();
    const ms = this.months();
    const billed = round2(ms.reduce((s, r) => s + r.billed, 0));
    const collected = round2(ms.reduce((s, r) => s + r.collected, 0));
    return {
      members: this.memberRows().length, billed, collected,
      outstanding: round2(Math.max(0, billed - collected)),
      rate: billed ? Math.round((collected / billed) * 100) : 0,
      payouts: g ? round2(this.store.groupPayments(g.id).filter((p) => p.type === 'Winner Payout').reduce((s, p) => s + paidOf(p), 0)) : 0,
    };
  });
  protected readonly matrixMonths = computed(() => {
    const g = this.group();
    if (!g) return [] as number[];
    const n = Math.max(g.durationMonths || 0, ...this.months().map((r) => r.monthIndex));
    return Array.from({ length: n }, (_, i) => i + 1);
  });
  protected readonly matrix = computed(() => {
    const g = this.group();
    if (!g) return [];
    return this.memberRows().map((r) => {
      const byMonth = new Map(r.installments.map((p) => [p.monthIndex, p]));
      const cells: Cell[] = this.matrixMonths().map((m) => {
        const p = byMonth.get(m);
        return { m, p, status: p ? effStatus(p, this.today) : m > (g.currentMonth || 0) ? 'Upcoming' : 'No due' };
      });
      return { row: r, cells };
    });
  });

  // ── all groups ──
  protected readonly groupReport = computed(() => this.store.groups().map((g) => {
    const ms = monthlySummary(g.id, this.store.payments(), this.today);
    const billed = round2(ms.reduce((s, r) => s + r.billed, 0));
    const collected = round2(ms.reduce((s, r) => s + r.collected, 0));
    const memberships = this.store.memberships().filter((x) => x.groupId === g.id);
    return {
      group: g, members: memberships.length, left: memberships.filter((x) => x.status === 'Left').length, billed, collected,
      outstanding: round2(Math.max(0, billed - collected)), rate: billed ? Math.round((collected / billed) * 100) : 0,
      payout: round2(this.store.groupPayments(g.id).filter((p) => p.type === 'Winner Payout').reduce((s, p) => s + paidOf(p), 0)),
      auctions: this.store.groupAuctions(g.id).length,
    };
  }));

  // ── all members ──
  protected readonly memberReport = computed(() => this.store.members().map((m) => {
    const rows: MemberGroupSummary[] = [];
    for (const ms of this.store.memberships()) {
      if (ms.memberId !== m.id) continue;
      const g = this.store.group(ms.groupId);
      if (g) rows.push(summarize(m, g, ms, this.store.payments(), this.today));
    }
    const auctions = this.store.memberAuctionRows(m.id);
    return {
      member: m, groups: rows.length,
      paid: round2(rows.reduce((s, r) => s + r.totalPaid, 0)), outstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
      pendingMonths: rows.reduce((s, r) => s + r.monthsPending, 0),
      participated: auctions.length, won: auctions.filter((a) => a.winnerMemberId === m.id).length,
    };
  }).sort((a, b) => b.outstanding - a.outstanding || a.member.name.localeCompare(b.member.name)));

  // ── auctions ──
  protected readonly auctionReport = computed(() => this.store.auctions().filter((a) => a.status === 'Completed').sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)));

  protected readonly totals = computed(() => {
    const g = this.groupReport();
    return {
      groups: g.length, members: this.store.members().length,
      collected: g.reduce((s, r) => s + r.collected, 0), outstanding: g.reduce((s, r) => s + r.outstanding, 0),
    };
  });

  protected pill = payPill;
  protected color = avatarColor;
  protected fmt = fmtDate;
  protected label(s: string): string { return s === 'Partial' ? 'Part paid' : s; }
  protected sym(s: string): string { return s === 'Paid' ? '✓' : s === 'Partial' ? '½' : s === 'Overdue' ? '!' : s === 'Pending' ? '•' : ''; }
  protected groupName(id: number): string { return this.store.group(id)?.name ?? String(id); }
  protected winnerName(id?: number): string { return id ? (this.store.member(id)?.name ?? String(id)) : '—'; }
  protected cellTitle(name: string, c: Cell): string {
    return c.p ? `${name} · Month ${c.m}: ${this.label(c.status)} · ₹${paidOf(c.p).toLocaleString('en-IN')} of ₹${c.p.amount.toLocaleString('en-IN')}` : `${name} · Month ${c.m}: ${c.status === 'Upcoming' ? 'upcoming' : 'no due recorded'}`;
  }

  protected download(): void {
    const t = this.type(), stamp = this.today;
    if (t === 'insights') {
      const g = this.group();
      if (!g) return;
      downloadCsv(`${g.name.replace(/\s+/g, '-')}-report-${stamp}.csv`, [
        ['Group', g.name, 'Chit value', g.chitValue, 'Duration', g.durationMonths, 'Current month', g.currentMonth],
        [],
        ['Chit month', 'Due date', 'Members', 'Paid', 'Partial', 'Pending', 'Overdue', 'Billed', 'Collected', 'Outstanding', 'Collection %'],
        ...this.months().map((r) => [r.monthIndex, r.dueDate, r.members, r.paidCount, r.partialCount, r.pendingCount, r.overdueCount, r.billed, r.collected, r.outstanding, r.ratePct]),
        [],
        ['Chit No.', 'Member', 'Code', 'Membership', 'Joined', 'Months paid', 'Months pending', 'Total paid', 'Outstanding', 'Status'],
        ...this.memberRows().map((r) => [r.chitNumber ?? '', r.member.name, r.member.code, r.state, r.joinedOn || 'Unavailable', r.monthsPaid, r.monthsPending, r.totalPaid, r.outstanding, r.status]),
      ]);
    } else if (t === 'group') {
      downloadCsv(`all-groups-${stamp}.csv`, [
        ['Group', 'Status', 'Members', 'Left', 'Month', 'Billed', 'Collected', 'Outstanding', 'Collection %', 'Payouts', 'Auctions'],
        ...this.groupReport().map((r) => [r.group.name, r.group.status, r.members, r.left, `${r.group.currentMonth}/${r.group.durationMonths}`, r.billed, r.collected, r.outstanding, r.rate, r.payout, r.auctions]),
      ]);
    } else if (t === 'auction') {
      downloadCsv(`auctions-${stamp}.csv`, [
        ['Group', 'Auction', 'Winner', 'Winning bid', 'Prize', 'Dividend / member', 'Commission', 'Date'],
        ...this.auctionReport().map((a) => [this.groupName(a.groupId), a.label, this.winnerName(a.winnerMemberId), a.winningBid ?? '', a.prizeAmount ?? '', a.dividendPerMember ?? '', a.commission ?? '', a.scheduledDate]),
      ]);
    } else {
      downloadCsv(`members-${stamp}.csv`, [
        ['Member', 'Code', 'Groups', 'Total paid', 'Outstanding', 'Pending months', 'Auctions', 'Won'],
        ...this.memberReport().map((r) => [r.member.name, r.member.code, r.groups, r.paid, r.outstanding, r.pendingMonths, r.participated, r.won]),
      ]);
    }
  }
}
