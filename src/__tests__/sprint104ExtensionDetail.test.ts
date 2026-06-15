import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCareRecordDetailKpis } from '@/lib/assist/careRecordDetailStats';
import {
  buildFollowUpDetailKpis,
  buildProtocolDetailKpis,
} from '@/lib/beratung/extensionDetailStats';
import { getDemoFollowUpById, getDemoProtocolById } from '@/data/demo/beratungExtended';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Assist CareRecord Detail Hero (Sprint 104)', () => {
  it('CareRecordDetailHero nutzt PremiumListHeroFrame', () => {
    expect(readSrc('src/components/assist/CareRecordDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/screens/assist/CareRecordDetailScreen.tsx')).toContain('CareRecordDetailHero');
  });

  it('buildCareRecordDetailKpis liefert Klient:in', () => {
    const kpis = buildCareRecordDetailKpis({
      id: '1',
      tenantId: 't1',
      assignmentId: 'a1',
      assignmentTitle: 'Einsatz',
      clientName: 'Helga Schneider',
      employeeName: 'Maria',
      content: 'Text',
      recordedAt: new Date().toISOString(),
      status: 'aktiv',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      durationMinutes: 45,
      location: 'Zuhause',
      hasSignature: true,
      pdfReady: false,
      signature: null,
      pdfExportPath: null,
    });
    expect(kpis[0]?.label).toBe('Klient:in');
  });
});

describe('Beratung Extension Detail (Sprint 104)', () => {
  it('ProtocolDetailHero und Route existieren', () => {
    expect(readSrc('src/components/beratung/ProtocolDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(fs.existsSync(path.join(process.cwd(), 'app/beratung/protokolle/[id].tsx'))).toBe(true);
    expect(readSrc('src/components/beratung/ProtocolsListView.tsx')).toContain('/beratung/protokolle/');
  });

  it('FollowUpDetailHero und Route existieren', () => {
    expect(readSrc('src/components/beratung/FollowUpDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(fs.existsSync(path.join(process.cwd(), 'app/beratung/wiedervorlagen/[id].tsx'))).toBe(true);
    expect(readSrc('src/screens/beratung/FollowUpsScreen.tsx')).toContain('FollowUpsListView');
    expect(readSrc('src/components/beratung/FollowUpsListView.tsx')).toContain('ModuleExtensionNavStrip');
  });

  it('buildProtocolDetailKpis und buildFollowUpDetailKpis', () => {
    const protocol = getDemoProtocolById('proto-001');
    const followUp = getDemoFollowUpById('follow-001');
    expect(protocol).not.toBeNull();
    expect(followUp).not.toBeNull();
    expect(buildProtocolDetailKpis(protocol!).length).toBe(3);
    expect(buildFollowUpDetailKpis(followUp!).length).toBe(3);
  });
});

describe('Portal Relative Conversation Hero (Sprint 104)', () => {
  it('PortalRelativeConversationHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/portal/PortalRelativeConversationHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('ANGEHÖRIGENPORTAL');
  });

  it('ConversationScreen nutzt Hero für portal_family', () => {
    const screen = readSrc('src/screens/communication/ConversationScreen.tsx');
    expect(screen).toContain('PortalRelativeConversationHero');
    expect(screen).toContain("portalScope === 'portal_family'");
  });

  it('PortalMessageDetailHero unterstützt family scope', () => {
    expect(readSrc('src/components/portal/PortalMessageDetailHero.tsx')).toContain("'family'");
  });
});
