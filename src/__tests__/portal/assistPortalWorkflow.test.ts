import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildPortalNavigation } from '@/lib/portal/engine/buildPortalNavigation';
import { getFeaturesForModules } from '@/lib/portal/engine/portalFeatureMatrix';
import {
  isPortalBudgetFeatureEnabled,
} from '@/lib/portal/engine/portalFeatureAccess';
import { isFeatureVisible } from '@/lib/portal/engine/portalVisibility';
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'portal_requests') {
        return {
          insert: mockInsert.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === 'portal_request_status_history') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    },
  }),
}));

vi.mock('@/lib/portal/assist/portalActivityService', () => ({
  logPortalActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/portal/assist/portalAssistEvents', () => ({
  stubEmployeeNotificationForRequest: vi.fn().mockResolvedValue(undefined),
}));

describe('assist portal navigation', () => {
  it('includes assist feature nav when assist is primary', () => {
    const visibleFeatures = getFeaturesForModules(['assist']).filter(
      (f) => f.moduleKey === 'assist',
    );

    const nav = buildPortalNavigation({
      activeModuleKeys: ['assist'],
      hasModuleAssignments: true,
      primaryModule: 'assist',
      visibleFeatures,
    });

    expect(nav.some((item) => item.key === 'overview')).toBe(true);
    expect(nav.some((item) => item.key === 'assist-appointments')).toBe(true);
    expect(nav.some((item) => item.key === 'assist-anfragen')).toBe(true);
    expect(nav.some((item) => item.label === 'Begleitungen')).toBe(true);
    expect(nav.some((item) => item.label === 'Assist-Fahrten')).toBe(false);
  });
});

describe('createPortalRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: {
        id: 'req-1',
        tenant_id: 'tenant-1',
        client_id: 'client-1',
        portal_user_id: 'user-1',
        module_key: 'assist',
        request_type: 'rueckruf',
        status: 'offen',
        title: 'Rückruf',
        description: 'Bitte zurückrufen',
        payload: { thema: 'termin', rueckrufzeit: 'vormittag' },
        created_at: '2026-06-19T10:00:00Z',
        updated_at: '2026-06-19T10:00:00Z',
      },
      error: null,
    });
  });

  it('creates a portal request via supabase insert', async () => {
    const result = await createPortalRequest({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      portalUserId: 'user-1',
      requestType: 'rueckruf',
      title: 'Rückruf',
      description: 'Bitte zurückrufen',
      payload: { thema: 'termin', rueckrufzeit: 'vormittag' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('req-1');
      expect(result.data.requestType).toBe('rueckruf');
      expect(result.data.payload).toMatchObject({ thema: 'termin' });
    }
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe('assist empty state rules', () => {
  it('hides begleitungen when trips feature is not visible', () => {
    const rules = [
      {
        moduleKey: 'assist' as const,
        featureKey: 'trips',
        portalRole: 'client' as const,
        isVisible: false,
        requiresRelease: true,
      },
    ];
    expect(isFeatureVisible('assist', 'trips', 'client', rules)).toBe(false);
  });

  it('shows budget only when client has configured budget or office release', () => {
    expect(
      isPortalBudgetFeatureEnabled({
        activeModuleKeys: ['assist'],
        portalRole: 'client',
        visibilityRules: [],
        careProfile: {
          careContexts: ['daily_assistance'],
          configuredBudgetTypes: [],
          hasBudgetSnapshot: false,
        },
        baseVisibleFeatures: getFeaturesForModules(['assist']),
      }),
    ).toBe(false);

    expect(
      isPortalBudgetFeatureEnabled({
        activeModuleKeys: ['assist'],
        portalRole: 'client',
        visibilityRules: [
          {
            moduleKey: 'assist',
            featureKey: 'budget',
            portalRole: 'client',
            isVisible: true,
            requiresRelease: true,
          },
        ],
        careProfile: {
          careContexts: ['daily_assistance'],
          configuredBudgetTypes: [],
          hasBudgetSnapshot: false,
        },
        baseVisibleFeatures: getFeaturesForModules(['assist']),
      }),
    ).toBe(true);
  });
});
