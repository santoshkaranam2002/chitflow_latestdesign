import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../../core/data';
import { effStatus, membershipState, outstandingOf, paidOf, round2 } from '../../../core/ledger';
import { Session } from '../../../core/session';
import { greeting } from '../../../core/utils/date.util';
import { auctionDate, whenLabel } from '../../../core/utils/view.util';
import { CountUp } from '../../../shared/count-up/count-up';
import { Icon } from '../../../shared/icon/icon';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { Logo } from '../../../shared/logo/logo';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-member-dashboard',
  imports: [DatePipe, RouterLink, CountUp, Icon, IconTile, InrPipe, Logo],
  templateUrl: './member-dashboard.html',
  styleUrl: './member-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDashboard {
  protected readonly store = inject(DataStore);
  private readonly session = inject(Session);

  protected readonly user = this.session.current;
  protected readonly memberId = computed(() => this.user().memberId ?? 0);
  protected readonly hello = greeting();
  protected readonly firstName = computed(() => (this.user().name || '').split(' ')[0] || 'there');
  protected readonly unread = this.store.unreadCount;

  private readonly mine = computed(() => this.store.memberPayments(this.memberId()));
  private readonly installments = computed(() => this.mine().filter((p) => p.type === 'Installment'));

  protected readonly stats = computed(() => {
    const groups = this.store.memberGroups(this.memberId());
    const state = (gid: number) => membershipState(this.store.memberships().find((m) => m.groupId === gid && m.memberId === this.memberId()), this.store.group(gid));
    return {
      totalPaid: round2(this.installments().reduce((s, p) => s + paidOf(p), 0)),
      pending: round2(this.installments().reduce((s, p) => s + outstandingOf(p), 0)),
      joined: groups.length,
      active: groups.filter((g) => state(g.id) === 'Active').length,
      completed: groups.filter((g) => state(g.id) === 'Completed').length,
    };
  });

  /** dividends credited to me, and prize money received when I won */
  protected readonly gains = computed(() => {
    const ids = new Set(this.store.memberGroups(this.memberId()).map((g) => g.id));
    const dividends = round2(this.store.dividends().filter((d) => ids.has(d.groupId)).reduce((s, d) => s + d.perMember, 0));
    const prize = round2(this.mine().filter((p) => p.type === 'Winner Payout').reduce((s, p) => s + paidOf(p), 0));
    return { dividends, prize };
  });

  /** live auction first, otherwise the soonest upcoming one in my groups */
  protected readonly nextAuction = computed(() => {
    const list = this.store.memberAuctionRows(this.memberId());
    return list.find((a) => a.status === 'Live') ?? [...list].filter((a) => a.status === 'Upcoming').sort((a, b) => +auctionDate(a) - +auctionDate(b))[0];
  });
  protected readonly nextGroup = computed(() => {
    const a = this.nextAuction();
    return a ? this.store.group(a.groupId) : undefined;
  });

  protected readonly upcomingPayments = computed(() =>
    this.installments().filter((p) => outstandingOf(p) > 0).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 4),
  );
  protected readonly latestPayments = computed(() =>
    this.mine().filter((p) => paidOf(p) > 0).sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || '') || b.id - a.id).slice(0, 4),
  );

  protected readonly actions = [
    { path: '/member/groups', icon: 'users', label: 'My Groups' },
    { path: '/member/auctions', icon: 'gavel', label: 'Auctions' },
    { path: '/member/payments', icon: 'card', label: 'Payments' },
    { path: '/member/profile', icon: 'user', label: 'Profile' },
  ];

  protected st = effStatus;
  protected paid = paidOf;
  protected bal = outstandingOf;
  protected groupName(id: number): string { return this.store.group(id)?.name ?? ''; }
  protected when(): string { const a = this.nextAuction(); return a ? whenLabel(auctionDate(a)) : ''; }
}
