import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../../core/data';
import { membershipState } from '../../../core/ledger';
import { Session } from '../../../core/session';
import { auctionPill, groupTone } from '../../../core/utils/view.util';
import { CountUp } from '../../../shared/count-up/count-up';
import { EmptyState } from '../../../shared/empty-state/empty-state';
import { Icon } from '../../../shared/icon/icon';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../../shared/progress-ring/progress-ring';

@Component({
  selector: 'app-member-groups',
  imports: [DatePipe, RouterLink, CountUp, EmptyState, Icon, IconTile, InrPipe, PageHeader, ProgressRing],
  templateUrl: './member-groups.html',
  styleUrl: './member-groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberGroups {
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly memberId = computed(() => this.session.current().memberId ?? 0);

  protected readonly groups = computed(() =>
    this.store.memberGroups(this.memberId()).map((g) => {
      const ms = this.store.memberships().find((m) => m.groupId === g.id && m.memberId === this.memberId());
      const next = this.store.groupAuctions(g.id).find((a) => a.status === 'Live' || a.status === 'Upcoming');
      return { g, chit: ms?.chitNumber, state: membershipState(ms, g), next, tone: groupTone(g.id), progress: g.durationMonths ? (g.currentMonth / g.durationMonths) * 100 : 0 };
    }),
  );
  protected readonly totalValue = computed(() => this.groups().reduce((s, r) => s + r.g.chitValue, 0));
  protected readonly monthly = computed(() => this.groups().filter((r) => r.state === 'Active').reduce((s, r) => s + r.g.monthlyInstallment, 0));
  protected readonly active = computed(() => this.groups().filter((r) => r.state === 'Active').length);
  protected pill = auctionPill;
}
