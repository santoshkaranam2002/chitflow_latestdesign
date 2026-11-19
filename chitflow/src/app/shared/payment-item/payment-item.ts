import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore, Payment } from '../../core/data';
import { effStatus, outstandingOf, paidOf } from '../../core/ledger';
import { groupTone, payPill } from '../../core/utils/view.util';
import { IconTile } from '../icon-tile/icon-tile';
import { InrPipe } from '../pipes/inr.pipe';

@Component({
  selector: 'app-payment-item',
  imports: [NgClass, DatePipe, RouterLink, IconTile, InrPipe],
  templateUrl: './payment-item.html',
  styleUrl: './payment-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentItem {
  private readonly store = inject(DataStore);

  readonly payment = input.required<Payment>();

  protected readonly isPayout = computed(() => this.payment().type === 'Winner Payout');
  protected readonly status = computed(() => (this.isPayout() ? 'Paid' : effStatus(this.payment())));
  protected readonly pill = computed(() => payPill(this.status()));
  protected readonly tone = computed(() => (this.isPayout() ? { icon: 'trophy', bg: '#fff0c9', color: '#d99a06' } : { ...groupTone(this.payment().groupId), icon: 'card' }));
  protected readonly title = computed(() => {
    const p = this.payment();
    return `${this.store.member(p.memberId)?.name ?? 'Member #' + p.memberId} • ${this.isPayout() ? 'Winner payout' : 'Month ' + p.monthIndex}`;
  });
  protected readonly subtitle = computed(() => this.store.group(this.payment().groupId)?.name ?? '');
  protected readonly amount = computed(() => {
    const p = this.payment();
    return this.isPayout() ? p.amount : paidOf(p) || p.amount;
  });
  protected readonly date = computed(() => this.payment().paidDate || this.payment().dueDate);
  protected readonly due = computed(() => !this.isPayout() && outstandingOf(this.payment()) > 0);
  protected readonly link = computed(() => (this.due() ? '/payments/make' : '/payments/receipt'));
}
