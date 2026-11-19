import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore } from '../../core/data';
import { MONTH_NAMES, paidOf, round2 } from '../../core/ledger';
import { TabOption } from '../../core/models';
import { CountUp } from '../../shared/count-up/count-up';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ProgressRing } from '../../shared/progress-ring/progress-ring';
import { Tabs } from '../../shared/tabs/tabs';

@Component({
  selector: 'app-reports',
  imports: [RouterLink, CountUp, Icon, PageHeader, InrPipe, ProgressRing, Tabs],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports {
  private readonly store = inject(DataStore);

  protected readonly period = signal<string>('1Y');
  protected readonly selected = signal<number | null>(null);
  protected readonly tabs: TabOption[] = [
    { id: '3M', label: 'Last 3 Months' },
    { id: '6M', label: 'Last 6 Months' },
    { id: '1Y', label: '1 Year' },
  ];
  protected readonly links = [
    { id: 'insights', title: 'Group Insights', hint: 'Month-wise collection & payment matrix', icon: 'bar' },
    { id: 'group', title: 'Group Wise Summary', hint: 'Compare every chit group', icon: 'users' },
    { id: 'member', title: 'Member Wise Summary', hint: 'Paid, pending & auctions per member', icon: 'user' },
    { id: 'auction', title: 'Auction Report', hint: 'Winners, prizes & dividends', icon: 'gavel' },
  ];

  private monthsBack(): number { return this.period() === '3M' ? 3 : this.period() === '6M' ? 6 : 12; }
  private key(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

  /** one bar per calendar month in the period (by installment due month) */
  protected readonly points = computed(() => {
    const n = this.monthsBack();
    const now = new Date();
    const keys: { key: string; label: string }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push({ key: this.key(d), label: MONTH_NAMES[d.getMonth()] });
    }
    const inst = this.store.payments().filter((p) => p.type === 'Installment');
    const rows = keys.map((k) => {
      const month = inst.filter((p) => (p.dueDate || '').startsWith(k.key));
      return { label: k.label, collected: round2(month.reduce((s, p) => s + paidOf(p), 0)), billed: round2(month.reduce((s, p) => s + (p.amount || 0), 0)) };
    });
    const max = Math.max(1, ...rows.map((r) => r.collected));
    return rows.map((r) => ({ ...r, h: Math.max(2, (r.collected / max) * 110) }));
  });

  protected readonly collected = computed(() => round2(this.points().reduce((s, r) => s + r.collected, 0)));
  protected readonly billed = computed(() => round2(this.points().reduce((s, r) => s + r.billed, 0)));
  protected readonly pending = computed(() => round2(Math.max(0, this.billed() - this.collected())));
  protected readonly rate = computed(() => (this.billed() ? Math.round((this.collected() / this.billed()) * 100) : 0));

  /** change vs the previous period of the same length */
  protected readonly change = computed(() => {
    const n = this.monthsBack();
    const now = new Date();
    const keys = new Set<string>();
    for (let i = 2 * n - 1; i >= n; i--) keys.add(this.key(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const prev = this.store.payments().filter((p) => p.type === 'Installment' && keys.has((p.dueDate || '').slice(0, 7))).reduce((s, p) => s + paidOf(p), 0);
    return prev > 0 ? Math.round(((this.collected() - prev) / prev) * 100) : null;
  });

  protected pick(i: number): void {
    this.selected.set(this.selected() === i ? null : i);
  }
}
