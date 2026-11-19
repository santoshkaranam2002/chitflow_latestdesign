import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { MONTH_NAMES, outstandingOf, paidOf, round2 } from '../../core/ledger';
import { Session } from '../../core/session';
import { UserService } from '../../core/services/user.service';
import { greeting } from '../../core/utils/date.util';
import { injectNow, pad, splitDuration } from '../../core/utils/time.util';
import { auctionDate, groupTone } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { IconTile } from '../../shared/icon-tile/icon-tile';
import { Logo } from '../../shared/logo/logo';
import { PaymentItem } from '../../shared/payment-item/payment-item';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { Sparkline } from '../../shared/sparkline/sparkline';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, CountUp, EmptyState, Icon, IconTile, Logo, PaymentItem, InrPipe, Sparkline],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly store = inject(DataStore);
  private readonly now = injectNow(1000);
  protected readonly session = inject(Session);
  protected readonly ui = inject(UserService);

  protected readonly user = this.session.current;
  protected readonly unread = this.store.unreadCount;
  protected readonly hello = greeting();
  protected readonly firstName = computed(() => (this.user().name || '').split(' ')[0] || 'there');

  protected readonly collected = this.store.totalCollected;
  protected readonly groups = this.store.groups;
  protected readonly totalMembers = computed(() => this.store.members().length);
  protected readonly pendingCount = this.store.pendingCount;
  /** money still to be received on installments */
  protected readonly dues = computed(() =>
    round2(this.store.payments().filter((p) => p.type === 'Installment').reduce((s, p) => s + outstandingOf(p), 0)),
  );
  protected readonly activeGroups = this.store.activeGroupsCount;

  /** money received per month (last 8 months that have data) for the little trend line */
  protected readonly trend = computed(() => {
    const byMonth = new Map<string, number>();
    for (const p of this.store.payments()) {
      const d = p.paidDate || '';
      if (d.length >= 7 && paidOf(p) > 0 && p.type === 'Installment') byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + paidOf(p));
    }
    return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([, v]) => v);
  });
  protected readonly thisMonth = computed(() => {
    const key = new Date().toISOString().slice(0, 7);
    return this.store.payments().filter((p) => (p.paidDate || '').startsWith(key) && p.type === 'Installment').reduce((s, p) => s + paidOf(p), 0);
  });

  /** Recent money received */
  protected readonly payments = computed(() =>
    this.store.payments()
      .filter((p) => paidOf(p) > 0)
      .sort((a, b) => (b.paidDate || b.dueDate || '').localeCompare(a.paidDate || a.dueDate || '') || b.id - a.id)
      .slice(0, 4),
  );

  /** Live auction first, otherwise the soonest upcoming one */
  protected readonly nextAuction = computed(() => {
    const list = this.store.auctions();
    return (
      list.find((a) => a.status === 'Live') ??
      [...list].filter((a) => a.status === 'Upcoming').sort((a, b) => +auctionDate(a) - +auctionDate(b))[0]
    );
  });
  protected readonly nextGroup = computed(() => {
    const a = this.nextAuction();
    return a ? this.store.group(a.groupId) : undefined;
  });
  protected readonly waiting = computed(() => this.store.auctions().filter((a) => a.status === 'Pending Confirmation'));
  protected readonly countdown = computed(() => {
    const a = this.nextAuction();
    if (!a) return '';
    const d = splitDuration(+auctionDate(a) - this.now());
    return d.days > 0 ? `${d.days}d ${pad(d.hours)}h ${pad(d.minutes)}m` : `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
  });

  protected readonly actions = [
    { icon: 'card', label: 'Payments', path: '/payments' },
    { icon: 'gavel', label: 'Auctions', path: '/auctions' },
    { icon: 'user', label: 'Members', path: '/members' },
    { icon: 'alert', label: 'Defaulters', path: '/defaulters' },
  ];

  protected tone = groupTone;
  protected groupName(id: number): string { return this.store.group(id)?.name ?? ''; }
  protected paidShare(id: number): number {
    const g = this.store.group(id);
    const rows = this.store.groupPayments(id).filter((p) => p.type === 'Installment' && p.monthIndex === g?.currentMonth);
    return rows.length ? Math.round((rows.filter((p) => p.status === 'Paid').length / rows.length) * 100) : 0;
  }
  protected nextDate(id: number): Date | null {
    const a = this.store.groupAuctions(id).find((x) => x.status === 'Live' || x.status === 'Upcoming');
    return a ? auctionDate(a) : null;
  }
  protected readonly monthName = MONTH_NAMES[new Date().getMonth()];
}
