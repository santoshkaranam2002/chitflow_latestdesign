import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataStore } from '../../core/data';
import { todayISO } from '../../core/ledger';
import { ToastService } from '../../core/services/toast.service';
import { errMsg, to12, to24 } from '../../core/utils/view.util';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Schedule an auction, or edit one (?id=). ?groupId= pre-selects the group. */
@Component({
  selector: 'app-add-auction',
  imports: [FormsModule, Icon, PageHeader, InrPipe],
  templateUrl: './add-auction.html',
  styleUrl: './add-auction.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAuction {
  private readonly router = inject(Router);
  protected readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  readonly groupId = input<string>();
  protected readonly editing = computed(() => !!this.id());

  protected readonly group = signal<number>(0);
  protected readonly date = signal(todayISO());
  protected readonly start = signal('10:00');
  protected readonly end = signal('10:30');
  protected readonly startingBid = signal(0);
  protected readonly increment = signal(0);
  protected readonly label = signal('');
  protected readonly month = signal<number | null>(null);
  protected readonly durations = [15, 30, 60];

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly today = todayISO();

  protected readonly selected = computed(() => this.store.group(this.group()));
  protected readonly commissionAmount = computed(() => {
    const g = this.selected();
    return g ? (g.commissionType === 'Percent' ? Math.round((g.chitValue * g.commissionValue) / 100) : g.commissionValue) : 0;
  });

  constructor() {
    // editing: load the real auction; creating: default to ?groupId= or the first group
    effect(() => {
      const a = this.store.auction(this.id() ?? 0);
      if (a) {
        untracked(() => {
          this.group.set(a.groupId); this.date.set(a.scheduledDate); this.start.set(to24(a.startTime)); this.end.set(to24(a.endTime));
          this.startingBid.set(a.startingBid); this.increment.set(a.bidIncrement); this.label.set(a.label); this.month.set(a.monthIndex);
        });
      }
    });
    effect(() => {
      if (this.editing()) return;
      const g = this.store.group(Number(this.groupId() || 0)) ?? this.store.groups()[0];
      if (g) untracked(() => this.pickGroup(g.id));
    });
  }

  protected pickGroup(v: number | string): void {
    const g = this.store.group(+v);
    this.group.set(+v);
    if (g && !this.editing()) { this.startingBid.set(g.startingBid); this.increment.set(g.bidIncrement); }
  }

  private mins(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  protected onStart(v: string): void {
    this.start.set(v);
    if (!v) return;
    const total = (this.mins(v) + 30) % 1440;
    this.end.set(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  }
  protected setDuration(m: number): void {
    if (!this.start()) return;
    const total = (this.mins(this.start()) + m) % 1440;
    this.end.set(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  }
  protected duration(): number { return this.start() && this.end() ? this.mins(this.end()) - this.mins(this.start()) : 0; }

  protected save(): void {
    if (!this.group()) { this.error.set('Pick a group for this auction.'); return; }
    if (!this.date()) { this.error.set('Pick a date for this auction.'); return; }
    if (!this.start() || !this.end()) { this.error.set('Pick a start and end time.'); return; }
    if (this.mins(this.end()) <= this.mins(this.start())) { this.error.set('End time must be after the start time.'); return; }
    this.error.set('');
    this.saving.set(true);
    const body = {
      groupId: this.group(), monthIndex: this.month() ?? undefined, label: this.label(), scheduledDate: this.date(),
      startTime: to12(this.start()), endTime: to12(this.end()), startingBid: this.startingBid(), bidIncrement: this.increment(),
    };
    const req = this.editing() ? this.store.updateAuction(Number(this.id()), body) : this.store.createAuction(body);
    req.subscribe({
      next: (a) => {
        this.saving.set(false);
        this.toast.show(this.editing() ? 'Auction updated' : 'Auction scheduled', 'success', 'gavel');
        this.router.navigate(['/auctions/details'], { queryParams: { id: a.id } });
      },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not save the auction.')); },
    });
  }
}
