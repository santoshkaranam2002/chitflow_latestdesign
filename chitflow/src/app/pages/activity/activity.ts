import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StampPipe } from '../../shared/pipes/stamp.pipe';

import { ChitApi } from '../../core/chit-api';
import { Session } from '../../core/session';
import { errMsg } from '../../core/utils/view.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { IconTile } from '../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../shared/page-header/page-header';

interface AuditRow { id: number; actor: string; action: string; entity: string; detail: string; time: string; }

/** Who did what: payments, auctions and other important admin actions. */
@Component({
  selector: 'app-activity',
  imports: [StampPipe, EmptyState, IconTile, PageHeader],
  templateUrl: './activity.html',
  styleUrl: './activity.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Activity {
  private readonly api = inject(ChitApi);
  private readonly session = inject(Session);

  protected readonly rows = signal<AuditRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    const u = this.session.current();
    this.api.getAudit(u.adminId ?? u.id).subscribe({
      next: (r) => { this.rows.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e, 'Could not load the activity log.')); this.loading.set(false); },
    });
  }

  protected icon(e: string): string { return e === 'Payment' ? 'card' : e === 'Auction' ? 'gavel' : e === 'Group' ? 'users' : 'user'; }
}
