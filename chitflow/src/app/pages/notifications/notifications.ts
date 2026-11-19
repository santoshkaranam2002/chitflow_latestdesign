import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StampPipe } from '../../shared/pipes/stamp.pipe';

import { AppNotification, DataStore } from '../../core/data';
import { TabOption } from '../../core/models';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { IconTile } from '../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../shared/page-header/page-header';
import { Tabs } from '../../shared/tabs/tabs';

const TONE: Record<string, { bg: string; color: string; icon: string }> = {
  auction: { bg: '#ffe6d8', color: '#f26a1b', icon: 'gavel' },
  payment: { bg: '#dcf5e6', color: '#1b8a4b', icon: 'card' },
  dividend: { bg: '#fff0c9', color: '#d99a06', icon: 'coin' },
  result: { bg: '#ece8fd', color: '#6c55d9', icon: 'trophy' },
  system: { bg: '#ece8fd', color: '#6c55d9', icon: 'bell' },
};

/** Notifications of the signed-in user (admin or member – the store only holds their own). */
@Component({
  selector: 'app-notifications',
  imports: [StampPipe, EmptyState, Icon, IconTile, PageHeader, Tabs],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications {
  protected readonly store = inject(DataStore);
  protected readonly unread = this.store.unreadCount;
  protected readonly tab = signal('all');

  protected readonly tabs = computed<TabOption[]>(() => [
    { id: 'all', label: 'All', count: this.store.notifications().length },
    { id: 'unread', label: 'Unread', count: this.unread() },
  ]);
  protected readonly visible = computed(() =>
    [...this.store.notifications()].filter((n) => this.tab() === 'all' || !n.read).sort((a, b) => (b.time || '').localeCompare(a.time || '') || b.id - a.id),
  );

  protected tone(n: AppNotification) {
    return TONE[n.type] ?? TONE['system'];
  }
}
