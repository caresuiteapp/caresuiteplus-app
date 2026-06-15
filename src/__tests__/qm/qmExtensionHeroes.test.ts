import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildMdAuditCenterKpis,
  buildMdShareViewKpis,
  buildQmAiAssistantKpis,
  buildQmSettingsKpis,
} from '@/lib/qm/qmExtensionStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('QM Extension Heroes (Sprint 96)', () => {
  it('QmSettingsHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/qm/QmSettingsHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isQmExtensionLiveReady');
    expect(readSrc('src/screens/qm/QmSettingsScreen.tsx')).toContain('QmSettingsHero');
    expect(readSrc('src/screens/qm/QmSettingsScreen.tsx')).not.toContain('PreparedModeBanner');
  });

  it('QmAiAssistantHero und Screen ersetzen PreparedModeBanner', () => {
    const hero = readSrc('src/components/qm/QmAiAssistantHero.tsx');
    const screen = readSrc('src/screens/qm/QmAiAssistantScreen.tsx');
    expect(hero).toContain('KI-Assistent');
    expect(screen).toContain('QmAiAssistantHero');
    expect(screen).not.toContain('PreparedModeBanner');
  });

  it('MdAuditCenterHero und MdShareViewHero nutzen PremiumListHeroFrame', () => {
    expect(readSrc('src/components/qm/MdAuditCenterHero.tsx')).toContain('MD-Prüfungszentrum');
    expect(readSrc('src/components/qm/MdShareViewHero.tsx')).toContain('MD-FREIGABE');
    expect(readSrc('src/screens/qm/MdAuditCenterScreen.tsx')).toContain('MdAuditCenterHero');
    expect(readSrc('src/screens/qm/MdShareViewScreen.tsx')).toContain('MdShareViewHero');
    expect(readSrc('src/screens/qm/MdAuditCenterScreen.tsx')).not.toContain('PreparedModeBanner');
    expect(readSrc('src/screens/qm/MdShareViewScreen.tsx')).not.toContain('PreparedModeBanner');
  });

  it('buildQmSettingsKpis liefert Kennzahlen', () => {
    const kpis = buildQmSettingsKpis();
    expect(kpis[0]?.value).toBe('12 Mon.');
  });

  it('buildQmAiAssistantKpis zählt Entwürfe', () => {
    const kpis = buildQmAiAssistantKpis(3, 6);
    expect(kpis[0]?.value).toBe('3');
    expect(kpis[1]?.value).toBe('6');
  });

  it('buildMdAuditCenterKpis zählt Mappen', () => {
    const kpis = buildMdAuditCenterKpis(4, 2);
    expect(kpis[0]?.value).toBe('4');
    expect(kpis[1]?.value).toBe('2');
  });

  it('buildMdShareViewKpis nutzt Dokumentanzahl', () => {
    const kpis = buildMdShareViewKpis(7, 2026);
    expect(kpis[0]?.value).toBe('7');
    expect(kpis[1]?.value).toBe('2026');
  });
});
