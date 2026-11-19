import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { ThemeService } from '../../core/services/theme.service';
import { Session } from '../../core/session';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService);
  protected readonly user = inject(Session).current;

  readonly member = input(false);

  protected readonly profilePath = computed(() => (this.member() ? '/member/profile' : '/profile'));
  protected readonly unread = inject(DataStore).unreadCount;
  protected readonly bellPath = computed(() => (this.member() ? '/member/notifications' : '/notifications'));
  protected readonly query = signal('');

  protected search(): void {
    this.router.navigate([this.member() ? '/member/groups' : '/groups']);
  }
}
