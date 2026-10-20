import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_MODULE_READINESS,
  MARKETPLACE_NO_MEDICAL_NOTICE,
  isMarketplaceLiveReady,
} from '@/lib/marketplace';

function readMarketplaceScreenSource(): string {
  const root = path.join(process.cwd(), 'src/screens/marketplace');
  return fs
    .readdirSync(root)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
}

describe('Marketplace UI preparation', () => {
  it('zeigt Beta/Coming-Soon Status', () => {
    expect(MARKETPLACE_MODULE_READINESS).toBe('beta');
    expect(isMarketplaceLiveReady()).toBe(false);
  });

  it('enthält alle 13 Partner-Kategorien', () => {
    expect(MARKETPLACE_CATEGORIES).toHaveLength(13);
  });

  it('Request-Button ist ohne Einwilligung deaktiviert', () => {
    const source = readMarketplaceScreenSource();
    expect(source).toContain('disabled={!canSend}');
    expect(source).toContain('consentGiven');
  });

  it('zeigt Datenfreigabe und medizinischen Hinweis', () => {
    const source = readMarketplaceScreenSource();
    expect(source).toContain('MarketplaceDataSharingPanel');
    expect(MARKETPLACE_NO_MEDICAL_NOTICE).toMatch(/keine medizinischen/i);
    expect(source).toContain('MarketplaceBetaBanner');
  });

  it('Admin-Screen ist nur für business_admin', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/marketplace/MarketplaceAdminScreen.tsx'),
      'utf8',
    );
    expect(source).toContain("roleKey === 'business_admin'");
    expect(source).toContain('approvePartnerStatus');
  });
});
