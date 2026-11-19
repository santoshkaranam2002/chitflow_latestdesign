import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { TabOption } from '../../core/models';
import { auctionDate } from '../../core/utils/view.util';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { GroupCard } from '../../shared/group-card/group-card';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { Tabs } from '../../shared/tabs/tabs';

type Sort = 'recent' | 'value' | 'soon';

@Component({
  selector: 'app-groups',
  imports: [FormsModule, RouterLink, CountUp, EmptyState, GroupCard, Icon, PageHeader, Tabs],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups {
  private readonly store = inject(DataStore);

  protected readonly tab = signal('all');
  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly sort = signal<Sort>('recent');

  protected readonly tabs = computed<TabOption[]>(() => {
    const list = this.store.groups();
    return [
      { id: 'all', label: 'All', count: list.length },
      { id: 'Active', label: 'Active', count: list.filter((g) => g.status === 'Active').length },
      { id: 'Upcoming', label: 'Upcoming', count: list.filter((g) => g.status === 'Upcoming').length },
      { id: 'Completed', label: 'Done', count: list.filter((g) => g.status === 'Completed').length },
    ];
  });
  protected readonly sorts: { id: Sort; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'value', label: 'Highest value' },
    { id: 'soon', label: 'Auction soon' },
  ];

  private nextAt(id: number): number {
    const a = this.store.groupAuctions(id).find((x) => x.status === 'Live' || x.status === 'Upcoming');
    return a ? +auctionDate(a) : Number.MAX_SAFE_INTEGER;
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.store.groups().filter(
      (g) => (this.tab() === 'all' || g.status === this.tab()) && (!q || g.name.toLowerCase().includes(q) || (g.foreman || '').toLowerCase().includes(q)),
    );
    switch (this.sort()) {
      case 'value': return [...list].sort((a, b) => b.chitValue - a.chitValue);
      case 'soon': return [...list].sort((a, b) => this.nextAt(a.id) - this.nextAt(b.id));
      default: return [...list].sort((a, b) => b.id - a.id);
    }
  });

  protected readonly totalValue = computed(() => this.visible().reduce((s, g) => s + g.chitValue, 0));
  protected readonly totalMembers = computed(() => this.visible().reduce((s, g) => s + this.store.groupMembers(g.id).length, 0));
  protected readonly avgProgress = computed(() => {
    const list = this.visible();
    return list.length ? Math.round(list.reduce((s, g) => s + (g.durationMonths ? (g.currentMonth / g.durationMonths) * 100 : 0), 0) / list.length) : 0;
  });

  protected toggleSearch(): void {
    this.searching.update((v) => !v);
    if (!this.searching()) this.query.set('');
  }
}
