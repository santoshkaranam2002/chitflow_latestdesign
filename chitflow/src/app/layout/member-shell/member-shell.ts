import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DataStore } from '../../core/data';
import { Session } from '../../core/session';
import { poll } from '../../core/utils/poll';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { Drawer } from '../drawer/drawer';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

/**
 * Layout for every signed-in member screen.
 * No loading screen: pages open at once from the copy saved on this device (or the data fetched at login),
 * and fresh data is fetched quietly in the background (right away, then every 45 seconds while the tab is open).
 */
@Component({
  selector: 'app-member-shell',
  imports: [RouterOutlet, BottomNav, Drawer, Sidebar, Topbar],
  templateUrl: './member-shell.html',
  styleUrl: './member-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberShell {
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);

  protected readonly drawerOpen = signal(false);
  /** only set when the very first fetch failed and there is nothing saved to show */
  protected readonly error = signal('');

  constructor() {
    const u = this.session.current();
    if (!this.store.loaded()) this.store.hydrate(u.id);
    this.refresh();
    poll(inject(DestroyRef), 45000, () => this.store.loadBootstrap(u.id));

  }

  protected refresh(): void {
    this.error.set('');
    this.store.loadBootstrap(this.session.current().id).subscribe({
      error: (e) => { if (!this.store.loaded()) this.error.set(e?.message || 'Could not reach the ChitFlow server.'); },
    });
  }
}
