import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const releaseScript = readFileSync(
  join(process.cwd(), 'scripts/release-google-play-portal-v0.3.2.sh'),
  'utf8',
);

describe('Google Play R20.3 isolated production migration', () => {
  it('loads the productive migration history into a temporary release workspace', () => {
    expect(releaseScript).toContain('RELEASE_DB_ROOT="$(mktemp -d)"');
    expect(releaseScript).toContain('supabase@latest migration fetch --linked');
    expect(releaseScript).toContain('supabase/.temp/project-ref');
  });

  it('admits only the R20.3 portal message migration', () => {
    expect(releaseScript).toContain(
      "RELEASE_MIGRATION='20260902103000_portal_message_atomic_create_r20_3.sql'",
    );
    expect(releaseScript).toContain(
      "[[ \"$local_only_versions\" = '20260902103000' ]]",
    );
    expect(releaseScript).toContain('[[ -z "$remote_only_versions" ]]');
  });

  it('never bulk-applies or rewrites the productive migration history', () => {
    expect(releaseScript).not.toContain('db push --linked --include-all');
    expect(releaseScript).not.toContain('migration repair');
    expect(releaseScript).not.toContain('--status reverted');
  });
});
