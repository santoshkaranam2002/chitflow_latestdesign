import { Routes } from '@angular/router';

import { adminGuard, guestGuard, memberGuard } from './core/guards/role.guard';

/**
 * Every page is lazy loaded and lives in its own folder (page .ts / .html / .scss).
 * Query params (e.g. /groups/details?id=g1) are bound to the page's signal inputs.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // ---- public screens ----
  { path: 'login', canActivate: [guestGuard], title: 'Login • ChitFlow', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'register', canActivate: [guestGuard], title: 'Create account • ChitFlow', loadComponent: () => import('./pages/register/register').then((m) => m.Register) },

  // ---- signed-in screens (bottom navigation + drawer) ----
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: 'home', title: 'Home • ChitFlow', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },

      { path: 'groups', title: 'Chit Groups • ChitFlow', loadComponent: () => import('./pages/groups/groups').then((m) => m.Groups) },
      { path: 'groups/create', title: 'Create Group • ChitFlow', loadComponent: () => import('./pages/create-group/create-group').then((m) => m.CreateGroup) },
      { path: 'groups/details', title: 'Group Details • ChitFlow', loadComponent: () => import('./pages/group-details/group-details').then((m) => m.GroupDetails) },

      { path: 'members', title: 'Members • ChitFlow', loadComponent: () => import('./pages/members/members').then((m) => m.Members) },
      { path: 'members/add', title: 'Add Member • ChitFlow', loadComponent: () => import('./pages/add-member/add-member').then((m) => m.AddMember) },
      { path: 'members/details', title: 'Member Details • ChitFlow', loadComponent: () => import('./pages/member-details/member-details').then((m) => m.MemberDetails) },

      { path: 'payments', title: 'Payments • ChitFlow', loadComponent: () => import('./pages/payments/payments').then((m) => m.Payments) },
      { path: 'payments/make', title: 'Make Payment • ChitFlow', loadComponent: () => import('./pages/make-payment/make-payment').then((m) => m.MakePayment) },
      { path: 'payments/receipt', title: 'Receipt • ChitFlow', loadComponent: () => import('./pages/payment-receipt/payment-receipt').then((m) => m.PaymentReceipt) },

      { path: 'auctions', title: 'Auctions • ChitFlow', loadComponent: () => import('./pages/auctions/auctions').then((m) => m.Auctions) },
      { path: 'auctions/details', title: 'Auction Details • ChitFlow', loadComponent: () => import('./pages/auction-details/auction-details').then((m) => m.AuctionDetails) },
      { path: 'auctions/live', title: 'Live Auction • ChitFlow', loadComponent: () => import('./pages/live-auction/live-auction').then((m) => m.LiveAuction) },
      { path: 'auctions/add', title: 'Add Auction • ChitFlow', loadComponent: () => import('./pages/add-auction/add-auction').then((m) => m.AddAuction) },
      { path: 'auctions/result', title: 'Auction Result • ChitFlow', loadComponent: () => import('./pages/auction-result/auction-result').then((m) => m.AuctionResult) },

      { path: 'dividends', title: 'Dividends • ChitFlow', loadComponent: () => import('./pages/dividends/dividends').then((m) => m.Dividends) },
      { path: 'defaulters', title: 'Defaulters • ChitFlow', loadComponent: () => import('./pages/defaulters/defaulters').then((m) => m.Defaulters) },
      { path: 'activity', title: 'Activity Log • ChitFlow', loadComponent: () => import('./pages/activity/activity').then((m) => m.Activity) },
      { path: 'reports', title: 'Reports • ChitFlow', loadComponent: () => import('./pages/reports/reports').then((m) => m.Reports) },
      { path: 'reports/detail', title: 'Report • ChitFlow', loadComponent: () => import('./pages/report-detail/report-detail').then((m) => m.ReportDetail) },

      { path: 'notifications', title: 'Notifications • ChitFlow', loadComponent: () => import('./pages/notifications/notifications').then((m) => m.Notifications) },
      { path: 'profile', title: 'My Profile • ChitFlow', loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile) },
      { path: 'settings', title: 'Settings • ChitFlow', loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings) },
      { path: 'help', title: 'Help & Support • ChitFlow', loadComponent: () => import('./pages/help-support/help-support').then((m) => m.HelpSupport) },
    ],
  },

  // ---- MEMBER portal (separate layout, only for members) ----
  {
    path: 'member',
    canActivate: [memberGuard],
    loadComponent: () => import('./layout/member-shell/member-shell').then((m) => m.MemberShell),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', title: 'Dashboard • ChitFlow', loadComponent: () => import('./pages/member/member-dashboard/member-dashboard').then((m) => m.MemberDashboard) },
      { path: 'groups', title: 'My Groups • ChitFlow', loadComponent: () => import('./pages/member/member-groups/member-groups').then((m) => m.MemberGroups) },
      { path: 'groups/details', title: 'Group Details • ChitFlow', loadComponent: () => import('./pages/member/member-group-details/member-group-details').then((m) => m.MemberGroupDetails) },
      { path: 'auctions', title: 'Auctions • ChitFlow', loadComponent: () => import('./pages/member/member-auctions/member-auctions').then((m) => m.MemberAuctions) },
      { path: 'payments', title: 'Payment History • ChitFlow', loadComponent: () => import('./pages/member/member-payments/member-payments').then((m) => m.MemberPayments) },
      { path: 'notifications', title: 'Notifications • ChitFlow', loadComponent: () => import('./pages/notifications/notifications').then((m) => m.Notifications) },
      { path: 'dividends', title: 'Dividends • ChitFlow', loadComponent: () => import('./pages/member/member-dividends/member-dividends').then((m) => m.MemberDividends) },
      { path: 'profile', title: 'My Profile • ChitFlow', loadComponent: () => import('./pages/member/member-profile/member-profile').then((m) => m.MemberProfile) },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
