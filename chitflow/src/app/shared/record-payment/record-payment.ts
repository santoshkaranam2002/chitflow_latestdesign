import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DataStore, Payment } from '../../core/data';
import { fmtDate, outstandingOf, paidOf, todayISO } from '../../core/ledger';
import { ToastService } from '../../core/services/toast.service';
import { errMsg } from '../../core/utils/view.util';
import { Icon } from '../icon/icon';
import { InrPipe } from '../pipes/inr.pipe';

/**
 * Record money received against one installment (full or part payment).
 * The backend adds it to what was already received and sets Paid / Partial.
 * Shown whenever [payment] is set.
 */
@Component({
  selector: 'app-record-payment',
  imports: [FormsModule, Icon, InrPipe],
  templateUrl: './record-payment.html',
  styleUrl: './record-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPayment {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);

  readonly payment = input<Payment | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Payment>();

  protected readonly amount = signal(0);
  protected readonly method = signal('Cash');
  protected readonly paidDate = signal(todayISO());
  protected readonly today = todayISO();
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly Math = Math;
  protected readonly methods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

  protected readonly member = computed(() => this.store.member(this.payment()?.memberId ?? 0));
  protected readonly group = computed(() => this.store.group(this.payment()?.groupId ?? 0));
  protected readonly received = computed(() => (this.payment() ? paidOf(this.payment()!) : 0));
  protected readonly balance = computed(() => (this.payment() ? outstandingOf(this.payment()!) : 0));
  protected readonly isPart = computed(() => !!this.amount() && this.amount() < this.balance());
  protected readonly dueLabel = computed(() => fmtDate(this.payment()?.dueDate));

  constructor() {
    effect(() => {
      const p = this.payment();
      if (!p) return;
      untracked(() => {
        this.amount.set(outstandingOf(p));
        this.method.set(p.method || 'Cash');
        this.paidDate.set(todayISO());
        this.error.set('');
      });
    });
  }

  protected save(): void {
    const p = this.payment();
    if (!p) return;
    const amt = Number(this.amount());
    if (!amt || amt <= 0) { this.error.set('Enter the amount received.'); return; }
    if (amt > this.balance() + 0.009) { this.error.set(`Amount can't be more than the balance (₹${this.balance()}).`); return; }
    this.error.set('');
    this.saving.set(true);
    this.store.recordPayment(p.id, { amount: amt, method: this.method(), paidDate: this.paidDate() }).subscribe({
      next: (row) => {
        this.saving.set(false);
        this.toast.show('Payment recorded', 'success', 'check');
        this.saved.emit(row);
        this.closed.emit();
      },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not save this payment.')); },
    });
  }
}
