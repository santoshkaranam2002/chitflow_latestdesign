import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { StampPipe } from '../../shared/pipes/stamp.pipe';
import { Router, RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { fmtDate } from '../../core/ledger';
import { LabelValue } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { errMsg } from '../../core/utils/view.util';
import { Confetti } from '../../shared/confetti/confetti';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Result of one auction. When it is "Pending Confirmation" the organizer confirms it here. */
@Component({
  selector: 'app-auction-result',
  imports: [StampPipe, RouterLink, Confetti, CountUp, EmptyState, Icon, PageHeader, InrPipe],
  templateUrl: './auction-result.html',
  styleUrl: './auction-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionResult {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  protected readonly auction = computed(() => this.store.auction(this.id() ?? 0));
  protected readonly group = computed(() => (this.auction() ? this.store.group(this.auction()!.groupId) : undefined));
  protected readonly winner = computed(() => {
    const a = this.auction();
    return a?.winnerMemberId ? this.store.member(a.winnerMemberId) : undefined;
  });
  protected readonly bids = computed(() => this.store.auctionBids(this.id() ?? 0));
  protected readonly confirming = signal(false);
  protected readonly pending = computed(() => this.auction()?.status === 'Pending Confirmation');
  protected readonly done = computed(() => this.auction()?.status === 'Completed');
  protected readonly prize = computed(() => this.auction()?.prizeAmount ?? 0);

  protected readonly rows = computed<LabelValue[]>(() => {
    const a = this.auction();
    if (!a) return [];
    const f = (n?: number) => (n === undefined || n === null ? '—' : `₹${n.toLocaleString('en-IN')}`);
    return [
      { label: 'Group', value: this.group()?.name ?? '—' },
      { label: 'Auction', value: `${a.label} • ${fmtDate(a.scheduledDate)}` },
      { label: 'Chit value', value: f(this.group()?.chitValue) },
      { label: 'Winning bid', value: f(a.winningBid) },
      { label: 'Prize amount', value: f(a.prizeAmount) },
      { label: 'Foreman commission', value: f(a.commission) },
      { label: 'Dividend per member', value: f(a.dividendPerMember) },
      { label: 'Next installment', value: f(a.finalInstallment) },
    ];
  });

  constructor() {
    effect(() => {
      const id = Number(this.id() || 0);
      if (id) untracked(() => this.store.loadBids(id).subscribe());
    });
  }

  protected confirm(): void {
    const a = this.auction();
    if (!a) return;
    this.confirming.set(true);
    this.store.confirmAuction(a.id).subscribe({
      next: () => {
        // settlement created new payment / dividend rows on the backend – refresh them
        const adminId = this.group()?.adminId;
        this.store.loadPayments({ adminId }).subscribe();
        this.store.loadDividends({ adminId }).subscribe();
        this.store.loadGroups({ adminId }).subscribe();
        this.toast.show('Result confirmed – dues and dividends created', 'success', 'trophy');
        this.router.navigateByUrl('/auctions');
      },
      error: (e) => { this.confirming.set(false); this.toast.show(errMsg(e, 'Could not confirm this result.'), 'info', 'alert'); },
    });
  }
}
