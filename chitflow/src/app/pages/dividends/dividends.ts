import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DataStore } from '../../core/data';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { IconTile } from '../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Dividends shared with members after each confirmed auction. */
@Component({
  selector: 'app-dividends',
  imports: [FormsModule, CountUp, EmptyState, IconTile, PageHeader, InrPipe],
  templateUrl: './dividends.html',
  styleUrl: './dividends.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dividends {
  protected readonly store = inject(DataStore);
  protected readonly groupFilter = signal<'All' | number>('All');

  protected readonly rows = computed(() =>
    this.store.dividends().filter((d) => this.groupFilter() === 'All' || d.groupId === this.groupFilter()).sort((a, b) => b.monthIndex - a.monthIndex || b.id - a.id),
  );
  protected readonly total = computed(() => this.rows().reduce((s, d) => s + d.totalPool, 0));

  protected groupName(id: number): string { return this.store.group(id)?.name ?? String(id); }
  protected auctionLabel(id: number): string { return this.store.auction(id)?.label ?? ''; }
}
