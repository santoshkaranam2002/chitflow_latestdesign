import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { UserService } from '../../core/services/user.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-help-support',
  imports: [FormsModule, EmptyState, Icon, PageHeader],
  templateUrl: './help-support.html',
  styleUrl: './help-support.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpSupport {
  private readonly allFaqs = inject(UserService).faqs;

  protected readonly query = signal('');
  protected readonly open = signal<number | null>(0);
  protected readonly faqs = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.allFaqs.filter((f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  });

  protected flip(i: number): void {
    this.open.set(this.open() === i ? null : i);
  }
}
