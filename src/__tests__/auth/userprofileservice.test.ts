import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildUserProfileWritePayload } from '@/lib/auth/userprofileservice';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('userProfileService', () => {
  it('sendet nur first_name, last_name und updated_at — kein full_name', () => {
    expect(
      buildUserProfileWritePayload('Kevin', 'Reinhardt', '2026-06-18T12:00:00.000Z'),
    ).toEqual({
      first_name: 'Kevin',
      last_name: 'Reinhardt',
      updated_at: '2026-06-18T12:00:00.000Z',
    });
    expect(
      buildUserProfileWritePayload('Kevin', 'Reinhardt', '2026-06-18T12:00:00.000Z'),
    ).not.toHaveProperty('full_name');
  });

  it('mappt leere Namen auf null', () => {
    expect(buildUserProfileWritePayload('', 'Reinhardt', '2026-06-18T12:00:00.000Z')).toEqual({
      first_name: null,
      last_name: 'Reinhardt',
      updated_at: '2026-06-18T12:00:00.000Z',
    });
  });

  it('saveUserProfile nutzt buildUserProfileWritePayload statt full_name', () => {
    const source = readSrc('src/lib/auth/userProfileService.ts');
    expect(source).toContain('buildUserProfileWritePayload');
    expect(source).not.toMatch(/full_name:\s*displayName/);
  });

  it('UserProfileScreen aktualisiert Auth-Kontext nach Speichern', () => {
    const source = readSrc('src/screens/settings/UserProfileScreen.tsx');
    expect(source).toContain('updateProfile');
    expect(source).toContain('updateProfile(result.data)');
  });
});
