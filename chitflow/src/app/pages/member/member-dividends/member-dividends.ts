import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DataStore } from '../../../core/data';
import { Session } from '../../../core/session';
import { CountUp } from '../../../shared/count-up/count-up';
import { EmptyState } from '../../../shared/empty-state/empty-state';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

/** Dividends credited to the signed-in member from their own groups. */
@Component({
  selector: 'app-member-dividends',
  imports: [FormsModule, CountUp, EmptyState, IconTile, PageHeader, InrPipe],
  templateUrl: './member-dividends.html',
  styleUrl: './member-dividends.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDividends {
  protected readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly memberId = computed(() => this.session.current().memberId ?? 0);
  protected readonly groups = computed(() => this.store.memberGroups(this.memberId()));
  protected readonly groupFilter = signal<'All' | number>('All');

  protected readonly rows = computed(() => {
    const ids = new Set(this.groups().map((g) => g.id));
    return this.store.dividends().filter((d) => ids.has(d.groupId) && (this.groupFilter() === 'All' || d.groupId === this.groupFilter())).sort((a, b) => b.monthIndex - a.monthIndex || b.id - a.id);
  });
  protected readonly total = computed(() => this.rows().reduce((s, d) => s + d.perMember, 0));
  protected auctionLabel(id: number): string { return this.store.auction(id)?.label ?? ''; }
  protected groupName(id: number): string { return this.store.group(id)?.name ?? String(id); }
}
