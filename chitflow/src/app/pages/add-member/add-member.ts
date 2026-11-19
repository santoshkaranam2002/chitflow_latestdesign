import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataStore } from '../../core/data';
import { Session } from '../../core/session';
import { ToastService } from '../../core/services/toast.service';
import { initialsOf } from '../../core/utils/date.util';
import { errMsg } from '../../core/utils/view.util';
import { Avatar } from '../../shared/avatar/avatar';
import { PhotoPicker } from '../../shared/photo-picker/photo-picker';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-add-member',
  imports: [FormsModule, Avatar, Icon, PageHeader, PhotoPicker],
  templateUrl: './add-member.html',
  styleUrl: './add-member.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMember {
  private readonly router = inject(Router);
  protected readonly store = inject(DataStore);
  private readonly session = inject(Session);
  private readonly toast = inject(ToastService);

  /** ?groupId= – add straight into this group */
  readonly groupId = input<string>();

  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly name = signal('');
  protected readonly mobile = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly address = signal('');
  protected readonly nominee = signal('');
  protected readonly bank = signal('');
  protected readonly photo = signal('');
  protected readonly picked = signal<string>('');
  protected readonly chitNo = signal<number | null>(null);
  protected readonly existingId = signal<number | null>(null);
  protected readonly existingSearch = signal('');

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly created = signal<{ name: string; email: string; password: string } | null>(null);
  protected readonly copied = signal(false);

  protected readonly initials = computed(() => (this.name().trim() ? initialsOf(this.name()) : ''));
  protected readonly groupSel = computed(() => Number(this.picked() || this.groupId() || 0));
  protected readonly candidates = computed(() => {
    const gid = this.groupSel();
    const q = this.existingSearch().toLowerCase();
    const already = new Set(this.store.groupMembers(gid).map((m) => m.id));
    return this.store.members().filter((m) => !already.has(m.id) && (!q || m.name.toLowerCase().includes(q) || (m.phone || '').includes(q)));
  });

  protected createNew(): void {
    const name = this.name().trim();
    const phone = this.mobile().trim();
    const password = this.password().trim();
    if (!name || !phone) { this.error.set('Name and phone number are required.'); return; }
    if (password.length < 6) { this.error.set('Login password must be at least 6 characters.'); return; }
    this.error.set('');
    this.saving.set(true);
    const body: Record<string, unknown> = {
      name, phone, password, email: this.email().trim(), address: this.address().trim(), nominee: this.nominee().trim(),
      bankAccount: this.bank().trim(), photo: this.photo(), adminId: this.session.current().adminId ?? this.session.current().id,
    };
    if (this.groupSel()) {
      body['groupId'] = this.groupSel();
      if (this.chitNo()) body['chitNumber'] = this.chitNo();
    }
    this.store.createMember(body).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.created.set({ name: m.name, email: m.loginEmail || this.email().trim(), password: m.loginPassword || password });
      },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not add this member.')); },
    });
  }

  protected assignExisting(): void {
    if (!this.existingId() || !this.groupSel()) { this.error.set('Pick a group and a member to add.'); return; }
    this.error.set('');
    this.saving.set(true);
    this.store.assignMemberToGroup({ memberId: this.existingId()!, groupId: this.groupSel(), chitNumber: this.chitNo() ?? undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Member added to the group', 'success', 'user');
        this.router.navigate(['/groups/details'], { queryParams: { id: this.groupSel() } });
      },
      error: (e) => { this.saving.set(false); this.error.set(errMsg(e, 'Could not add this member to the group.')); },
    });
  }

  protected copyLogin(): void {
    const c = this.created();
    if (!c) return;
    navigator.clipboard?.writeText(`ChitFlow login\nEmail: ${c.email}\nPassword: ${c.password}`).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  protected done(): void {
    this.router.navigateByUrl(this.groupSel() ? `/groups/details?id=${this.groupSel()}` : '/members');
  }
}
