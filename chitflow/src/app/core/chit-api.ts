import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

import { API_BASE_URL } from './api-config';

// ============================================================
// Django REST API client — talks to the ChitFlow backend
// (Django + Djongo/MongoDB). Every endpoint replies with the same
// envelope: { Message: "Successfull" | "Fail", Status: number, Result }.
// unwrap() turns that into a plain Observable<T> that throws when
// Message !== "Successfull", so callers can just .subscribe({ next, error }).
// ============================================================

export interface ApiEnvelope<T> {
  Message: string;
  Status: number;
  Result: T;
}

function toParams(obj: Record<string, any>): HttpParams {
  let params = new HttpParams();
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== '') {
      params = params.set(key, String(v));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class ChitApi {
  private baseUrl = API_BASE_URL;
  constructor(private http: HttpClient) {}

  private unwrap<T>(obs: Observable<ApiEnvelope<T>>): Observable<T> {
    return obs.pipe(
      map(res => {
        if (res.Message !== 'Successfull') {
          throw new Error(typeof res.Result === 'string' ? res.Result : 'Request failed. Please try again.');
        }
        return res.Result;
      }),
      // network / server errors -> a readable message instead of "Http failure response..."
      catchError(err => {
        if (err instanceof Error && !('status' in err)) return throwError(() => err);
        const body = err?.error;
        const msg = typeof body?.Result === 'string' ? body.Result
          : err?.status === 0 ? 'Could not reach the ChitFlow server. Please check your internet connection.'
          : 'Something went wrong on the server. Please try again.';
        return throwError(() => new Error(msg));
      })
    );
  }

  // ───────── Auth ─────────
  login(email: string, password: string, role: string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auth_login/`, { email, password, role }));
  }
  setPhoto(photo: string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/profile_photo/`, { photo }));
  }
  register(payload: { orgName: string; ownerName: string; email: string; phone: string; password: string; photo?: string }) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auth_signup/`, payload));
  }

  // ───────── Chit Groups ─────────
  getGroups(params: { adminId?: number | string; status?: string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/group_get/`, { params: toParams(params) }));
  }
  getGroup(id: number | string) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/group_get/${id}`));
  }
  createGroup(payload: any) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/group_create/`, payload));
  }
  updateGroup(id: number | string, payload: any) {
    return this.unwrap<any>(this.http.put<ApiEnvelope<any>>(`${this.baseUrl}/group_update/${id}`, payload));
  }
  deleteGroup(id: number | string) {
    return this.unwrap<any>(this.http.delete<ApiEnvelope<any>>(`${this.baseUrl}/group_delete/${id}`));
  }

  // ───────── Members ─────────
  getMembers(params: { adminId?: number | string; groupId?: number | string; q?: string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/member_get/`, { params: toParams(params) }));
  }
  getMemberById(id: number | string) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/member_get/${id}`));
  }
  createMember(payload: any) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/member_create/`, payload));
  }
  updateMember(id: number | string, payload: any) {
    return this.unwrap<any>(this.http.put<ApiEnvelope<any>>(`${this.baseUrl}/member_update/${id}`, payload));
  }
  deleteMember(id: number | string) {
    return this.unwrap<any>(this.http.delete<ApiEnvelope<any>>(`${this.baseUrl}/member_delete/${id}`));
  }
  assignMemberToGroup(payload: { memberId: number | string; groupId: number | string; chitNumber?: number }) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/member_assign_group/`, payload));
  }
  updateMembership(id: number | string, payload: any) {
    return this.unwrap<any>(this.http.put<ApiEnvelope<any>>(`${this.baseUrl}/membership_update/${id}`, payload));
  }
  getMemberships(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/membership_get/`, { params: toParams(params) }));
  }

  // ───────── Auctions ─────────
  getAuctions(params: { groupId?: number | string; status?: string; adminId?: number | string; memberId?: number | string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/auction_get/`, { params: toParams(params) }));
  }
  createAuction(payload: any) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auction_create/`, payload));
  }
  updateAuction(id: number | string, payload: any) {
    return this.unwrap<any>(this.http.put<ApiEnvelope<any>>(`${this.baseUrl}/auction_update/${id}`, payload));
  }
  deleteAuction(id: number | string) {
    return this.unwrap<any>(this.http.delete<ApiEnvelope<any>>(`${this.baseUrl}/auction_delete/${id}`));
  }
  openAuction(id: number | string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auction_open/${id}`, {}));
  }
  closeAuction(id: number | string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auction_close/${id}`, {}));
  }
  confirmAuction(id: number | string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/auction_confirm/${id}`, {}));
  }

  // ───────── Bids ─────────
  getBids(auctionId: number | string) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/bid_get/`, { params: toParams({ auctionId }) }));
  }
  placeBid(payload: { auctionId: number | string; memberId: number | string; amount: number }) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/bid_create/`, payload));
  }

  // ───────── Payments ─────────
  getPayments(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string; status?: string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/payment_get/`, { params: toParams(params) }));
  }
  markPaymentPaid(id: number | string, method?: string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/payment_mark_paid/${id}`, { method }));
  }
  recordPayment(id: number | string, payload: { amount: number; method?: string; paidDate?: string }) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/payment_record/${id}`, payload));
  }

  // ───────── Dividends ─────────
  getDividends(params: { adminId?: number | string; groupId?: number | string; memberId?: number | string } = {}) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/dividend_get/`, { params: toParams(params) }));
  }

  /** Everything the signed-in user's screens need, in one request. */
  getBootstrap() {
    return this.unwrap<any>(this.http.get<ApiEnvelope<any>>(`${this.baseUrl}/bootstrap_get/`));
  }

  // ───────── Activity log + reminders ─────────
  getAudit(adminId: number | string) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/audit_get/`, { params: toParams({ adminId }) }));
  }
  runReminders(adminId: number | string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/reminders_run/`, { adminId }));
  }

  // ───────── Notifications ─────────
  getNotifications(params: { audience: 'admin' | 'member'; adminId?: number | string; memberId?: number | string }) {
    return this.unwrap<any[]>(this.http.get<ApiEnvelope<any[]>>(`${this.baseUrl}/notification_get/`, { params: toParams(params) }));
  }
  markNotificationRead(id: number | string) {
    return this.unwrap<any>(this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/notification_read/${id}`, {}));
  }
}
