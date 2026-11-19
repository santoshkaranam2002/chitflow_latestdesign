import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { DataStore } from '../../core/data';
import { NAV_ITEMS } from '../../core/data/app-content';
import { NavItem } from '../../core/models';
import { Icon } from '../../shared/icon/icon';

const MEMBER_NAV: NavItem[] = [
  { path: '/member/dashboard', icon: 'home', label: 'Home' },
  { path: '/member/groups', icon: 'users', label: 'Groups' },
  { path: '/member/auctions', icon: 'gavel', label: 'Auctions' },
  { path: '/member/payments', icon: 'card', label: 'Payments' },
];

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  readonly member = input(false);
  readonly more = output<void>();

  protected readonly items = computed(() => (this.member() ? MEMBER_NAV : NAV_ITEMS));
  protected readonly unread = inject(DataStore).unreadCount;
}
