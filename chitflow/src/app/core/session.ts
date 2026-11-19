import { Injectable, computed, signal } from '@angular/core';

export type Role = 'admin' | 'member';

export interface SessionUser {
  id: number;
  role: Role;
  name: string;
  initials: string;
  photo?: string;
  email: string;
  phone: string;
  orgName: string;
  memberId?: number | null;
  adminId?: number | null;
  token?: string;
}

const STORAGE_KEY = 'chitflow_session';

const GUEST: SessionUser = {
  id: 0, role: 'admin', name: '', initials: '?', email: '', phone: '', orgName: '',
};

// ── Real session store, backed by the Django auth API ──
// login()/register() are called by the auth pages after ChitApi returns a
// user; this service just holds the result in a signal and mirrors it to
// localStorage so a page refresh doesn't lose the session.
@Injectable({ providedIn: 'root' })
export class Session {
  private user = signal<SessionUser | null>(this.restore());

  isAuthed = computed(() => this.user() !== null);
  current = computed(() => this.user() ?? GUEST);
  role = computed(() => this.current().role);
  isAdmin = computed(() => this.user()?.role === 'admin');
  isMember = computed(() => this.user()?.role === 'member');

  // The login is kept only for this browser tab (sessionStorage): a refresh keeps you signed in,
  // but opening the app again in a new tab / after closing the browser starts at the login page.
  private restore(): SessionUser | null {
    let found: SessionUser | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      found = raw ? JSON.parse(raw) : null;
    } catch { /* storage blocked */ }
    try {
      localStorage.removeItem(STORAGE_KEY); // old versions saved the login here
      if (!found) Object.keys(localStorage).filter((k) => k.startsWith('chitflow_cache_')).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage blocked */ }
    return found;
  }

  setUser(apiUser: any) {
    const u: SessionUser = {
      id: apiUser.id,
      role: apiUser.role,
      name: apiUser.name || (apiUser.role === 'admin' ? 'Organizer' : 'Member'),
      initials: apiUser.initials || '?',
      photo: apiUser.photo || '',
      email: apiUser.email || '',
      phone: apiUser.phone || '',
      orgName: apiUser.orgName || '',
      memberId: apiUser.memberId ?? null,
      adminId: apiUser.adminId ?? null,
      token: apiUser.token || '',
    };
    this.user.set(u);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch { /* storage blocked */ }
  }

  /** change the saved picture of the logged-in person (after they updated it) */
  setPhoto(photo: string) {
    const u = this.user();
    if (!u) return;
    const next = { ...u, photo };
    this.user.set(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }

  token(): string { return this.user()?.token ?? ''; }

  homePath(): string { return this.user()?.role === 'member' ? '/member/dashboard' : '/home'; }

  logout() {
    this.user.set(null);
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('chitflow_cache_')).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage blocked */ }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
  }
}
