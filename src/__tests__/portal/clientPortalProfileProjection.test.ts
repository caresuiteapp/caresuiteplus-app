import { describe, expect, it } from 'vitest';
import {
  buildClientPortalProfileProjection,
  maskPortalInsuranceNumber,
  profileSectionHasContent,
} from '@/lib/portal/clientPortalProfileProjection';
import type { ClientPortalSettingsResolved } from '@/types/clientCore';

const enabledSettings: ClientPortalSettingsResolved = {
  portalEnabled: true,
  showAppointments: true,
  showMessages: true,
  showDocuments: true,
  showProofs: true,
  showBudget: false,
  showVisitTracking: false,
  inheritTenantDefaults: true,
  source: 'tenant',
};

const disabledSettings: ClientPortalSettingsResolved = {
  ...enabledSettings,
  portalEnabled: false,
};

describe('clientPortalProfileProjection', () => {
  it('masks insurance numbers for portal display', () => {
    expect(maskPortalInsuranceNumber('A123456789')).toBe('•••• •••• 6789');
    expect(maskPortalInsuranceNumber(null)).toBeNull();
  });

  it('builds expanded profile fields when portal is enabled', () => {
    const profile = buildClientPortalProfileProjection({
      tenantId: 't1',
      clientId: 'c1',
      settings: enabledSettings,
      displayName: 'Erika Muster',
      clientRow: {
        email: 'erika@example.de',
        mobile: '0176123456',
        date_of_birth: '1948-03-15',
        street: 'Hauptstraße',
        house_number: '1',
        postal_code: '44137',
        city: 'Dortmund',
        care_level: 'pg2',
        admission_date: '2024-06-01',
        access_notes: 'Klingeln bei Müller',
      },
      insuranceRow: {
        health_insurance: 'TK',
        care_fund_name: 'AOK Pflege',
        insurance_number: 'X987654321',
        care_level_valid_from: '2024-01-01',
      },
      careContexts: [{ context_key: 'daily_assistance' }],
      contacts: [
        {
          id: 'ec1',
          name: 'Tochter',
          is_emergency: true,
          contact_type: 'emergency_contact',
          phone: '0177000',
        },
        {
          id: 'rc1',
          name: 'Betreuer',
          relationship: 'bevollmaechtigt',
          is_portal_user: true,
          phone: '0231111',
        },
      ],
    });

    expect(profile.email).toBe('erika@example.de');
    expect(profile.insuranceNumberMasked).toBe('•••• •••• 4321');
    expect(profile.careModels).toContain('Alltagsbegleitung');
    expect(profile.representativeContacts).toHaveLength(1);
    expect(profile.portalHints).toBe('Klingeln bei Müller');
    expect(profileSectionHasContent(profile, 'insurance')).toBe(true);
  });

  it('hides profile detail groups when portal is disabled', () => {
    const profile = buildClientPortalProfileProjection({
      tenantId: 't1',
      clientId: 'c1',
      settings: disabledSettings,
      displayName: 'Erika Muster',
      clientRow: {
        email: 'erika@example.de',
        insurance_number: '1234',
      },
    });

    expect(profile.email).toBeNull();
    expect(profile.insuranceNumberMasked).toBeNull();
    expect(profileSectionHasContent(profile, 'contact')).toBe(false);
  });
});
