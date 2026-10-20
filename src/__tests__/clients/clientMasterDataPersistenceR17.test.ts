import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('client master data persistence R17', () => {
  it('writes every visible master-data field to the same source used for readback', () => {
    const repository = read('src/lib/clients/repositories/clientIntakeRepository.supabase.ts');
    const loader = read('src/lib/clients/clientIntakeEditService.ts');
    const mapper = read('src/lib/clients/clientEditFormMappers.ts');

    for (const field of [
      'salutation',
      'service_start',
      'housing_form',
      'special_notes',
      'preferred_contact',
    ]) {
      expect(repository).toContain(field);
    }
    for (const field of ['service_start', 'housing_form', 'special_notes', 'preferred_contact']) {
      expect(loader).toContain(field);
    }
    expect(mapper).toContain('fullClient.core.salutation');
  });

  it('does not report success before verifying the returned database row', () => {
    const repository = read('src/lib/clients/repositories/clientIntakeRepository.supabase.ts');
    expect(repository).toContain(".select('*')");
    expect(repository).toContain('expectedReadback');
    expect(repository).toContain('mismatchedFields');
  });

  it('ships an idempotent schema repair for every persisted profile field', () => {
    const migration = read(
      'supabase/migrations/20260731173000_client_master_data_persistence.sql',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS salutation');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS preferred_contact');
  });
});
