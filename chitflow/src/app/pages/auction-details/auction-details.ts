import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { fmtDate } from '../../core/ledger';
import { LabelValue } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { injectNow, pad, splitDuration } from '../../core/utils/time.util';
import { auctionDate, auctionPill, errMsg, groupTone } from '../../core/utils/view.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-auction-details',
  imports: [NgClass, RouterLink, EmptyState, Icon, PageHeader, InrPipe],
  templateUrl: './auction-details.html',
  styleUrl: './auction-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionDetails {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly now = injectNow(1000);

  readonly id = input<string>();
  protected readonly auction = computed(() => this.store.auction(this.id() ?? 0));
  protected readonly group = computed(() => this.store.group(this.auction()?.groupId ?? 0));
  protected readonly tone = computed(() => groupTone(this.auction()?.groupId ?? 0));
  protected readonly busy = signal(false);

  protected readonly parts = computed(() => {
    const a = this.auction();
    if (!a) return [];
    const d = splitDuration(+auctionDate(a) - this.now());
    return [
      { label: 'Days', value: pad(d.days) },
      { label: 'Hours', value: pad(d.hours) },
      { label: 'Mins', value: pad(d.minutes) },
      { label: 'Secs', value: pad(d.seconds) },
    ];
  });
  protected readonly info = computed<LabelValue[]>(() => {
    const a = this.auction();
    const g = this.group();
    if (!a) return [];
    const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
    return [
      { label: 'Chit month', value: `Month ${a.monthIndex}` },
      { label: 'Date', value: fmtDate(a.scheduledDate) || '—' },
      { label: 'Time', value: `${a.startTime || '—'} – ${a.endTime || '—'}` },
      { label: 'Total members', value: String(g ? this.store.groupMembers(g.id).length : 0) },
      { label: 'Starting bid', value: inr(a.startingBid) },
      { label: 'Bid increment', value: inr(a.bidIncrement) },
      { label: 'Commission', value: g ? (g.commissionType === 'Percent' ? `${g.commissionValue}%` : inr(g.commissionValue)) : '—' },
    ];
  });
  protected pill = auctionPill;

  protected open(): void {
    const a = this.auction();
    if (!a) return;
    this.busy.set(true);
    this.store.openAuction(a.id).subscribe({
      next: () => this.router.navigate(['/auctions/live'], { queryParams: { id: a.id } }),
      error: (e) => { this.busy.set(false); this.toast.show(errMsg(e, 'Could not open this auction.'), 'info', 'alert'); },
    });
  }
  protected remove(): void {
    const a = this.auction();
    if (!a) return;
    if (!confirm(`Delete ${a.label} for ${this.group()?.name ?? 'this group'}? This cannot be undone.`)) return;
    this.busy.set(true);
    this.store.deleteAuction(a.id).subscribe({
      next: () => { this.toast.show('Auction deleted', 'success', 'trash'); this.router.navigateByUrl('/auctions'); },
      error: (e) => { this.busy.set(false); this.toast.show(errMsg(e, 'Could not delete this auction.'), 'info', 'alert'); },
    });
  }
}
