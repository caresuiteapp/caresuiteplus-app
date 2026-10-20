import { describe, expect, it } from 'vitest';
import {
  resolveEmployeeTimeTrackingMode,
  roleQualifiesForHomeOfficeSetting,
  describeEmployeeTimeTrackingMode,
} from '@/lib/office/employeeHomeOfficeService';

describe('employeeHomeOfficeService', () => {
  it('leitet Homeoffice-Modus aus dispatch-Rolle ab', () => {
    expect(roleQualifiesForHomeOfficeSetting('dispatch')).toBe(true);
    expect(resolveEmployeeTimeTrackingMode('dispatch', null)).toBe('hybrid');
  });

  it('leitet Feld-Modus für reine Caregiver-Rolle ab', () => {
    expect(resolveEmployeeTimeTrackingMode('caregiver', false)).toBe('field');
  });

  it('aktiviert Homeoffice per Override', () => {
    expect(resolveEmployeeTimeTrackingMode('caregiver', true)).toBe('hybrid');
    expect(describeEmployeeTimeTrackingMode('homeoffice')).toContain('Homeoffice');
  });

  it('office-only Rollen ohne Feldrechte', () => {
    expect(resolveEmployeeTimeTrackingMode('counselor', null)).toBe('homeoffice');
    expect(roleQualifiesForHomeOfficeSetting('counselor')).toBe(true);
  });
});
