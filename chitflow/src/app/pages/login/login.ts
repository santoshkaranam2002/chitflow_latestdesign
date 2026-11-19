import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ChitApi } from '../../core/chit-api';
import { DataStore } from '../../core/data';
import { TabOption } from '../../core/models';
import { Role, Session } from '../../core/session';
import { errMsg } from '../../core/utils/view.util';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo/logo';
import { Tabs } from '../../shared/tabs/tabs';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Icon, Logo, Tabs],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly router = inject(Router);
  private readonly api = inject(ChitApi);
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);

  protected readonly role = signal<string>('admin');
  protected readonly roles: TabOption[] = [
    { id: 'admin', label: 'Admin' },
    { id: 'member', label: 'Member' },
  ];

  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  /** set to 1 by the API interceptor when the saved session ran out */
  readonly expired = input<string>();

  protected readonly trust = [
    { icon: 'shield', label: 'Secure' },
    { icon: 'eye', label: 'Transparent' },
    { icon: 'bolt', label: 'Instant' },
  ];

  constructor() {
    effect(() => { if (this.expired()) this.error.set('Your session has expired. Please log in again.'); });
  }

  protected setRole(r: string): void {
    this.role.set(r);
    this.error.set('');
  }

  private open(): void {
    this.loading.set(false);
    this.router.navigateByUrl(this.session.homePath());
  }

  protected login(): void {
    if (!this.identifier().trim() || !this.password().trim()) {
      this.error.set('Please enter your email/phone and password.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.api.login(this.identifier().trim(), this.password().trim(), this.role()).subscribe({
      next: (user) => {
        this.store.reset();
        this.session.setUser(user);
        // fetch everything in ONE request before opening the dashboard, so it appears already filled
        this.store.loadBootstrap(user.id).subscribe({
          next: () => this.open(),
          error: () => this.open(), // the app retries quietly by itself
        });
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errMsg(e, 'Could not sign in. Please check your details and try again.'));
      },
    });
  }
}
