import { DatePipe } from '@angular/common';
import { StampPipe } from '../../../shared/pipes/stamp.pipe';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { EMPTY, forkJoin, tap } from 'rxjs';

import { ChitApi } from '../../../core/chit-api';
import { Auction, Bid, DataStore } from '../../../core/data';
import { Session } from '../../../core/session';
import { ToastService } from '../../../core/services/toast.service';
import { poll } from '../../../core/utils/poll';
import { auctionDate, errMsg, whenLabel } from '../../../core/utils/view.util';
import { Icon } from '../../../shared/icon/icon';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-member-auctions',
  imports: [StampPipe, DatePipe, Icon, IconTile, InrPipe, PageHeader],
  templateUrl: './member-auctions.html',
  styleUrl: './member-auctions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberAuctions {
  private readonly store = inject(DataStore);
  private readonly api = inject(ChitApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(Session);
  private readonly memberId = computed(() => this.session.current().memberId ?? 0);

  protected readonly quick = [500, 1000, 2000];
  private readonly rows = computed(() => this.store.memberAuctionRows(this.memberId()));
  protected readonly live = computed(() => this.rows().filter((a) => a.status === 'Live'));
  protected readonly upcoming = computed(() => this.rows().filter((a) => a.status === 'Upcoming').sort((a, b) => +auctionDate(a) - +auctionDate(b)));
  protected readonly previous = computed(() => this.rows().filter((a) => a.status === 'Completed' || a.status === 'Pending Confirmation').sort((a, b) => +auctionDate(b) - +auctionDate(a)));

  /** bids per auction id, refreshed every few seconds while an auction is live */
  protected readonly bids = signal<Record<number, Bid[]>>({});
  protected readonly myBid = signal<Record<number, number>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly pulse = signal(0);

  constructor() {
    const destroy = inject(DestroyRef);
    // results of finished auctions also need their bids to show the winner
    effect(() => {
      const ids = [...this.live(), ...this.previous()].map((a) => a.id);
      untracked(() => this.refresh(ids));
    });
    // latest bids every 3s while the tab is visible (requests never overlap)
    poll(destroy, 3000, () => {
      const ids = this.live().map((a) => a.id);
      if (!ids.length) return EMPTY;
      this.pulse.update((n) => n + 1);
      return this.fetch(ids);
    });
  }

  private fetch(ids: number[]) {
    return forkJoin(ids.map((id) => this.api.getBids(id))).pipe(
      tap((all) => {
        const map: Record<number, Bid[]> = { ...this.bids() };
        ids.forEach((id, i) => (map[id] = [...all[i]].sort((a, b) => b.amount - a.amount)));
        this.bids.set(map);
      }),
    );
  }
  private refresh(ids: number[]): void {
    if (ids.length) this.fetch(ids).subscribe({ error: () => {} });
  }

  protected top(a: Auction): Bid | undefined { return this.bids()[a.id]?.[0]; }
  protected highest(a: Auction): number { return this.top(a)?.amount ?? 0; }
  protected minNext(a: Auction): number { return (this.top(a)?.amount ?? a.startingBid ?? 0) + (a.bidIncrement || 0); }
  protected bidders(a: Auction): number { return new Set((this.bids()[a.id] ?? []).map((b) => b.memberId)).size; }
  protected store_me(): number { return this.memberId(); }
  protected mineAmount(a: Auction): number { return this.myBid()[a.id] ?? this.minNext(a); }
  protected setBid(a: Auction, v: number): void { this.myBid.update((m) => ({ ...m, [a.id]: Number(v) || 0 })); }
  protected raise(a: Auction, by: number): void { this.setBid(a, this.mineAmount(a) + by); }
  /** What happens if this bid wins – same formula the server uses when the auction closes. */
  protected calc(a: Auction) {
    const g = this.group(a);
    const bid = this.mineAmount(a);
    if (!g || !(bid > 0)) return null;
    const commission = g.commissionType === 'Fixed' ? g.commissionValue : Math.round((bid * g.commissionValue) / 100);
    const dividend = g.totalMembers ? Math.round((bid - commission) / g.totalMembers) : 0;
    return { prize: g.chitValue - bid, commission, dividend, installment: g.monthlyInstallment - dividend };
  }
  protected group(a: Auction) { return this.store.group(a.groupId); }
  protected groupName(a: Auction): string { return this.group(a)?.name ?? ''; }
  protected winnerName(a: Auction): string {
    if (!a.winnerMemberId) return 'Not declared';
    if (a.winnerMemberId === this.memberId()) return 'You';
    return this.bids()[a.id]?.find((b) => b.memberId === a.winnerMemberId)?.memberName ?? '—';
  }
  protected when(a: Auction): string { return whenLabel(auctionDate(a)); }

  protected place(a: Auction): void {
    if (this.busy()) return; // already sending – ignore double taps
    const amount = this.mineAmount(a);
    if (!Number.isFinite(amount) || amount < this.minNext(a)) {
      this.error.set(`Your bid must be at least ₹${this.minNext(a).toLocaleString('en-IN')}.`);
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.store.placeBid(a.id, this.memberId(), amount).subscribe({
      next: () => { this.busy.set(false); this.toast.show('Bid placed'); this.myBid.update((m) => { const { [a.id]: _, ...rest } = m; return rest; }); this.refresh([a.id]); },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e, 'Could not place the bid')); this.refresh([a.id]); },
    });
  }
}
