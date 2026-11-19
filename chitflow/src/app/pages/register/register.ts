import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ChitApi } from '../../core/chit-api';
import { DataStore } from '../../core/data';
import { Session } from '../../core/session';
import { checkPassword } from '../../core/utils/password.util';
import { initialsOf } from '../../core/utils/date.util';
import { errMsg } from '../../core/utils/view.util';
import { PhotoPicker } from '../../shared/photo-picker/photo-picker';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, Icon, PageHeader, PhotoPicker],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly router = inject(Router);
  private readonly api = inject(ChitApi);
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);

  protected readonly photo = signal('');
  protected readonly initialsOf = initialsOf;
  protected readonly orgName = signal('');
  protected readonly name = signal('');
  protected readonly mobile = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly strength = computed(() => checkPassword(this.password()));
  protected readonly segments = [1, 2, 3, 4];

  protected register(): void {
    if (!this.orgName().trim() || !this.name().trim() || !this.email().trim() || !this.mobile().trim() || !this.password().trim()) {
      this.error.set('Please fill in every field to create your organization account.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.api
      .register({
        orgName: this.orgName().trim(),
        ownerName: this.name().trim(),
        email: this.email().trim(),
        phone: this.mobile().trim(),
        password: this.password().trim(),
        photo: this.photo(),
      })
      .subscribe({
        next: (user) => {
          this.loading.set(false);
          this.store.reset();
          this.store.loaded.set(true); // a brand-new account has no records yet
          this.session.setUser(user);
          this.router.navigateByUrl('/home');
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(errMsg(e, 'Could not create your account. Please try again.'));
        },
      });
  }
}
