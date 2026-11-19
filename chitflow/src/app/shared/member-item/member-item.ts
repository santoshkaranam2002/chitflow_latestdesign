import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataStore, Member } from '../../core/data';
import { overallStatus } from '../../core/ledger';
import { avatarColor, payPill } from '../../core/utils/view.util';
import { Avatar } from '../avatar/avatar';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-member-item',
  imports: [NgClass, RouterLink, Avatar, Icon],
  templateUrl: './member-item.html',
  styleUrl: './member-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberItem {
  private readonly store = inject(DataStore);

  readonly member = input.required<Member>();

  protected readonly color = computed(() => avatarColor(this.member().id));
  /** overall payment standing across every group of this member */
  protected readonly status = computed(() =>
    overallStatus(this.store.memberPayments(this.member().id).filter((p) => p.type === 'Installment')),
  );
  protected readonly pill = computed(() => payPill(this.status()));
}
