import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Auction, DataStore } from '../../core/data';
import { TabOption } from '../../core/models';
import { injectNow, pad, splitDuration } from '../../core/utils/time.util';
import { auctionDate, auctionPill, groupTone } from '../../core/utils/view.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { IconTile } from '../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { Tabs } from '../../shared/tabs/tabs';

@Component({
  selector: 'app-auctions',
  imports: [DatePipe, NgClass, RouterLink, EmptyState, Icon, IconTile, PageHeader, InrPipe, Tabs],
  templateUrl: './auctions.html',
  styleUrl: './auctions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auctions {
  protected readonly store = inject(DataStore);
  private readonly now = injectNow(1000);

  protected readonly tab = signal('all');
  protected readonly tabs = computed<TabOption[]>(() => {
    const list = this.store.auctions();
    return [
      { id: 'all', label: 'All', count: list.length },
      { id: 'Live', label: 'Live', count: list.filter((a) => a.status === 'Live').length },
      { id: 'Upcoming', label: 'Upcoming', count: list.filter((a) => a.status === 'Upcoming').length },
      { id: 'Pending Confirmation', label: 'Confirm', count: list.filter((a) => a.status === 'Pending Confirmation').length },
      { id: 'Completed', label: 'Done', count: list.filter((a) => a.status === 'Completed').length },
    ];
  });

  /** Live auction first, otherwise the soonest upcoming one */
  protected readonly featured = computed(() => {
    const list = this.store.auctions();
    return list.find((a) => a.status === 'Live') ?? [...list].filter((a) => a.status === 'Upcoming').sort((a, b) => +auctionDate(a) - +auctionDate(b))[0];
  });
  protected readonly visible = computed(() =>
    this.store.auctions()
      .filter((a) => (this.tab() === 'all' || a.status === this.tab()) && !(this.tab() === 'all' && a.id === this.featured()?.id))
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate) || b.id - a.id),
  );
  protected readonly countdown = computed(() => {
    const f = this.featured();
    if (!f) return '';
    const d = splitDuration(+auctionDate(f) - this.now());
    return d.days > 0 ? `${d.days}d ${pad(d.hours)}h ${pad(d.minutes)}m` : `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
  });

  protected tone = groupTone;
  protected pill = auctionPill;
  protected groupName(id: number): string { return this.store.group(id)?.name ?? `Group #${id}`; }
  protected value(id: number): number { return this.store.group(id)?.chitValue ?? 0; }
  protected winner(a: Auction): string { return a.winnerMemberId ? (this.store.member(a.winnerMemberId)?.name ?? '') : ''; }
  protected link(a: Auction): string {
    return a.status === 'Live' ? '/auctions/live' : a.status === 'Completed' || a.status === 'Pending Confirmation' ? '/auctions/result' : '/auctions/details';
  }
}
