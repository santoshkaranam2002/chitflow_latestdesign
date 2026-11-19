import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { overallStatus } from '../../core/ledger';
import { TabOption } from '../../core/models';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { MemberItem } from '../../shared/member-item/member-item';
import { PageHeader } from '../../shared/page-header/page-header';
import { Tabs } from '../../shared/tabs/tabs';

type StatusFilter = 'all' | 'Paid' | 'Pending' | 'Overdue';

@Component({
  selector: 'app-members',
  imports: [FormsModule, RouterLink, EmptyState, Icon, MemberItem, PageHeader, Tabs],
  templateUrl: './members.html',
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Members {
  /** long lists show 30 rows at a time */
  protected readonly limit = signal(30);
  protected more(): void { this.limit.update((n) => n + 30); }
  protected readonly store = inject(DataStore);

  protected readonly tab = signal('all');
  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly filtering = signal(false);
  protected readonly status = signal<StatusFilter>('all');
  protected readonly groupFilter = signal<'All' | number>('All');

  protected readonly tabs = computed<TabOption[]>(() => {
    const list = this.store.members();
    return [
      { id: 'all', label: 'All', count: list.length },
      { id: 'Active', label: 'Active', count: list.filter((m) => m.status === 'Active').length },
      { id: 'Inactive', label: 'Inactive', count: list.filter((m) => m.status !== 'Active').length },
    ];
  });
  protected readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Everyone' },
    { id: 'Paid', label: 'Paid up' },
    { id: 'Pending', label: 'Pending' },
    { id: 'Overdue', label: 'Overdue' },
  ];

  /** overall payment standing of a member over every group */
  private standing(memberId: number): string {
    const s = overallStatus(this.store.memberPayments(memberId).filter((p) => p.type === 'Installment'));
    return s === 'No dues' ? 'Paid' : s === 'Partial' ? 'Pending' : s;
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const gf = this.groupFilter();
    return this.store.members().filter(
      (m) =>
        (this.tab() === 'all' || (this.tab() === 'Active' ? m.status === 'Active' : m.status !== 'Active')) &&
        (gf === 'All' || m.groupIds?.includes(gf) || this.store.memberships().some((x) => x.memberId === m.id && x.groupId === gf)) &&
        (this.status() === 'all' || this.standing(m.id) === this.status()) &&
        (!q || m.name.toLowerCase().includes(q) || (m.phone || '').includes(q) || (m.code || '').toLowerCase().includes(q)),
    );
  });
  protected readonly paidCount = computed(() => this.visible().filter((m) => this.standing(m.id) === 'Paid').length);
  protected readonly pendingCount = computed(() => this.visible().length - this.paidCount());

  protected toggleSearch(): void {
    this.searching.update((v) => !v);
    if (!this.searching()) this.query.set('');
  }
}
