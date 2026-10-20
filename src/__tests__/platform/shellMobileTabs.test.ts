import { describe, expect, it } from 'vitest';
import { BUSINESS_TABS, OFFICE_TABS } from '@/lib/navigation/shellConfig';
import {
  SHELL_MOBILE_PRIMARY_MAX,
  resolveCompactShellMobileTabs,
  shouldUseCompactMobileNav,
} from '@/lib/navigation/shellMobileTabs';

describe('resolveCompactShellMobileTabs', () => {
  it('returns four primary business tabs plus Mehr on phone', () => {
    const tabs = resolveCompactShellMobileTabs(BUSINESS_TABS, 'business');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.key)).toEqual([
      'index',
      'schedule',
      'clients',
      'employees',
      'more',
    ]);
    expect(tabs.some((tab) => tab.key === 'messages')).toBe(false);
  });

  it('returns four primary office tabs plus Mehr', () => {
    const tabs = resolveCompactShellMobileTabs(OFFICE_TABS, 'office');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.key)).toEqual([
      'index',
      'clients',
      'employees',
      'invoices',
      'more',
    ]);
  });

  it('shouldUseCompactMobileNav triggers only on phone with more than four tabs', () => {
    expect(shouldUseCompactMobileNav(BUSINESS_TABS.length, true)).toBe(true);
    expect(shouldUseCompactMobileNav(BUSINESS_TABS.length, false)).toBe(false);
    expect(shouldUseCompactMobileNav(SHELL_MOBILE_PRIMARY_MAX, true)).toBe(false);
  });
});
