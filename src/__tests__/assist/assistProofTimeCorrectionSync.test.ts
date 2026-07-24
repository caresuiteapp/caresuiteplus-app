import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

describe('assist proof administrative time correction sync migration', () => {
  const migration = readFileSync(
    path.join(
      root,
      'supabase/migrations/20260724133000_assist_proof_time_correction_sync.sql',
    ),
    'utf8',
  );

  it('updates existing proof snapshots without removing signature or documentation', () => {
    expect(migration).toContain('sync_assist_time_correction_to_proofs');
    expect(migration).toContain("'visitTimes'");
    expect(migration).toContain("'serviceStartedAt', v_visit.actual_start_at");
    expect(migration).toContain("'serviceEndedAt', v_visit.actual_end_at");
    expect(migration).not.toMatch(/payload_snapshot\s*=\s*jsonb_build_object/);
  });

  it('invalidates stale PDFs and repairs already corrected visits', () => {
    expect(migration).toContain('pdf_storage_path = NULL');
    expect(migration).toContain('pdfRegenerationRequired');
    expect(migration).toContain('portal_visible = FALSE');
    expect(migration).toContain("WHERE audit.action = 'times_corrected'");
    expect(migration).toContain('sync_administrative_time_event_to_proof_trigger');
  });
});
