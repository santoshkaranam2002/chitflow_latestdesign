import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { effStatus, fmtDate, maturityDate, membershipState, paidOf } from '../../core/ledger';
import { IconLabel } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { auctionPill, avatarColor, errMsg, groupTone } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Avatar } from '../../shared/avatar/avatar';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { PaymentItem } from '../../shared/payment-item/payment-item';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../shared/progress-ring/progress-ring';
import { Tabs } from '../../shared/tabs/tabs';

@Component({
  selector: 'app-group-details',
  imports: [DatePipe, NgClass, RouterLink, Avatar, CountUp, EmptyState, Icon, PageHeader, PaymentItem, InrPipe, ProgressRing, Tabs],
  templateUrl: './group-details.html',
  styleUrl: './group-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetails {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from the ?id= query param */
  readonly id = input<string>();
  protected readonly group = computed(() => this.store.group(this.id() ?? 0));
  protected readonly tone = computed(() => groupTone(this.group()?.id ?? 0));

  protected readonly tab = signal('members');
  protected readonly deleting = signal(false);

  protected readonly members = computed(() => {
    const g = this.group();
    if (!g) return [];
    return this.store.memberships()
      .filter((ms) => ms.groupId === g.id)
      .map((ms) => ({ ms, member: this.store.member(ms.memberId), state: membershipState(ms, g) }))
      .filter((r) => !!r.member)
      .sort((a, b) => (a.ms.chitNumber ?? 999) - (b.ms.chitNumber ?? 999));
  });
  protected readonly auctions = computed(() => (this.group() ? this.store.groupAuctions(this.group()!.id) : []));
  protected readonly payments = computed(() => (this.group() ? this.store.groupPayments(this.group()!.id) : []));
  protected readonly recent = computed(() =>
    [...this.payments()].sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || b.id - a.id).slice(0, 6),
  );

  protected readonly tabs = computed(() => [
    { id: 'members', label: 'Members', count: this.members().length },
    { id: 'auctions', label: 'Auctions', count: this.auctions().length },
    { id: 'payments', label: 'Payments' },
  ]);

  /** this chit month: paid members / billed members */
  protected readonly paid = computed(() => {
    const g = this.group();
    const rows = this.payments().filter((p) => p.type === 'Installment' && p.monthIndex === g?.currentMonth);
    return { done: rows.filter((p) => effStatus(p) === 'Paid').length, of: rows.length };
  });
  protected readonly percent = computed(() => {
    const g = this.group();
    return g?.durationMonths ? Math.min(100, Math.round((g.currentMonth / g.durationMonths) * 100)) : 0;
  });
  protected readonly months = computed(() => Array.from({ length: this.group()?.durationMonths ?? 0 }, (_, i) => i + 1));
  protected readonly nextAuction = computed(() => this.auctions().find((a) => a.status === 'Live' || a.status === 'Upcoming'));

  protected readonly totalCollected = computed(() => this.payments().filter((p) => p.type === 'Installment').reduce((s, p) => s + paidOf(p), 0));
  protected readonly totalPayout = computed(() => this.payments().filter((p) => p.type === 'Winner Payout').reduce((s, p) => s + p.amount, 0));
  protected readonly pending = computed(() => this.payments().filter((p) => p.type === 'Installment' && effStatus(p) !== 'Paid').length);

  protected readonly overview = computed<IconLabel[]>(() => {
    const g = this.group();
    if (!g) return [];
    const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
    return [
      { icon: 'users', label: 'Members', value: `${this.members().length} joined of ${g.totalMembers}` },
      { icon: 'card', label: 'Monthly Contribution', value: inr(g.monthlyInstallment) },
      { icon: 'wallet', label: 'Total Amount', value: inr(g.chitValue) },
      { icon: 'clock', label: 'Duration', value: `${g.durationMonths} Months` },
      { icon: 'cal', label: 'Started on', value: fmtDate(g.startDate) || '—' },
      { icon: 'trophy', label: 'Matures on', value: fmtDate(maturityDate(g.startDate, g.durationMonths)) || '—' },
      { icon: 'gavel', label: 'Auction day', value: `Day ${g.auctionDay} of the month` },
      { icon: 'coin', label: 'Bid range', value: `${inr(g.minBid)} – ${inr(g.maxBid)}` },
      { icon: 'trend', label: 'Starting bid / step', value: `${inr(g.startingBid)} / ${inr(g.bidIncrement)}` },
      { icon: 'percent', label: 'Foreman Commission', value: g.commissionType === 'Percent' ? `${g.commissionValue}%` : inr(g.commissionValue) },
      { icon: 'user', label: 'Foreman', value: g.foreman || '—' },
    ];
  });

  protected pill = auctionPill;
  protected color = avatarColor;
  protected pillFor(status: string): string {
    return status === 'Left' ? 'pill--bad' : status === 'Completed' ? 'pill--dn' : 'pill--ok';
  }

  protected remove(): void {
    const g = this.group();
    if (!g) return;
    if (!confirm(`Delete ${g.name}? This removes the group and every member's link to it.`)) return;
    this.deleting.set(true);
    this.store.deleteGroup(g.id).subscribe({
      next: () => {
        this.toast.show('Group deleted', 'success', 'trash');
        this.router.navigateByUrl('/groups');
      },
      error: (e) => { this.deleting.set(false); this.toast.show(errMsg(e, 'Could not delete this group.'), 'info', 'alert'); },
    });
  }
}
