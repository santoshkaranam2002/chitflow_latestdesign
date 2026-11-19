import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Round profile picture. Shows the photo when there is one, otherwise the person's initials. */
@Component({
  selector: 'app-avatar',
  template: `<span class="avatar" [class.avatar--sm]="size() === 'sm'" [class.avatar--lg]="size() === 'lg'"
      [class.avatar--xl]="size() === 'xl'" [class.avatar--primary]="primary() && !photo()"
      [style.background]="photo() ? null : color() || null">
      @if (photo()) { <img [src]="photo()" alt="" loading="lazy" /> } @else { {{ initials() }} }
    </span>`,
  styles: [`:host { display: inline-flex; flex: none; } :host(.block) { display: flex; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly photo = input<string | null | undefined>('');
  readonly initials = input<string>('?');
  readonly size = input<'md' | 'sm' | 'lg' | 'xl'>('md');
  readonly color = input<string>('');
  readonly primary = input<boolean>(false);
}
