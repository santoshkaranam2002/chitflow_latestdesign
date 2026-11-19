import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../../core/data';
import { downloadCsv, effStatus, fmtDate, outstandingOf, paidOf, round2, summarize } from '../../../core/ledger';
import { Session } from '../../../core/session';
import { TabOption } from '../../../core/models';
import { payPill } from '../../../core/utils/view.util';
import { CountUp } from '../../../shared/count-up/count-up';
import { EmptyState } from '../../../shared/empty-state/empty-state';
import { Icon } from '../../../shared/icon/icon';
import { IconTile } from '../../../shared/icon-tile/icon-tile';
import { PageHeader } from '../../../shared/page-header/page-header';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { Tabs } from '../../../shared/tabs/tabs';

@Component({
  selector: 'app-member-payments',
  imports: [DatePipe, RouterLink, CountUp, EmptyState, Icon, IconTile, InrPipe, PageHeader, Tabs],
  templateUrl: './member-payments.html',
  styleUrl: './member-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberPayments {
  /** long lists show 30 rows at a time */
  protected readonly limit = signal(30);
  protected more(): void { this.limit.update((n) => n + 30); }
  private readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly memberId = computed(() => this.session.current().memberId ?? 0);

  protected readonly groups = computed(() => this.store.memberGroups(this.memberId()));
  protected readonly groupFilter = signal<'all' | number>('all');
  protected readonly status = signal('all');

  private readonly installments = computed(() => this.store.memberPayments(this.memberId()).filter((p) => p.type === 'Installment'));
  private readonly byGroup = computed(() => this.installments().filter((p) => this.groupFilter() === 'all' || p.groupId === this.groupFilter()));

  protected readonly tabs = computed<TabOption[]>(() => {
    const list = this.byGroup();
    const n = (s: string) => list.filter((p) => effStatus(p) === s).length;
    return [
      { id: 'all', label: 'All', count: list.length },
      { id: 'Paid', label: 'Paid', count: n('Paid') },
      { id: 'Pending', label: 'Pending', count: n('Pending') + n('Partial') },
      { id: 'Overdue', label: 'Overdue', count: n('Overdue') },
    ];
  });

  protected readonly rows = computed(() =>
    this.byGroup().filter((p) => {
      const s = effStatus(p);
      return this.status() === 'all' || s === this.status() || (this.status() === 'Pending' && s === 'Partial');
    }),
  );
  protected readonly paidTotal = computed(() => round2(this.byGroup().reduce((s, p) => s + paidOf(p), 0)));
  protected readonly dueTotal = computed(() => round2(this.byGroup().reduce((s, p) => s + outstandingOf(p), 0)));

  /** per-group ledger: paid / pending / remaining months */
  protected readonly summaries = computed(() => {
    const m = this.store.member(this.memberId());
    if (!m) return [];
    return this.groups()
      .filter((g) => this.groupFilter() === 'all' || g.id === this.groupFilter())
      .map((g) => summarize(m, g, this.store.memberships().find((x) => x.groupId === g.id && x.memberId === m.id), this.store.memberPayments(m.id)));
  });

  protected st = effStatus;
  protected paid = paidOf;
  protected bal = outstandingOf;
  protected fmt = fmtDate;
  protected pillOf = payPill;
  protected groupName(id: number): string { return this.store.group(id)?.name ?? ''; }

  protected print(): void { window.print(); }

  protected exportCsv(): void {
    downloadCsv('my-payments.csv', [
      ['Group', 'Month', 'Due date', 'Amount', 'Paid', 'Status', 'Paid on', 'Method', 'Transaction'],
      ...this.rows().map((p) => [this.groupName(p.groupId), p.monthIndex, p.dueDate, p.amount, paidOf(p), effStatus(p), p.paidDate ?? '', p.method ?? '', p.transactionId ?? '']),
    ]);
  }
}
