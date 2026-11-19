import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ChitGroup, CommissionType, DataStore, GroupStatus } from '../../core/data';
import { todayISO } from '../../core/ledger';
import { Session } from '../../core/session';
import { ToastService } from '../../core/services/toast.service';
import { errMsg } from '../../core/utils/view.util';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Create a chit group, or edit one when opened with ?id= */
@Component({
  selector: 'app-create-group',
  imports: [FormsModule, Icon, PageHeader, InrPipe],
  templateUrl: './create-group.html',
  styleUrl: './create-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroup {
  private readonly router = inject(Router);
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly toast = inject(ToastService);

  /** ?id= – present when editing */
  readonly id = input<string>();
  protected readonly editing = computed(() => !!this.id());

  protected readonly name = signal('');
  protected readonly value = signal(100000);
  protected readonly members = signal(20);
  protected readonly duration = signal(20);
  protected readonly installment = signal(5000);
  protected readonly start = signal(todayISO());
  protected readonly auctionDay = signal(1);
  protected readonly startingBid = signal(5000);
  protected readonly minBid = signal(5000);
  protected readonly maxBid = signal(30000);
  protected readonly bidIncrement = signal(500);
  protected readonly commissionType = signal<CommissionType>('Fixed');
  protected readonly commissionValue = signal(5000);
  protected readonly foreman = signal(this.session.current().name);
  protected readonly status = signal<GroupStatus>('Upcoming');
  protected readonly statuses: GroupStatus[] = ['Upcoming', 'Active', 'Completed'];
  protected readonly types: CommissionType[] = ['Fixed', 'Percent'];

  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly pool = computed(() => this.installment() * this.members());
  protected readonly commissionAmount = computed(() =>
    this.commissionType() === 'Percent' ? Math.round((this.value() * this.commissionValue()) / 100) : this.commissionValue(),
  );

  constructor() {
    // fill the form from the real group when editing
    effect(() => {
      const g = this.store.group(this.id() ?? 0);
      if (g) untracked(() => this.fill(g));
    });
  }

  private fill(g: ChitGroup): void {
    this.name.set(g.name); this.value.set(g.chitValue); this.members.set(g.totalMembers); this.duration.set(g.durationMonths);
    this.installment.set(g.monthlyInstallment); this.start.set(g.startDate || todayISO()); this.auctionDay.set(g.auctionDay);
    this.startingBid.set(g.startingBid); this.minBid.set(g.minBid); this.maxBid.set(g.maxBid); this.bidIncrement.set(g.bidIncrement);
    this.commissionType.set(g.commissionType); this.commissionValue.set(g.commissionValue); this.foreman.set(g.foreman); this.status.set(g.status);
  }

  protected step(target: 'members' | 'duration', by: number): void {
    const sig = target === 'members' ? this.members : this.duration;
    sig.update((v) => Math.max(1, v + by));
    if (target === 'members') this.recalc();
  }

  /** keep the installment = chit value / members (admin can still override it) */
  protected recalc(): void {
    if (this.members() > 0) this.installment.set(Math.round(this.value() / this.members()));
  }

  protected save(): void {
    if (!this.name().trim()) { this.error.set('Group name is required.'); return; }
    this.error.set('');
    this.saving.set(true);
    const body = {
      name: this.name().trim(), chitValue: this.value(), totalMembers: this.members(), durationMonths: this.duration(),
      monthlyInstallment: this.installment(), startDate: this.start(), auctionDay: this.auctionDay(), startingBid: this.startingBid(),
      minBid: this.minBid(), maxBid: this.maxBid(), bidIncrement: this.bidIncrement(), commissionType: this.commissionType(),
      commissionValue: this.commissionValue(), foreman: this.foreman(), status: this.status(),
    };
    const req = this.editing()
      ? this.store.updateGroup(Number(this.id()), body)
      : this.store.createGroup({ ...body, adminId: this.session.current().adminId ?? this.session.current().id });
    req.subscribe({
      next: (g) => {
        this.saving.set(false);
        this.toast.show(this.editing() ? 'Group updated' : 'Chit group created', 'success', 'users');
        this.router.navigate(['/groups/details'], { queryParams: { id: g.id } });
      },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not save the group.')); },
    });
  }
}
