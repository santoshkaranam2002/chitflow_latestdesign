import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { fmtDate, outstandingOf, paidOf } from '../../core/ledger';
import { LabelValue } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { Confetti } from '../../shared/confetti/confetti';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';

/** Receipt for one payment record (?id=). */
@Component({
  selector: 'app-payment-receipt',
  imports: [DatePipe, RouterLink, Confetti, CountUp, EmptyState, Icon, PageHeader],
  templateUrl: './payment-receipt.html',
  styleUrl: './payment-receipt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceipt {
  private readonly store = inject(DataStore);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  protected readonly receipt = computed(() => this.store.payments().find((p) => p.id === Number(this.id() || 0)));
  protected readonly member = computed(() => this.store.member(this.receipt()?.memberId ?? 0));
  protected readonly group = computed(() => this.store.group(this.receipt()?.groupId ?? 0));
  protected readonly received = computed(() => (this.receipt() ? paidOf(this.receipt()!) : 0));
  protected readonly balance = computed(() => (this.receipt() ? outstandingOf(this.receipt()!) : 0));
  protected readonly full = computed(() => this.balance() <= 0);

  protected readonly rows = computed<LabelValue[]>(() => {
    const r = this.receipt();
    if (!r) return [];
    const f = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    return [
      { label: 'Member', value: this.member()?.name ?? `#${r.memberId}` },
      { label: 'Group', value: this.group()?.name ?? `#${r.groupId}` },
      { label: 'Type', value: r.type === 'Installment' ? `Installment • Month ${r.monthIndex}` : `Winner payout • Month ${r.monthIndex}` },
      { label: 'Installment amount', value: f(r.amount) },
      { label: 'Balance', value: f(this.balance()) },
      { label: 'Due date', value: fmtDate(r.dueDate) || '—' },
      { label: 'Method', value: r.method || '—' },
      { label: 'Transaction ID', value: r.transactionId || '—' },
      { label: 'Status', value: this.full() ? 'Paid' : this.received() > 0 ? 'Part paid' : 'Pending' },
    ];
  });

  protected print(): void {
    window.print();
  }
  protected async share(): Promise<void> {
    const r = this.receipt();
    if (!r) return;
    const text = `ChitFlow receipt – ₹${this.received().toLocaleString('en-IN')} received from ${this.member()?.name ?? 'member'} for ${this.group()?.name ?? 'group'} (Month ${r.monthIndex}${r.transactionId ? ', Txn ' + r.transactionId : ''})`;
    try {
      if (navigator.share) { await navigator.share({ title: 'ChitFlow receipt', text }); return; }
      await navigator.clipboard.writeText(text);
      this.toast.show('Receipt details copied', 'success', 'copy');
    } catch {
      this.toast.show('Could not share the receipt', 'info', 'share');
    }
  }
}
