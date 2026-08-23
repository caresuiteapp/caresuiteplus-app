import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Assist Live-Status Workspace R7', () => {
  const screen = readSrc('src/screens/assist/AssistLiveStatusScreen.tsx');
  const webMap = readSrc('src/components/maps/AssistLiveMap.web.tsx');
  const nativeMap = readSrc('src/components/maps/AssistLiveMap.tsx');
  const inbox = readSrc('src/components/assist/AssistExecutionProblemInboxPanel.tsx');

  it('liefert einen klar gegliederten operativen Leitstand mit belastbarer Live-Kennung', () => {
    expect(screen).toContain("healthosLiveStatusRevision: 'r7'");
    expect(screen).toContain('ASSIST · OPERATIVER LEITSTAND');
    expect(screen).toContain('Einsätze in Echtzeit im Blick');
    expect(screen).toContain('EINSATZSTEUERUNG');
    expect(screen).toContain('POSITIONSMONITOR');
    expect(screen).toContain('LiveMetric');
    expect(screen.match(/<LiveMetric/g)).toHaveLength(5);
  });

  it('bewahrt Aktualisierung, Einsatznavigation, Timer, GPS und Routenfortschritt', () => {
    expect(screen).toContain('useAssistLiveMonitoring');
    expect(screen).toContain('RefreshControl');
    expect(screen).toContain('formatPreciseDuration');
    expect(screen).toContain('formatGpsPermission');
    expect(screen).toContain('formatDistance');
    expect(screen).toContain('title="Einsatzdetails"');
    expect(screen).toContain('router.push(`/assist/assignments/${row.assignmentId}`');
  });

  it('ersetzt die weiße Kartenleere auf Web und Native durch einen lesbaren Positionsmonitor', () => {
    for (const source of [webMap, nativeMap]) {
      expect(source).toContain('WARTET AUF STANDORT');
      expect(source).toContain('Positionsmonitor ist bereit');
      expect(source).toContain("backgroundColor: '#06192F'");
      expect(source).not.toContain('backgroundColor: colors.bgSurface');
    }
  });

  it('zeigt die Problem-Inbox in allen Zuständen als eigenständigen lesbaren Qualitätsbereich', () => {
    expect(inbox).toContain('QUALITÄT & BLOCKER');
    expect(inbox).toContain('Alle Prüfbereiche sind unauffällig');
    expect(inbox).toContain('Prüfung derzeit nicht vollständig');
    expect(inbox).toContain('Problem-Inbox wird geprüft');
    expect(inbox).toContain('PRÜFEN');
    expect(inbox).not.toContain('SectionPanel');
  });
});
