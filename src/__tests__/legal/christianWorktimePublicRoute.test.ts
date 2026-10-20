import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, 'public/christianreinhardt/index.html'),
  'utf8',
);
const api = fs.readFileSync(path.join(root, 'api/christian-worktime.js'), 'utf8');

describe('Christian Reinhardt public worktime tracker', () => {
  it('stays outside the central HealthOS popup presentation', () => {
    expect(isHealthOSContextualPopupRoute('/christianreinhardt')).toBe(false);
    expect(isHealthOSContextualPopupRoute('/christianreinhardt/index')).toBe(false);
  });

  it('restores the standalone protected worktime interface', () => {
    expect(page).toContain('Arbeitszeiterfassung · Christian Reinhardt');
    expect(page).toContain('Geschützter Bereich');
    expect(page).toContain('123 Fahrschule Dortmund');
    expect(page).toContain('/api/christian-worktime');
  });

  it('uses the existing Supabase database configuration without destructive cleanup', () => {
    expect(api).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(api).toContain('CHRISTIAN_TIME_PIN');
    expect(api).toContain('CHRISTIAN_TIME_SIGNING_SECRET');
    expect(api).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(api).not.toContain('truncate');
    expect(api).not.toContain('delete from');
  });
});
