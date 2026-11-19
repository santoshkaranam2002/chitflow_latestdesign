import { FaqItem, NavItem } from '../models';

/** Static app content (menus, help text, default preferences) – no business data lives here. */

export const NAV_ITEMS: NavItem[] = [
  { path: '/home', icon: 'home', label: 'Home' },
  { path: '/groups', icon: 'users', label: 'Groups' },
  { path: '/payments', icon: 'card', label: 'Payments' },
  { path: '/reports', icon: 'bar', label: 'Reports' },
];

export const DRAWER_MENU: NavItem[] = [
  { path: '/home', icon: 'grid', label: 'Dashboard' },
  { path: '/groups', icon: 'users', label: 'Chit Groups' },
  { path: '/members', icon: 'user', label: 'Members' },
  { path: '/auctions', icon: 'gavel', label: 'Auctions' },
  { path: '/payments', icon: 'card', label: 'Payments' },
  { path: '/dividends', icon: 'coin', label: 'Dividends' },
  { path: '/defaulters', icon: 'alert', label: 'Defaulters' },
  { path: '/reports', icon: 'bar', label: 'Reports' },
  { path: '/notifications', icon: 'bell', label: 'Notifications', badge: 'unread' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
  { path: '/help', icon: 'help', label: 'Help & Support' },
];

export const FAQS: FaqItem[] = [
  { question: 'How do I add a member to a group?', answer: 'Open Members, tap + and fill in the details. Pick a group to add them straight into it. A login email and password are created for the member.' },
  { question: 'How is the auction winner decided?', answer: 'The member with the highest bid when the auction is closed wins. The organizer then confirms the result, which creates the payout, dividend and the next installments.' },
  { question: 'How do I record a payment?', answer: 'Open Payments, find the installment and tap Record. You can save a full or a part payment; the balance stays pending.' },
  { question: 'How is dividend calculated?', answer: 'Winning bid minus the organizer commission, divided equally among the members. It is shown in Dividends.' },
];
