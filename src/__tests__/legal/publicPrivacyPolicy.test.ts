import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/datenschutz.tsx'), 'utf8');
const policy = fs.readFileSync(path.join(root, 'src/screens/legal/CareSuitePrivacyPolicyScreen.tsx'), 'utf8');

describe('public CareSuite privacy policy', () => {
  it('provides a public /datenschutz route', () => {
    expect(route).toContain('CareSuitePrivacyPolicyScreen');
    expect(route).not.toContain('ProtectedRoute');
  });

  it('contains the current controller details', () => {
    expect(policy).toContain('CareSuite HealthOS Software Technologie');
    expect(policy).toContain('Kevin Reinhardt');
    expect(policy).toContain('Castroper Str. 81A, 44628 Herne');
    expect(policy).toContain('caresuiteapp@gmail.com');
    expect(policy).toContain('kein Datenschutzbeauftragter bestellt');
  });

  it('covers sensitive platform processing and role allocation', () => {
    for (const required of [
      'Auftragsverarbeiter nach Art. 28 DSGVO',
      'Gesundheits- und andere besondere Kategorien',
      'Touren, Einsätze und Standortdaten',
      'KI-, Sprach- und Dokumentenanalysefunktionen',
      'Automatisierte Entscheidungen und Profiling',
      'Google Maps',
      'Google Workspace',
      'Zoom',
      'Supabase',
      'Vercel',
      'OpenAI',
      'Drittlandübermittlungen',
      'Ihre Datenschutzrechte',
      'LDI NRW',
      '§ 25 TDDDG',
    ]) expect(policy).toContain(required);
  });

  it('uses the canonical production domain and current version date', () => {
    expect(policy).toContain('https://www.caresuiteplus.app/datenschutz');
    expect(policy).toContain('13. August 2026');
    expect(policy).not.toContain('caresuiteplus.de/datenschutz');
  });
});
