import { Injectable, signal, computed, inject } from '@angular/core';
import { EMPTY, Observable, catchError, forkJoin, map, tap, timeout } from 'rxjs';
import { ChitApi } from './chit-api';
import { paidOf } from './ledger';
import { Session } from './session';

// ============================================================
// DOMAIN MODELS
// Field names mirror the Django/Mongo API responses 1:1 (camelCase),
// so no mapping layer is needed between backend and frontend.
// ============================================================

export type GroupStatus = 'Active' | 'Upcoming' | 'Completed';
export type MemberStatus = 'Active' | 'Inactive' | 'Completed' | 'Suspended';
export type AuctionStatus = 'Upcoming' | 'Live' | 'Pending Confirmation' | 'Completed';
export type PaymentStatus = 'Paid' | 'Pending' | 'Partial' | 'Overdue';
export type PaymentType = 'Installment' | 'Winner Payout';
export type CommissionType = 'Fixed' | 'Percent';

export interface ChitGroup {
  id: number;
  name: string;
  chitValue: number;
  totalMembers: number;
  durationMonths: number;
  monthlyInstallment: number;
  auctionDay: number;
  startDate: string;
  status: GroupStatus;
  currentMonth: number;
  startingBid: number;
  minBid: number;
  maxBid: number;
  bidIncrement: number;
  commissionType: CommissionType;
  commissionValue: number;
  foreman: string;
  adminId: number;
  memberCount?: number;
}

export interface Member {
  id: number;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  initials: string;
  photo?: string;
  joinDate: string;
  status: MemberStatus;
  groupIds: number[];
  nominee: string;
  bankAccount: string;
  adminId: number;
}

export type MembershipStatus = 'Active' | 'Left' | 'Completed';

export interface GroupMembership {
  id?: number;
  groupId: number;
  memberId: number;
  chitNumber: number;
  joinedOn?: string;          // YYYY-MM-DD ('' = not recorded)
  status?: MembershipStatus;
  leftOn?: string;
  leaveReason?: string;
  createdOn?: string;
}

export interface Auction {
  id: number;
  groupId: number;
  monthIndex: number;
  label: string;
  status: AuctionStatus;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  startingBid: number;
  bidIncrement: number;
  winnerMemberId?: number;
  winningBid?: number;
  prizeAmount?: number;
  commission?: number;
  dividendPerMember?: number;
  finalInstallment?: number;
  confirmed?: boolean;
}

export interface Bid {
  id: number;
  auctionId: number;
  memberId: number;
  memberName: string;
  amount: number;
  time: string;
}

export interface Payment {
  id: number;
  groupId: number;
  memberId: number;
  monthIndex: number;
  type: PaymentType;
  amount: number;
  paidAmount?: number;        // amount actually received (supports part payments)
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  method?: string;
  transactionId?: string;
}

export interface Dividend {
  id: number;
  groupId: number;
  monthIndex: number;
  auctionId: number;
  perMember: number;
  totalPool: number;
  eligibleMembers: number;
}

export type NotifType = 'auction' | 'payment' | 'dividend' | 'result' | 'system';

export interface AppNotification {
  id: number;
  audience: 'admin' | 'member';
  memberId?: number;
  groupId?: number;
  title: string;
  message: string;
  type: NotifType;
  time: string;
  read: boolean;
}

// ============================================================
// STORE — thin reactive cache over the Django/MongoDB API.
// Signals start empty; each page loads what it needs in ngOnInit()
// via the load* methods below, which call ChitApi and populate the
// matching signal. Lookup helpers (group(), groupMembers(), ...) then
// just read whatever is currently loaded — no dummy data anywhere.
// ============================================================

const CACHE_KEY = 'chitflow_cache_';

@Injectable({ providedIn: 'root' })
export class DataStore {
  private api = inject(ChitApi);
  private session = inject(Session);

  groups = signal<ChitGroup[]>([]);
  members = signal<Member[]>([]);
  memberships = signal<GroupMembership[]>([]);
  auctions = signal<Auction[]>([]);
  bids = signal<Bid[]>([]);
  payments = signal<Payment[]>([]);
  dividends = signal<Dividend[]>([]);
  notifications = signal<AppNotification[]>([]);

  /** Number of unread notifications for whoever is signed in (the store only ever holds their list). */
  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  /** Clears everything (used on logout so the next user never sees old data). */
  reset() {
    this.groups.set([]); this.members.set([]); this.memberships.set([]); this.auctions.set([]);
    this.bids.set([]); this.payments.set([]); this.dividends.set([]); this.notifications.set([]);
    this.loaded.set(false);
  }

  // ────────────────────── loaders ──────────────────────
  loadGroups(params: { adminId?: number | string; status?: string } = {}): Observable<ChitGroup[]> {
    return this.api.getGroups(params).pipe(tap(rows => this.groups.set(rows)));
  }
  loadMembers(params: { adminId?: number | string; groupId?: number | string; q?: string } = {}): Observable<Member[]> {
    return this.api.getMembers(params).pipe(tap(rows => this.members.set(rows)));
  }
  /** Fetches one member by id and upserts it into the members signal — used
   * by the member's own Profile page, which isn't covered by the member's
   * bulk load (that only pulls groups/auctions/payments/dividends). */
  loadMemberById(id: number | string): Observable<Member | undefined> {
    return this.api.getMemberById(id).pipe(
      tap(rows => {
        const m = rows[0];
        if (m) this.members.update(l => l.some(x => x.id === m.id) ? l.map(x => x.id === m.id ? m : x) : [...l, m]);
      }),
      map(rows => rows[0])
    );
  }
  loadMemberships(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string } = {}): Observable<GroupMembership[]> {
    return this.api.getMemberships(params).pipe(tap(rows => this.memberships.set(rows)));
  }
  loadAuctions(params: { groupId?: number | string; status?: string; adminId?: number | string; memberId?: number | string } = {}): Observable<Auction[]> {
    return this.api.getAuctions(params).pipe(tap(rows => this.auctions.set(rows)));
  }
  loadBids(auctionId: number | string): Observable<Bid[]> {
    return this.api.getBids(auctionId).pipe(tap(rows => this.bids.set(rows)));
  }
  loadPayments(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string; status?: string } = {}): Observable<Payment[]> {
    return this.api.getPayments(params).pipe(tap(rows => this.payments.set(rows)));
  }
  loadDividends(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string } = {}): Observable<Dividend[]> {
    return this.api.getDividends(params).pipe(tap(rows => this.dividends.set(rows)));
  }
  loadNotifications(params: { audience: 'admin' | 'member'; adminId?: number | string; memberId?: number | string }): Observable<AppNotification[]> {
    return this.api.getNotifications(params).pipe(tap(rows => this.notifications.set(rows)));
  }

  /** True once real data (cached or fresh) is in the store. */
  loaded = signal(false);

  /**
   * One request fills every list. The result is also saved on this device, so the next visit opens
   * instantly from the saved copy while the fresh copy loads quietly behind it.
   */
  loadBootstrap(userId: number): Observable<void> {
    return this.api.getBootstrap().pipe(
      timeout(30000),
      map(d => {
        this.groups.set(d.groups); this.members.set(d.members); this.memberships.set(d.memberships);
        this.auctions.set(d.auctions); this.payments.set(d.payments); this.dividends.set(d.dividends);
        this.notifications.set(d.notifications);
        this.loaded.set(true);
        try { localStorage.setItem(CACHE_KEY + userId, JSON.stringify(d)); } catch { /* storage full or blocked */ }
      })
    );
  }

  /** Fills the store from the copy saved on this device. Returns false when there is none. */
  hydrate(userId: number): boolean {
    try {
      const raw = localStorage.getItem(CACHE_KEY + userId);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.groups.set(d.groups ?? []); this.members.set(d.members ?? []); this.memberships.set(d.memberships ?? []);
      this.auctions.set(d.auctions ?? []); this.payments.set(d.payments ?? []); this.dividends.set(d.dividends ?? []);
      this.notifications.set(d.notifications ?? []);
      this.loaded.set(true);
      return true;
    } catch { return false; }
  }

  /** Forgets the saved copy (logout). */
  clearCache(userId: number) {
    try { localStorage.removeItem(CACHE_KEY + userId); } catch { /* ignore */ }
  }

  // ────────────────────── lookups ──────────────────────
  group(id: number | string) { return this.groups().find(g => g.id === Number(id)); }
  member(id: number | string) { return this.members().find(m => m.id === Number(id)); }
  auction(id: number | string) { return this.auctions().find(a => a.id === Number(id)); }

  groupMembers(groupId: number | string): Member[] {
    const ids = new Set(this.memberships().filter(m => m.groupId === Number(groupId)).map(m => m.memberId));
    return this.members().filter(m => ids.has(m.id));
  }
  memberGroups(memberId: number | string): ChitGroup[] {
    const ids = new Set(this.memberships().filter(m => m.memberId === Number(memberId)).map(m => m.groupId));
    return this.groups().filter(g => ids.has(g.id));
  }
  chitNumber(groupId: number | string, memberId: number | string) {
    return this.memberships().find(m => m.groupId === Number(groupId) && m.memberId === Number(memberId))?.chitNumber;
  }
  groupAuctions(groupId: number | string) {
    return this.auctions().filter(a => a.groupId === Number(groupId)).sort((a, b) => a.monthIndex - b.monthIndex);
  }
  auctionBids(auctionId: number | string) {
    return this.bids().filter(b => b.auctionId === Number(auctionId)).sort((a, b) => b.amount - a.amount);
  }
  memberPayments(memberId: number | string) {
    return this.payments().filter(p => p.memberId === Number(memberId)).sort((a, b) => b.monthIndex - a.monthIndex);
  }
  groupPayments(groupId: number | string) { return this.payments().filter(p => p.groupId === Number(groupId)); }
  memberAuctionRows(memberId: number | string) {
    const groupIds = new Set(this.memberships().filter(m => m.memberId === Number(memberId)).map(m => m.groupId));
    return this.auctions().filter(a => groupIds.has(a.groupId));
  }

  // ────────────────────── computed KPIs (over whatever is loaded) ──────────────────────
  totalCollected = computed(() => this.payments().filter(p => p.type === 'Installment').reduce((s, p) => s + paidOf(p), 0));
  totalPayout = computed(() => this.payments().filter(p => p.type === 'Winner Payout').reduce((s, p) => s + p.amount, 0));
  pendingCount = computed(() => this.payments().filter(p => p.status === 'Pending' || p.status === 'Overdue').length);
  activeGroupsCount = computed(() => this.groups().filter(g => g.status === 'Active').length);

  // ────────────────────── mutations (call API, then patch the cache) ──────────────────────

  createGroup(payload: any): Observable<ChitGroup> {
    return this.api.createGroup(payload).pipe(tap(g => this.groups.update(l => [g, ...l])));
  }
  updateGroup(id: number, payload: any): Observable<ChitGroup> {
    return this.api.updateGroup(id, payload).pipe(tap(g => this.groups.update(l => l.map(x => x.id === g.id ? g : x))));
  }
  deleteGroup(id: number): Observable<any> {
    return this.api.deleteGroup(id).pipe(tap(() => {
      this.groups.update(l => l.filter(x => x.id !== id));
      this.memberships.update(l => l.filter(x => x.groupId !== id));
    }));
  }

  createMember(payload: any): Observable<Member & { loginEmail?: string; loginPassword?: string; assignedGroupId?: number; assignedChitNumber?: number }> {
    return this.api.createMember(payload).pipe(tap((m: any) => {
      this.members.update(l => [m, ...l]);
      if (m.assignedMembership) {
        this.memberships.update(l => [...l, m.assignedMembership]);
      } else if (m.assignedGroupId) {
        this.memberships.update(l => [...l, { groupId: m.assignedGroupId, memberId: m.id, chitNumber: m.assignedChitNumber }]);
      }
    }));
  }
  /** change my own profile picture (admin or member) and refresh every place it is shown */
  savePhoto(photo: string): Observable<any> {
    return this.api.setPhoto(photo).pipe(tap(() => {
      this.session.setPhoto(photo);
      const mid = this.session.current().memberId;
      if (mid) this.members.update(l => l.map(x => x.id === mid ? { ...x, photo } : x));
    }));
  }
  updateMember(id: number, payload: any): Observable<Member> {
    return this.api.updateMember(id, payload).pipe(tap(m => this.members.update(l => l.map(x => x.id === m.id ? m : x))));
  }
  deleteMember(id: number): Observable<any> {
    return this.api.deleteMember(id).pipe(tap(() => {
      this.members.update(l => l.filter(x => x.id !== id));
      this.memberships.update(l => l.filter(x => x.memberId !== id));
    }));
  }

  assignMemberToGroup(payload: { memberId: number; groupId: number; chitNumber?: number }): Observable<GroupMembership> {
    return this.api.assignMemberToGroup(payload).pipe(tap(row => this.memberships.update(l => [...l, row])));
  }

  /** Mark a member as Left / Completed / Active in one group (keeps history). */
  updateMembership(id: number, payload: { status?: MembershipStatus; joinedOn?: string; leftOn?: string; leaveReason?: string; chitNumber?: number }): Observable<GroupMembership> {
    return this.api.updateMembership(id, payload).pipe(tap(row =>
      this.memberships.update(l => l.map(x => (x.id === row.id || (x.groupId === row.groupId && x.memberId === row.memberId)) ? row : x))
    ));
  }

  createAuction(payload: any): Observable<Auction> {
    return this.api.createAuction(payload).pipe(tap(a => this.auctions.update(l => [a, ...l])));
  }
  updateAuction(id: number, payload: any): Observable<Auction> {
    return this.api.updateAuction(id, payload).pipe(tap(a => this.patchAuction(a)));
  }
  deleteAuction(id: number): Observable<any> {
    return this.api.deleteAuction(id).pipe(tap(() => this.auctions.update(l => l.filter(x => x.id !== id))));
  }

  placeBid(auctionId: number, memberId: number, amount: number): Observable<Bid> {
    return this.api.placeBid({ auctionId, memberId, amount }).pipe(tap(b => this.bids.update(l => [...l, b])));
  }

  openAuction(auctionId: number): Observable<Auction> {
    return this.api.openAuction(auctionId).pipe(tap(a => this.patchAuction(a)));
  }
  closeAuction(auctionId: number): Observable<Auction> {
    return this.api.closeAuction(auctionId).pipe(tap(a => this.patchAuction(a)));
  }
  confirmAuction(auctionId: number): Observable<Auction> {
    return this.api.confirmAuction(auctionId).pipe(tap(a => this.patchAuction(a)));
  }
  private patchAuction(a: Auction) {
    this.auctions.update(l => l.some(x => x.id === a.id) ? l.map(x => x.id === a.id ? a : x) : [a, ...l]);
  }

  markPaymentPaid(id: number, method?: string): Observable<Payment> {
    return this.api.markPaymentPaid(id, method).pipe(tap(p =>
      this.payments.update(l => l.map(x => x.id === p.id ? p : x))
    ));
  }

  /** Record money received against one installment (full or part payment). */
  recordPayment(id: number, payload: { amount: number; method?: string; paidDate?: string }): Observable<Payment> {
    return this.api.recordPayment(id, payload).pipe(tap(p =>
      this.payments.update(l => l.map(x => x.id === p.id ? p : x))
    ));
  }

  markAllNotificationsRead() {
    this.notifications().filter(n => !n.read).forEach(n => this.markNotificationRead(n.id));
  }

  markNotificationRead(id: number) {
    this.notifications.update(l => l.map(n => n.id === id ? { ...n, read: true } : n));
    this.api.markNotificationRead(id).subscribe();
  }

  adminNotifications() { return this.notifications().filter(n => n.audience === 'admin'); }
  memberNotifications(memberId: number | string) { return this.notifications().filter(n => n.audience === 'member' && n.memberId === Number(memberId)); }
}
