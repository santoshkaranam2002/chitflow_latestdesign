import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, effect, inject, input, model, output, signal, viewChild } from '@angular/core';

import { fileToPhoto } from '../../core/utils/photo.util';
import { Avatar } from '../avatar/avatar';
import { Icon } from '../icon/icon';

/** Round photo with a camera button. Tap it → a sheet offers "Take photo", "Choose from gallery" and "Remove photo". */
@Component({
  selector: 'app-photo-picker',
  imports: [Avatar, Icon],
  template: `
    <div class="pp" [class.pp--compact]="compact()">
      <button class="pp__btn" type="button" (click)="open.set(true)" aria-label="Change photo">
        @if (!compact()) { <app-avatar [photo]="photo()" [initials]="initials()" size="xl" [primary]="true" /> }
        <span class="pp__cam" [class.pp__cam--solo]="compact()"><app-icon name="camera" [size]="15" /></span>
      </button>
      <input #cam type="file" accept="image/*" capture="user" hidden (change)="pick($event)" />
      <input #gal type="file" accept="image/*" hidden (change)="pick($event)" />
      @if (!compact()) {
        <div class="pp__text">
          <b>{{ label() }}</b>
          @if (error()) { <span class="pp__err">{{ error() }}</span> }
          @else { <span class="muted">Tap to add or change</span> }
        </div>
      }

      @if (open()) {
        <div #portal>
        <div class="pp__back" (click)="open.set(false)"></div>
        <div class="pp__sheet" role="dialog" aria-label="Profile photo">
          <i class="pp__grip"></i>
          <b class="pp__title">Profile photo</b>
          <button type="button" class="pp__opt" (click)="cam.click(); open.set(false)"><app-icon name="camera" [size]="20" /> Take photo</button>
          <button type="button" class="pp__opt" (click)="gal.click(); open.set(false)"><app-icon name="image" [size]="20" /> Choose from gallery</button>
          @if (photo()) { <button type="button" class="pp__opt pp__opt--del" (click)="remove(); open.set(false)"><app-icon name="trash" [size]="20" /> Remove photo</button> }
          <button type="button" class="pp__opt pp__opt--cancel" (click)="open.set(false)">Cancel</button>
        </div>
        </div>
      }
    </div>`,
  styles: [`
    .pp { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 6px 0 14px; text-align: center; }
    .pp--compact { margin: 0; gap: 0; }
    .pp__btn { position: relative; border-radius: 50%; padding: 0; background: none; transition: transform .2s; }
    .pp__btn:active { transform: scale(.95); }
    .pp__cam { position: absolute; right: -2px; bottom: 0; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
      background: #fff; color: var(--cf-primary, #f97316); box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .pp__cam--solo { position: static; width: 30px; height: 30px; background: #1f2937; color: #fff; border: 2px solid #fff; }
    .pp__text { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
    .pp__err { color: #dc2626; }
    .pp__back { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 1000; animation: ppfade .2s; }
    .pp__sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1001; margin: 0 auto; max-width: 480px; background: var(--cf-card, #fff);
      border-radius: 22px 22px 0 0; padding: 10px 16px calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 -10px 40px rgba(0,0,0,.25); animation: ppup .28s cubic-bezier(.2,.9,.3,1); text-align: left; }
    .pp__grip { align-self: center; width: 40px; height: 4px; border-radius: 4px; background: rgba(120,120,120,.35); margin-bottom: 4px; }
    .pp__title { font-size: 15px; margin: 2px 4px 4px; }
    .pp__opt { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 600;
      background: rgba(249,115,22,.08); color: var(--cf-primary, #f97316); }
    .pp__opt--del { background: rgba(220,38,38,.08); color: #dc2626; }
    .pp__opt--cancel { background: rgba(120,120,120,.12); color: inherit; justify-content: center; }
    @keyframes ppup { from { transform: translateY(100%); } to { transform: none; } }
    @keyframes ppfade { from { opacity: 0; } to { opacity: 1; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoPicker {
  readonly photo = model<string>('');
  readonly initials = input<string>('?');
  readonly label = input<string>('Profile photo');
  /** only a small camera button (no picture or text) */
  readonly compact = input<boolean>(false);
  /** fires after a new photo was chosen or removed (used by pages that save straight away) */
  readonly changed = output<string>();
  private readonly doc = inject(DOCUMENT);
  private readonly portal = viewChild<ElementRef<HTMLElement>>('portal');
  protected readonly open = signal(false);
  protected readonly error = signal('');

  constructor() {
    // the sheet is moved to <body> so it always sits above the bottom menu and page cards
    effect(() => {
      const el = this.portal()?.nativeElement;
      if (el) this.doc.body.appendChild(el);
    });
  }

  protected async pick(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    this.error.set('');
    try {
      const data = await fileToPhoto(f);
      this.photo.set(data);
      this.changed.emit(data);
    } catch (e) {
      this.error.set((e as Error).message || 'Could not use this photo.');
    }
  }

  protected remove(): void {
    this.photo.set('');
    this.changed.emit('');
  }
}
