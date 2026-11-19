import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore, Payment } from '../../core/data';
import { downloadCsv, effStatus, fmtDate, outstandingOf, round2, todayISO } from '../../core/ledger';
import { Session } from '../../core/session';
import { CountUp } from '../../shared/count-up/count-up';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Avatar } from '../../shared/avatar/avatar';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { RecordPayment } from '../../shared/record-payment/record-payment';
import { avatarColor } from '../../core/utils/view.util';

interface Defaulter {
  memberId: number; name: string; initials: string; photo: string; phone: string; groups: string[];
  months: number; amount: number; oldest: string; daysLate: number; firstPayment: Payment;
}

/** Members who are late with an installment: how much, how long, and one tap to remind or collect. */
@Component({
  selector: 'app-defaulters',
  imports: [DatePipe, RouterLink, Avatar, CountUp, EmptyState, Icon, InrPipe, PageHeader, RecordPayment],
  templateUrl: './defaulters.html',
  styleUrl: './defaulters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Defaulters {
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);

  protected readonly groupFilter = signal<'All' | number>('All');
  protected readonly recording = signal<Payment | null>(null);

  protected readonly rows = computed<Defaulter[]>(() => {
    const today = todayISO();
    const late = this.store.payments().filter((p) => p.type === 'Installment' && effStatus(p, today) === 'Overdue'
      && (this.groupFilter() === 'All' || p.groupId === this.groupFilter()));
    const by = new Map<number, Payment[]>();
    for (const p of late) by.set(p.memberId, [...(by.get(p.memberId) ?? []), p]);
    return [...by.entries()].map(([memberId, list]) => {
      const m = this.store.member(memberId);
      const sorted = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const oldest = sorted[0].dueDate;
      return {
        memberId, name: m?.name ?? 'Member', initials: m?.initials ?? '?', photo: m?.photo ?? '', phone: m?.phone ?? '',
        groups: [...new Set(list.map((p) => this.store.group(p.groupId)?.name ?? ''))],
        months: list.length, amount: round2(list.reduce((s, p) => s + outstandingOf(p), 0)),
        oldest, daysLate: Math.max(1, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400000)), firstPayment: sorted[0],
      };
    }).sort((a, b) => b.amount - a.amount);
  });
  protected readonly total = computed(() => round2(this.rows().reduce((s, r) => s + r.amount, 0)));
  protected readonly groups = this.store.groups;

  protected color = avatarColor;
  protected fmt = fmtDate;

  private phoneDigits(p: string): string {
    const d = (p || '').replace(/\D/g, '');
    return d.length === 10 ? '91' + d : d;
  }
  protected callHref(r: Defaulter): string { return 'tel:' + (r.phone || ''); }
  /** WhatsApp chat with a ready-made reminder message. */
  protected whatsappHref(r: Defaulter): string {
    const org = this.session.current().orgName || 'your chit organizer';
    const text = `Hello ${r.name}, this is a gentle reminder from ${org}. Your chit installment of ₹${r.amount.toLocaleString('en-IN')} (${r.groups.join(', ')}) was due on ${fmtDate(r.oldest)}. Please pay at the earliest. Thank you!`;
    return `https://wa.me/${this.phoneDigits(r.phone)}?text=${encodeURIComponent(text)}`;
  }

  protected exportCsv(): void {
    downloadCsv('defaulters.csv', [
      ['Member', 'Phone', 'Groups', 'Overdue months', 'Overdue amount', 'Oldest due date', 'Days late'],
      ...this.rows().map((r) => [r.name, r.phone, r.groups.join(' / '), r.months, r.amount, r.oldest, r.daysLate]),
    ]);
  }
}
