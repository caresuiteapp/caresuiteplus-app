import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('apply-live-migrations script (Sprint 46)', () => {
  it('apply-live-migrations.mjs erfordert --confirm für --apply', () => {
    const source = readSrc('scripts/apply-live-migrations.mjs');
    expect(source).toContain('--confirm');
    expect(source).toContain('0021_trips_live_list_fields.sql');
    expect(source).toContain('0030_assist_tracking_dashboard_live.sql');
    expect(source).toContain('0031_data_subject_requests.sql');
    expect(source).toContain('0032_data_subject_requests_admin_status_update.sql');
    expect(source).toContain('0033_employees_live_detail_fields.sql');
    expect(source).toContain('Kein service_role im Frontend');
    expect(source).not.toMatch(/SERVICE_ROLE|service_role_key/);
  });

  it('apply-live-migrations.mjs dokumentiert Safe-Apply ohne blindes push', () => {
    const source = readSrc('scripts/apply-live-migrations.mjs');
    expect(source).toContain('Dry-run');
    expect(source).toContain('deploy-live-pilot.mjs');
  });

  it('deploy-live-pilot.mjs verweist auf Safe-Apply-Guide', () => {
    const source = readSrc('scripts/deploy-live-pilot.mjs');
    expect(source).toContain('apply-live-migrations');
    expect(source).toContain('apply-live-migrations-0021-0030.md');
  });

  it('package.json exportiert apply:live-migrations', () => {
    const source = readSrc('package.json');
    expect(source).toContain('apply:live-migrations');
  });

  it('Safe-Apply-Doku listet Migrationen 0021–0030', () => {
    const source = readSrc('docs/deployment/apply-live-migrations-0021-0030.md');
    expect(source).toContain('0021');
    expect(source).toContain('0030');
    expect(source).toContain('service_role');
  });
});
