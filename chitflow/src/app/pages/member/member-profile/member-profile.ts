import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DataStore } from '../../../core/data';
import { membershipState } from '../../../core/ledger';
import { Session } from '../../../core/session';
import { ToastService } from '../../../core/services/toast.service';
import { errMsg } from '../../../core/utils/view.util';
import { groupTone } from '../../../core/utils/view.util';
import { Avatar } from '../../../shared/avatar/avatar';
import { PhotoPicker } from '../../../shared/photo-picker/photo-picker';
import { Icon } from '../../../shared/icon/icon';
import { PageHeader } from '../../../shared/page-header/page-header';

@Component({
  selector: 'app-member-profile',
  imports: [DatePipe, Avatar, Icon, PageHeader, PhotoPicker],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberProfile {
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  private readonly toast = inject(ToastService);
  protected readonly user = this.session.current;
  protected readonly me = computed(() => this.store.member(this.user().memberId ?? 0));
  protected readonly groups = computed(() =>
    this.store.memberGroups(this.user().memberId ?? 0).map((g) => ({
      g, tone: groupTone(g.id),
      state: membershipState(this.store.memberships().find((m) => m.groupId === g.id && m.memberId === this.user().memberId), g),
    })),
  );

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
