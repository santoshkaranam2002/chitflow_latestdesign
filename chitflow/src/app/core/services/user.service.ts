import { Injectable, signal } from '@angular/core';

import { FAQS } from '../data/app-content';
import { FaqItem } from '../models';

/** Device-level preferences only (help content, hide balance). */
@Injectable({ providedIn: 'root' })
export class UserService {
  readonly faqs: FaqItem[] = FAQS;
  /** Hide / show money on the dashboard */
  readonly balanceHidden = signal(false);
}
