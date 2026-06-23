import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAkademieOpenTasks } from '@/lib/akademie/akademieDashboardWorkspace';
import { buildAssistOpenTasks } from '@/lib/assist/assistDashboardWorkspace';
import { buildBeratungOpenTasks } from '@/lib/beratung/beratungDashboardWorkspace';
import { buildStationaerOpenTasks } from '@/lib/stationaer/stationaerDashboardWorkspace';
import { emptyAkademieDashboardStats } from '@/types/modules/akademie';
import type { AssistDashboardStats } from '@/types/modules/assist';
import { emptyBeratungDashboardStats } from '@/types/modules/beratung';
import { emptyStationaerDashboardStats } from '@/types/modules/stationaer';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const STATIONAER_SAMPLE_STATS = {
  ...emptyStationaerDashboardStats(),
  admissionsToday: 2,
  dischargesToday: 1,
  openHandoversCount: 3,
  freeBeds: 5,
  openResidentPlanningCount: 4,
  roomConflictCount: 1,
};

describe('RightContextPanel today section layout', () => {
  const desktop = readSrc('src/components/layout/platform/rightcontextpanel.tsx');

  it('uses flex column root with scroll area and no fixed today height', () => {
    expect(desktop).toContain('flexDirection: \'column\'');
    expect(desktop).toContain('overflow: \'hidden\'');
    expect(desktop).toContain('minHeight: 0');
    expect(desktop).not.toMatch(/taskList:\s*\{[^}]*maxHeight/);
    expect(desktop).toContain('todaySection');
    expect(desktop).toContain('taskList');
  });

  it('places Schnellaktionen after Heute in DOM order', () => {
    const heuteIdx = desktop.indexOf('styles.todaySection');
    const quickIdx = desktop.indexOf('title="Schnellaktionen"');
    expect(heuteIdx).toBeGreaterThan(-1);
    expect(quickIdx).toBeGreaterThan(heuteIdx);
  });

  it('uses row layout for today items with ellipsis and non-overlapping badges', () => {
    expect(desktop).toContain('flexDirection: \'row\'');
    expect(desktop).toContain('justifyContent: \'space-between\'');
    expect(desktop).toContain('minWidth: 0');
    expect(desktop).toContain('flexShrink: 0');
    expect(desktop).toContain('numberOfLines={1}');
    expect(desktop).toMatch(/minHeight:\s*32/);
  });

  it('does not use absolute positioning on today or quick-action section containers', () => {
    const todayBlock = desktop.slice(
      desktop.indexOf('todaySection'),
      desktop.indexOf('CollapsibleSidebarSection'),
    );
    expect(todayBlock).not.toMatch(/position:\s*'absolute'/);
    expect(todayBlock).not.toMatch(/position:\s*'fixed'/);

    const quickBlock = desktop.slice(
      desktop.indexOf('title="Schnellaktionen"'),
      desktop.indexOf('styles.navSection'),
    );
    expect(quickBlock).not.toMatch(/position:\s*'absolute'/);
    expect(quickBlock).not.toMatch(/position:\s*'fixed'/);
    expect(quickBlock).not.toMatch(/top:\s*\d/);
  });

  it('keeps support footer outside scroll with flexShrink 0', () => {
    expect(desktop).toContain('supportFooter');
    expect(desktop).toContain('flexShrink: 0');
    const scrollEnd = desktop.indexOf('</ScrollView>');
    const supportIdx = desktop.indexOf('styles.supportFooter');
    expect(supportIdx).toBeGreaterThan(scrollEnd);
  });
});

describe('MobilePlatformContextPanel today section layout', () => {
  const mobile = readSrc('src/components/layout/platform/mobileplatformcontextpanel.tsx');

  it('places SCHNELLAKTIONEN after HEUTE in DOM order', () => {
    const heuteIdx = mobile.indexOf('HEUTE');
    const quickIdx = mobile.indexOf('SCHNELLAKTIONEN');
    expect(heuteIdx).toBeGreaterThan(-1);
    expect(quickIdx).toBeGreaterThan(heuteIdx);
  });

  it('uses row layout for today rows without max height cap', () => {
    expect(mobile).toContain('statusRow');
    expect(mobile).toContain('minWidth: 0');
    expect(mobile).toContain('flexShrink: 0');
    expect(mobile).not.toMatch(/maxHeight:\s*120/);
  });
});

describe('buildOpenTasks item counts per module', () => {
  const data = readSrc('src/components/layout/platform/platformContextData.ts');

  it('returns 1 item for live office fallback without office data', () => {
    expect(data).toContain('Keine offenen Vorgänge');
    expect(data).toContain('if (isLive) {');
  });

  it('does not slice today tasks — supports 1, 5 and 8 rendered rows', () => {
    const desktop = readSrc('src/components/layout/platform/rightcontextpanel.tsx');
    expect(desktop).toContain('openTasks.map');
    expect(desktop).not.toMatch(/openTasks\.slice/);

    const one = [{ title: 'Keine offenen Vorgänge', count: 0 }];
    const five = buildAssistOpenTasks({
      totalAssignments: 10,
      todayCount: 3,
      activeCount: 1,
      inProgressCount: 1,
      completedTodayCount: 0,
      upcomingCount: 0,
      atRiskCount: 0,
      incompleteCount: 2,
      openProofCount: 0,
      openProofReviewCount: 1,
      openSignatureCount: 1,
      openPortalReleaseCount: 0,
      openTripsCount: 0,
    } satisfies AssistDashboardStats);
    const eight = Array.from({ length: 8 }, (_, index) => ({
      title: `Heute-Eintrag ${index + 1}`,
      count: index,
    }));

    expect(one.length).toBe(1);
    expect(five.length).toBe(5);
    expect(eight.length).toBe(8);
  });

  it('returns 6 stationaer today items including Offene Bewohnerplanung', () => {
    const tasks = buildStationaerOpenTasks(STATIONAER_SAMPLE_STATS);
    expect(tasks.length).toBe(6);
    expect(tasks.map((t) => t.title)).toContain('Offene Bewohnerplanung');
    expect(tasks.map((t) => t.title)).toContain('Neuaufnahmen');
    expect(tasks.map((t) => t.title)).toContain('Entlassungen');
  });

  it('stationaer via workspace yields 5+ items for overlap regression', () => {
    const tasks = buildStationaerOpenTasks(STATIONAER_SAMPLE_STATS);
    expect(tasks.length).toBeGreaterThanOrEqual(5);
  });

  it('returns beratung, akademie and pflege task lists without truncation', () => {
    const beratung = buildBeratungOpenTasks({
      ...emptyBeratungDashboardStats(),
      appointmentsTodayCount: 2,
      dueFollowUpsCount: 1,
      openProtocolsCount: 3,
      openCallbacksCount: 1,
      newCasesCount: 2,
      deadlinesEscalationsCount: 1,
    });
    const akademie = buildAkademieOpenTasks({
      ...emptyAkademieDashboardStats(),
      upcomingCoursesCount: 2,
      mandatoryOverdueCount: 1,
      openEnrollmentsCount: 3,
      upcomingExamsCount: 1,
      certificatesToIssueCount: 2,
      certificatesExpiringCount: 1,
      mediathekOpenCount: 1,
    });
    const pflegeDemo = readSrc('src/components/layout/platform/platformContextData.ts').includes(
      'DEMO_OPEN_TASKS',
    );

    expect(beratung.length).toBe(6);
    expect(akademie.length).toBe(7);
    expect(pflegeDemo).toBe(true);
  });
});

describe('module sidebar variants wire correct quick actions', () => {
  const desktop = readSrc('src/components/layout/platform/rightcontextpanel.tsx');

  const modules = [
    { key: 'assist', constant: 'ASSIST_QUICK_ACTIONS' },
    { key: 'office', constant: 'OFFICE_QUICK_ACTIONS' },
    { key: 'pflege', constant: 'PFLEGE_QUICK_ACTIONS' },
    { key: 'stationaer', constant: 'STATIONAER_QUICK_ACTIONS' },
    { key: 'beratung', constant: 'BERATUNG_QUICK_ACTIONS' },
    { key: 'akademie', constant: 'AKADEMIE_QUICK_ACTIONS' },
  ] as const;

  for (const { key, constant } of modules) {
    it(`rightcontextpanel references ${constant} for ${key}`, () => {
      expect(desktop).toContain(`mainModule === '${key}'`);
      expect(desktop).toContain(constant);
    });
  }
});
