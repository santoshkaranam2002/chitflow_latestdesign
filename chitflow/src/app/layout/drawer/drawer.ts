import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { DataStore } from '../../core/data';
import { DRAWER_MENU } from '../../core/data/app-content';
import { NavItem } from '../../core/models';
import { ThemeService } from '../../core/services/theme.service';
import { Session } from '../../core/session';
import { Icon } from '../../shared/icon/icon';

const MEMBER_MENU: NavItem[] = [
  { path: '/member/dashboard', icon: 'grid', label: 'Dashboard' },
  { path: '/member/groups', icon: 'users', label: 'My Groups' },
  { path: '/member/auctions', icon: 'gavel', label: 'Auctions' },
  { path: '/member/payments', icon: 'card', label: 'Payment History' },
  { path: '/member/dividends', icon: 'coin', label: 'Dividends' },
  { path: '/member/notifications', icon: 'bell', label: 'Notifications', badge: 'unread' },
  { path: '/member/profile', icon: 'user', label: 'My Profile' },
];

@Component({
  selector: 'app-drawer',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './drawer.html',
  styleUrl: './drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Drawer {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);

  readonly open = input(false);
  readonly member = input(false);
  readonly closed = output<void>();

  protected readonly menu = computed<NavItem[]>(() => (this.member() ? MEMBER_MENU : DRAWER_MENU));
  protected readonly user = this.session.current;
  protected readonly profilePath = computed(() => (this.member() ? '/member/profile' : '/profile'));
  protected readonly role = computed(() => (this.member() ? 'Chit member' : 'Chit organizer'));
  protected readonly unread = this.store.unreadCount;
  protected readonly theme = inject(ThemeService);

  protected logout(): void {
    this.closed.emit();
    this.session.logout();
    this.store.reset();
    this.router.navigateByUrl('/login');
  }
}
