import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { Session } from '../../core/session';
import { ToastService } from '../../core/services/toast.service';
import { errMsg } from '../../core/utils/view.util';
import { Avatar } from '../../shared/avatar/avatar';
import { PhotoPicker } from '../../shared/photo-picker/photo-picker';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { inrShort } from '../../core/ledger';

/** Organizer account (comes from the login). */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, Avatar, Icon, PageHeader, PhotoPicker],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly store = inject(DataStore);

  private readonly toast = inject(ToastService);
  protected readonly user = this.session.current;
  protected readonly groups = computed(() => this.store.groups().length);
  protected readonly members = computed(() => this.store.members().length);
  protected readonly collected = computed(() => inrShort(this.store.totalCollected()));

  protected savePhoto(photo: string): void {
    this.store.savePhoto(photo).subscribe({
      next: () => this.toast.show(photo ? 'Profile photo updated' : 'Profile photo removed', 'success', 'check'),
      error: (e) => this.toast.show(errMsg(e, 'Could not save the photo.'), 'info', 'alert'),
    });
  }

  protected logout(): void {
    this.session.logout();
    this.store.reset();
    this.router.navigateByUrl('/login');
  }
}
