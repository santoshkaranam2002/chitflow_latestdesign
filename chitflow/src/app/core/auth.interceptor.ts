import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { DataStore } from './data';
import { Session } from './session';

/** Adds the login token to every API call, and sends the user back to login when the session has expired. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(Session);
  const store = inject(DataStore);
  const router = inject(Router);
  const token = session.token();
  const isAuthCall = /\/auth_(login|signup)\//.test(req.url);
  const authed = token && !isAuthCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthCall && session.isAuthed()) {
        session.logout();
        store.reset();
        router.navigate(['/login'], { queryParams: { expired: 1 } });
      }
      return throwError(() => err);
    }),
  );
};
