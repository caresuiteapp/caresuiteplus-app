/** Lets the active web page veto the shared Back/Close controls before history changes. */
export const WEB_PAGE_LEAVE_EVENT = 'caresuite:before-page-leave';

export function canLeaveWebPage(): boolean {
  if (typeof window === 'undefined') return true;
  return window.dispatchEvent(new Event(WEB_PAGE_LEAVE_EVENT, { cancelable: true }));
}
