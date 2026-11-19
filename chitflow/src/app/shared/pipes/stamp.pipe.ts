import { Pipe, PipeTransform } from '@angular/core';

import { fmtStamp } from '../../core/utils/view.util';

/** '2026-11-19 10:41:07' -> '19 Nov, 10:41' */
@Pipe({ name: 'stamp' })
export class StampPipe implements PipeTransform {
  transform(value?: string | null): string { return fmtStamp(value); }
}
