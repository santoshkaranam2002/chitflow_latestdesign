import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { StampPipe } from '../../shared/pipes/stamp.pipe';
import { Router, RouterLink } from '@angular/router';
import { EMPTY } from 'rxjs';

import { DataStore } from '../../core/data';
import { ToastService } from '../../core/services/toast.service';
import { poll } from '../../core/utils/poll';
import { errMsg } from '../../core/utils/view.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../shared/progress-ring/progress-ring';

/** Organizer's live room: watch bids arrive (polls every 4s), then close the auction. */
@Component({
  selector: 'app-live-auction',
  imports: [StampPipe, RouterLink, EmptyState, Icon, PageHeader, InrPipe, ProgressRing],
  templateUrl: './live-auction.html',
  styleUrl: './live-auction.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveAuction {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  protected readonly auction = computed(() => this.store.auction(this.id() ?? 0));
  protected readonly group = computed(() => (this.auction() ? this.store.group(this.auction()!.groupId) : undefined));
  protected readonly bids = computed(() => this.store.auctionBids(this.id() ?? 0));
  protected readonly top = computed(() => this.bids()[0]);
  protected readonly totalMembers = computed(() => (this.group() ? this.store.groupMembers(this.group()!.id).length : 0));
  protected readonly participants = computed(() => new Set(this.bids().map((b) => b.memberId)).size);
  protected readonly ringValue = computed(() => (this.totalMembers() ? (this.participants() / this.totalMembers()) * 100 : 0));
  protected readonly closing = signal(false);
  protected readonly live = computed(() => this.auction()?.status === 'Live');

  constructor() {
    effect(() => {
      const id = Number(this.id() || 0);
      if (id) untracked(() => this.store.loadBids(id).subscribe({ error: () => {} }));
    });
    // other members may be bidding right now – refresh while the tab is visible and the auction is live
    poll(inject(DestroyRef), 3000, () => (this.live() ? this.store.loadBids(Number(this.id() || 0)) : EMPTY));
  }

  protected close(): void {
    const a = this.auction();
    if (!a) return;
    this.closing.set(true);
    this.store.closeAuction(a.id).subscribe({
      next: () => this.router.navigate(['/auctions/result'], { queryParams: { id: a.id } }),
      error: (e) => { this.closing.set(false); this.toast.show(errMsg(e, 'Could not close this auction.'), 'info', 'alert'); },
    });
  }
}
