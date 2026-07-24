import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isGoogleWorkspaceAdminRole,
  normalizeGoogleWorkspaceRole,
} from '../../../supabase/functions/_shared/googleWorkspaceRole';

describe('Google Workspace role compatibility', () => {
  it.each([
    ['owner', 'business_admin'],
    ['admin', 'business_admin'],
    ['management', 'business_manager'],
    ['office', 'business_manager'],
    ['planning', 'dispatch'],
  ])('maps live role %s to %s', (input, expected) => {
    expect(normalizeGoogleWorkspaceRole(input)).toBe(expected);
  });

  it('accepts current and legacy tenant administrators', () => {
    for (const role of ['business_admin', 'business_manager', 'owner', 'admin', 'management']) {
      expect(isGoogleWorkspaceAdminRole(role)).toBe(true);
    }
  });

  it('rejects operational and portal roles', () => {
    for (const role of ['billing', 'dispatch', 'caregiver', 'employee', 'client']) {
      expect(isGoogleWorkspaceAdminRole(role)).toBe(false);
    }
  });

  it('allows selecting a Google account independently from the CareSuite login', () => {
    const root = process.cwd();
    const authSource = readFileSync(
      path.join(root, 'supabase/functions/google-workspace-auth/index.ts'),
      'utf8',
    );
    const screenSource = readFileSync(
      path.join(root, 'src/screens/connect/GoogleWorkspaceScreen.tsx'),
      'utf8',
    );

    expect(authSource).toContain("prompt: 'select_account consent'");
    expect(authSource).not.toContain('login_hint');
    expect(screenSource).toContain('Google-Konto frei wählbar');
    expect(screenSource).toContain('darf von der CareSuite-Anmeldung abweichen');
  });
});
