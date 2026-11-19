import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataStore } from '../../core/data';
import { effStatus, fmtDate, outstandingOf, paidOf, todayISO } from '../../core/ledger';
import { errMsg } from '../../core/utils/view.util';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** Record money received against an installment (full or part payment). */
@Component({
  selector: 'app-make-payment',
  imports: [FormsModule, Icon, PageHeader, InrPipe],
  templateUrl: './make-payment.html',
  styleUrl: './make-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MakePayment {
  private readonly router = inject(Router);
  protected readonly store = inject(DataStore);

  /** Optional ?id= of an installment – pre-selects its group and member */
  readonly id = input<string>();

  protected readonly groupId = signal<number>(0);
  protected readonly memberId = signal<number>(0);
  protected readonly paymentId = signal<number>(0);
  protected readonly amount = signal(0);
  protected readonly method = signal('Cash');
  protected readonly paidDate = signal(todayISO());
  protected readonly today = todayISO();
  protected readonly processing = signal(false);
  protected readonly error = signal('');
  protected readonly methods = [
    { id: 'Cash', icon: 'cash', hint: 'Paid in person' },
    { id: 'UPI', icon: 'bolt', hint: 'Instant' },
    { id: 'Bank Transfer', icon: 'bank', hint: 'NEFT / IMPS' },
    { id: 'Cheque', icon: 'file', hint: 'Bank cheque' },
  ];

  protected readonly members = computed(() => (this.groupId() ? this.store.groupMembers(this.groupId()) : []));
  /** installments of the chosen member in the chosen group that still have a balance */
  protected readonly dues = computed(() =>
    this.store.payments()
      .filter((p) => p.type === 'Installment' && p.groupId === this.groupId() && p.memberId === this.memberId() && outstandingOf(p) > 0)
      .sort((a, b) => a.monthIndex - b.monthIndex),
  );
  protected readonly payment = computed(() => this.store.payments().find((p) => p.id === this.paymentId()));
  protected readonly balance = computed(() => (this.payment() ? outstandingOf(this.payment()!) : 0));
  protected readonly isPart = computed(() => !!this.amount() && this.amount() < this.balance());

  constructor() {
    // pre-select from ?id=
    effect(() => {
      const p = this.store.payments().find((x) => x.id === Number(this.id() || 0));
      if (p) untracked(() => { this.groupId.set(p.groupId); this.memberId.set(p.memberId); this.pick(p.id); });
    });
  }

  protected pickGroup(v: string): void {
    this.groupId.set(+v); this.memberId.set(0); this.paymentId.set(0); this.amount.set(0);
  }
  protected pickMember(v: string): void {
    this.memberId.set(+v); this.paymentId.set(0); this.amount.set(0);
    const first = this.dues()[0];
    if (first) this.pick(first.id);
  }
  protected pick(id: number): void {
    this.paymentId.set(id);
    const p = this.store.payments().find((x) => x.id === id);
    this.amount.set(p ? outstandingOf(p) : 0);
  }
  protected label(id: number): string {
    const p = this.store.payments().find((x) => x.id === id);
    return p ? `Month ${p.monthIndex} • due ${fmtDate(p.dueDate)} • ${effStatus(p)}` : '';
  }
  protected paid = paidOf;

  protected pay(): void {
    const p = this.payment();
    const amt = Number(this.amount());
    if (!p) { this.error.set('Pick a group, a member and the installment.'); return; }
    if (!amt || amt <= 0) { this.error.set('Enter the amount received.'); return; }
    if (amt > this.balance() + 0.009) { this.error.set(`Amount can't be more than the balance (₹${this.balance()}).`); return; }
    this.error.set('');
    this.processing.set(true);
    this.store.recordPayment(p.id, { amount: amt, method: this.method(), paidDate: this.paidDate() }).subscribe({
      next: () => this.router.navigate(['/payments/receipt'], { queryParams: { id: p.id } }),
      error: (e) => { this.processing.set(false); this.error.set(errMsg(e, 'Could not save this payment.')); },
    });
  }
}
