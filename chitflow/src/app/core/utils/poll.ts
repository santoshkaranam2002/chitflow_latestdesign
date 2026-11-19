import { DestroyRef } from '@angular/core';
import { Observable, catchError, EMPTY, exhaustMap, filter, timer } from 'rxjs';

/**
 * Calls `fetch` every `ms`, but only while the browser tab is visible, and never overlaps two
 * requests (a slow response simply delays the next one). Stops by itself when the page is destroyed.
 */
export function poll(destroyRef: DestroyRef, ms: number, fetch: () => Observable<unknown>): void {
  const sub = timer(ms, ms)
    .pipe(
      filter(() => typeof document === 'undefined' || !document.hidden),
      exhaustMap(() => fetch().pipe(catchError(() => EMPTY))),
    )
    .subscribe();
  destroyRef.onDestroy(() => sub.unsubscribe());
}
