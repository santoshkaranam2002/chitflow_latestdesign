import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChitGroup, DataStore } from '../../core/data';
import { effStatus } from '../../core/ledger';
import { auctionDate, groupTone, whenLabel } from '../../core/utils/view.util';
import { Icon } from '../icon/icon';
import { IconTile } from '../icon-tile/icon-tile';
import { InrPipe } from '../pipes/inr.pipe';
import { ProgressRing } from '../progress-ring/progress-ring';

@Component({
  selector: 'app-group-card',
  imports: [RouterLink, DatePipe, Icon, IconTile, InrPipe, ProgressRing],
  templateUrl: './group-card.html',
  styleUrl: './group-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCard {
  private readonly store = inject(DataStore);

  readonly group = input.required<ChitGroup>();

  protected readonly tone = computed(() => groupTone(this.group().id));
  protected readonly joined = computed(() => this.store.groupMembers(this.group().id).length);
  /** members who have paid this chit month / members billed this month */
  protected readonly paid = computed(() => {
    const g = this.group();
    const rows = this.store.groupPayments(g.id).filter((p) => p.type === 'Installment' && p.monthIndex === g.currentMonth);
    return { done: rows.filter((p) => effStatus(p) === 'Paid').length, of: rows.length };
  });
  protected readonly percent = computed(() => (this.paid().of ? Math.round((this.paid().done / this.paid().of) * 100) : 0));
  protected readonly next = computed(() => {
    const a = this.store.groupAuctions(this.group().id).find((x) => x.status === 'Live' || x.status === 'Upcoming');
    return a ? auctionDate(a) : null;
  });
  protected readonly isToday = computed(() => !!this.next() && whenLabel(this.next()!) === 'Today');
  protected readonly when = computed(() => (this.next() ? whenLabel(this.next()!) : 'No auction scheduled'));
}
