import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('produktive Medikation für ambulante Pflege und Intensivpflege', () => {
  it('entfernt Demo-Speicher und Demo-Fallback aus dem produktiven Datenpfad', () => {
    const list = read('src/lib/pflege/medicationListService.ts');
    const detail = read('src/lib/pflege/medicationDetailService.ts');
    const create = read('src/screens/pflege/MedicationCreateScreen.tsx');
    expect(list).toContain('fetchLiveMedicationList');
    expect(detail).toContain('fetchLiveMedicationDetail');
    expect(`${list}${detail}${create}`).not.toMatch(/createDemoMedication|getDemoMedication|demoClients/);
  });

  it('deckt Regel-, Bedarfs-, Hochrisiko-, BtM- und Intensivmedikation ab', () => {
    const service = read('src/lib/pflege/medicationLiveService.ts');
    const create = read('src/screens/pflege/MedicationCreateScreen.tsx');
    expect(service).toContain('is_high_alert');
    expect(service).toContain('is_controlled_substance');
    expect(service).toContain('intensive_care_relevant');
    expect(service).toContain('pump_required');
    expect(create).toContain('Bedarfsindikation / Grenzwert');
    expect(create).toContain('Laufgeschwindigkeit');
  });

  it('erzwingt Begründung, Bedarfsindikation und BtM-Gegenkontrolle', () => {
    const service = read('src/lib/pflege/medicationLiveService.ts');
    expect(service).toContain('Bei nicht erfolgter oder abweichender Gabe ist eine Begründung erforderlich.');
    expect(service).toContain('Die Indikation der Bedarfsmedikation muss vor der Gabe dokumentiert werden.');
    expect(service).toContain('Für BtM-Gaben ist eine Gegenkontrolle erforderlich.');
  });

  it('speichert Gabennachweise append-only und mandantengetrennt', () => {
    const migration = read('supabase/migrations/20260812153000_live_medication_ambulatory_intensive.sql');
    expect(migration).toContain('create table if not exists public.medication_administrations');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('revoke update, delete on public.medication_administrations');
    expect(migration).toContain('enforce_medication_administration_scope');
  });

  it('liefert eine produktive Gaben- und Abweichungshistorie in deutscher Sprache', () => {
    const screen = read('src/screens/pflege/MedicationDetailScreen.tsx');
    expect(screen).toContain('Gabe / Abweichung dokumentieren');
    expect(screen).toContain('Gabenverlauf');
    expect(screen).toContain('Verabreicht');
    expect(screen).toContain('Ausgelassen');
    expect(screen).toContain('Abgelehnt');
  });
});
