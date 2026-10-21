import { describe, expect, it } from 'vitest';
import { releasedLiquidPortalNavigation as webNavigation } from '@/liquid-command/navigation/portalCatalog.web';
import { releasedLiquidPortalNavigation as nativeNavigation } from '@/liquid-command/navigation/portalCatalog';
import { isAcademyOnlyPortal } from '@/lib/akademie/portalAccess.web';
import type { AuthSession, AuthUser } from '@/types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';

describe('academy web portal entry points', () => {
  it.each(['employee', 'client'] as const)('adds learning to %s without changing native menus', (kind) => {
    const academy = webNavigation(kind).find(item => item.id === 'academy');
    expect(academy?.route).toBe(`/portal/${kind}/akademie`);
    expect(academy?.compact).not.toBe(true);
    expect(nativeNavigation(kind).some(item => item.id === 'academy')).toBe(false);
    expect(webNavigation(kind).filter(item => item.id !== 'academy')).toEqual(nativeNavigation(kind));
  });

  it('keeps the existing private budget feature gate', () => {
    expect(webNavigation('client', null).some(item => item.id === 'budget')).toBe(false);
  });

  it('restricts family learning sessions even when their local portal cache is missing', () => {
    const accessToken = `header.${btoa(JSON.stringify({ app_metadata: { portal_type: 'academy_family' } }))}.signature`;
    expect(isAcademyOnlyPortal(null, { accessToken } as AuthSession)).toBe(true);
    expect(isAcademyOnlyPortal({ portalType: 'academy_family' } as PortalSessionRecord, null)).toBe(true);
    expect(isAcademyOnlyPortal({ accessScope: 'academy' } as PortalSessionRecord, null)).toBe(true);
    expect(isAcademyOnlyPortal(null, null, { portalType: 'academy_family' } as AuthUser)).toBe(true);
    expect(isAcademyOnlyPortal({ roleKey: 'family_portal' } as PortalSessionRecord, null)).toBe(false);
    expect(isAcademyOnlyPortal(null, { accessToken: 'invalid' } as AuthSession)).toBe(false);
  });
});
