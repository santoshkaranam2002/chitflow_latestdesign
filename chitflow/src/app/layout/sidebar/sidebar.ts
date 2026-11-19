import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { DataStore } from '../../core/data';
import { Session } from '../../core/session';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo/logo';

interface SideLink { path: string; icon: string; label: string; badge?: boolean; }
interface SideSection { title: string; links: SideLink[]; }

const ADMIN_MENU: SideSection[] = [
  { title: 'Main', links: [{ path: '/home', icon: 'grid', label: 'Overview' }] },
  {
    title: 'Operations',
    links: [
      { path: '/groups', icon: 'users', label: 'Chit Groups' },
      { path: '/members', icon: 'user', label: 'Members' },
      { path: '/auctions', icon: 'gavel', label: 'Auctions' },
    ],
  },
  {
    title: 'Finance',
    links: [
      { path: '/payments', icon: 'card', label: 'Payments' },
      { path: '/dividends', icon: 'coin', label: 'Dividends' },
      { path: '/defaulters', icon: 'alert', label: 'Defaulters' },
      { path: '/reports', icon: 'file', label: 'Reports' },
    ],
  },
  {
    title: 'Account',
    links: [
      { path: '/notifications', icon: 'bell', label: 'Notifications', badge: true },
      { path: '/settings', icon: 'settings', label: 'Settings' },
      { path: '/profile', icon: 'user', label: 'Profile' },
      { path: '/help', icon: 'help', label: 'Help & Support' },
    ],
  },
];

const MEMBER_MENU: SideSection[] = [
  { title: 'Main', links: [{ path: '/member/dashboard', icon: 'grid', label: 'Overview' }] },
  {
    title: 'My Chits',
    links: [
      { path: '/member/groups', icon: 'users', label: 'My Groups' },
      { path: '/member/auctions', icon: 'gavel', label: 'Auctions' },
    ],
  },
  {
    title: 'Finance',
    links: [
      { path: '/member/payments', icon: 'card', label: 'Payment History' },
      { path: '/member/dividends', icon: 'coin', label: 'Dividends' },
    ],
  },
  {
    title: 'Account',
    links: [
      { path: '/member/notifications', icon: 'bell', label: 'Notifications', badge: true },
      { path: '/member/profile', icon: 'user', label: 'My Profile' },
    ],
  },
];

/** Dark navy sidebar. Pass [member]="true" for the Member portal menu. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, Logo],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);

  readonly member = input(false);

  protected readonly unread = this.store.unreadCount;
  protected readonly sections = computed(() => (this.member() ? MEMBER_MENU : ADMIN_MENU));
  protected readonly user = this.session.current;
  protected readonly homePath = computed(() => (this.member() ? '/member/dashboard' : '/home'));
  protected readonly profilePath = computed(() => (this.member() ? '/member/profile' : '/profile'));
  protected readonly role = computed(() => (this.member() ? 'Chit member' : 'Chit organizer'));

  protected logout(): void {
    this.session.logout();
    this.store.reset();
    this.router.navigateByUrl('/login');
  }
}
