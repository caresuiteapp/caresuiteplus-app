import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('system catalog fallback', () => {
  it('keeps built-in catalogs visible and lets tenant values override them', () => {
    const service = readFileSync(
      join(process.cwd(), 'src/lib/templates/catalogService.ts'),
      'utf8',
    );

    expect(service).toContain('SYSTEM_CATALOG_ENTRIES.filter');
    expect(service).toContain('entry.isActive');
    expect(service).toContain('`${entry.catalogType}:${entry.valueKey}`');
    expect(service.indexOf('for (const entry of systemEntries)')).toBeLessThan(
      service.indexOf('for (const entry of result.data)'),
    );
  });
});
