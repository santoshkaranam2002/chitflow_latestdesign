import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ChitApi } from '../../../core/chit-api';
import { DataStore } from '../../../core/data';
import { effStatus, fmtDate, maturityDate, membershipState, outstandingOf, paidOf } from '../../../core/ledger';
import { Session } from '../../../core/session';
import { auctionPill, groupTone, payPill } from '../../../core/utils/view.util';
import { Icon } from '../../../shared/icon/icon';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../../shared/progress-ring/progress-ring';

@Component({
  selector: 'app-member-group-details',
  imports: [DatePipe, NgClass, Icon, IconTile, InrPipe, PageHeader, ProgressRing],
  templateUrl: './member-group-details.html',
  styleUrl: './member-group-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberGroupDetails {
  private readonly store = inject(DataStore);
  private readonly api = inject(ChitApi);
  private readonly session = inject(Session);
  private readonly memberId = computed(() => this.session.current().memberId ?? 0);

  readonly id = input<string>();
  /** only groups this member belongs to are available */
  protected readonly group = computed(() => this.store.memberGroups(this.memberId()).find((g) => g.id === Number(this.id() || 0)));
  protected readonly ms = computed(() => this.store.memberships().find((m) => m.groupId === this.group()?.id && m.memberId === this.memberId()));
  protected readonly state = computed(() => membershipState(this.ms(), this.group()));
  protected readonly tone = computed(() => groupTone(this.group()?.id ?? 0));
  protected readonly progress = computed(() => (this.group()?.durationMonths ? ((this.group()!.currentMonth || 0) / this.group()!.durationMonths) * 100 : 0));

  protected readonly auctions = computed(() => (this.group() ? this.store.groupAuctions(this.group()!.id) : []));
  protected readonly liveOrNext = computed(() => this.auctions().find((a) => a.status === 'Live' || a.status === 'Upcoming'));
  protected readonly results = computed(() => this.auctions().filter((a) => a.status === 'Completed').sort((a, b) => b.monthIndex - a.monthIndex));

  protected readonly payments = computed(() =>
    this.store.memberPayments(this.memberId()).filter((p) => p.groupId === this.group()?.id && p.type === 'Installment').sort((a, b) => b.monthIndex - a.monthIndex),
  );
  protected readonly paidCount = computed(() => this.payments().filter((p) => effStatus(p) === 'Paid').length);

  /** winner names come from each auction's bids (the member portal doesn't load other members) */
  protected readonly winners = signal<Record<number, string>>({});

  constructor() {
    effect(() => {
      const done = this.results();
      if (!done.length) return;
      untracked(() =>
        forkJoin(done.map((a) => this.api.getBids(a.id))).subscribe((all) => {
          const map: Record<number, string> = {};
          done.forEach((a, i) => {
            const top = [...all[i]].sort((x, y) => y.amount - x.amount).find((b) => b.memberId === a.winnerMemberId) ?? all[i][0];
            map[a.id] = a.winnerMemberId === this.memberId() ? 'You' : top?.memberName ?? '—';
          });
          this.winners.set(map);
        }),
      );
    });
  }

  protected readonly maturity = computed(() => maturityDate(this.group()?.startDate, this.group()?.durationMonths));
  protected st = effStatus;
  protected paid = paidOf;
  protected bal = outstandingOf;
  protected fmt = fmtDate;
  protected pill = auctionPill;
  protected payClass = payPill;
}
