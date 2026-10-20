import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTenantServiceCatalogId, tenantServiceCatalogId } from '@/lib/catalog';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Office Katalog direkt bearbeiten', () => {
  it('öffnet den mandantenscharfen Editor direkt aus dem Katalogdetail', () => {
    const screen = read('src/screens/catalog/CatalogDetailScreen.tsx');
    const catalogIndex = read('src/lib/catalog/index.ts');
    expect(screen).toContain('title="Katalog bearbeiten"');
    expect(screen).toContain('<TenantServiceCatalogModal');
    expect(screen).toContain('initialModuleKey={moduleKey}');
    expect(screen).toContain('onSaved={() => void refresh()}');
    expect(catalogIndex).toContain('parseTenantServiceCatalogId');
    expect(catalogIndex).toContain('tenantServiceCatalogId');
    expect(parseTenantServiceCatalogId(tenantServiceCatalogId('assist'))).toBe('assist');
    expect(parseTenantServiceCatalogId('unbekannter-katalog')).toBeNull();
  });

  it('bearbeitet Positionen ausschließlich mit strukturierten Einheiten, Kategorien und Statuswerten', () => {
    const modal = read('src/components/tenant/TenantServiceCatalogModal.tsx');
    expect(modal).toContain('UNIT_OPTIONS');
    expect(modal).toContain('CATEGORY_OPTIONS');
    expect(modal).toContain('title="+ Neue Position"');
    expect(modal).toContain("status === 'active'");
    expect(modal).toContain("isNew ? 'Position anlegen' : 'Änderungen speichern'");
  });
});
