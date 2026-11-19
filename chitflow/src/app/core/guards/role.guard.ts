import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Session } from '../session';

/** Admin screens: not signed in -> login, a member -> member dashboard. */
export const adminGuard: CanActivateFn = () => {
  const session = inject(Session);
  const router = inject(Router);
  if (!session.isAuthed()) return router.createUrlTree(['/login']);
  return session.isAdmin() ? true : router.createUrlTree(['/member/dashboard']);
};

/** Member screens: not signed in -> login, an admin -> admin home. */
export const memberGuard: CanActivateFn = () => {
  const session = inject(Session);
  const router = inject(Router);
  if (!session.isAuthed()) return router.createUrlTree(['/login']);
  return session.isMember() ? true : router.createUrlTree(['/home']);
};

/** Login / register: already signed in -> straight to your dashboard. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(Session);
  const router = inject(Router);
  if (!session.isAuthed()) return true;
  return router.createUrlTree([session.isAdmin() ? '/home' : '/member/dashboard']);
};
