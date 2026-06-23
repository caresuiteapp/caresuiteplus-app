import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AKADEMIE_HEADER_PRIMARY_ACTIONS,
  AKADEMIE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/akademie/akademieDashboardWorkspace';
import { ASSIST_HEADER_PRIMARY_ACTIONS } from '@/lib/assist/assistDashboardWorkspace';
import {
  BERATUNG_HEADER_PRIMARY_ACTIONS,
  BERATUNG_HEADER_SECONDARY_ACTIONS,
} from '@/lib/beratung/beratungDashboardWorkspace';
import {
  OFFICE_HEADER_OPTIONAL_ACTIONS,
  OFFICE_HEADER_PRIMARY_ACTIONS,
  OFFICE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/office/officeDashboardWorkspace';
import {
  PFLEGE_HEADER_PRIMARY_ACTIONS,
  PFLEGE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/pflege/pflegeDashboardWorkspace';
import {
  STATIONAER_HEADER_PRIMARY_ACTIONS,
  STATIONAER_HEADER_SECONDARY_ACTIONS,
} from '@/lib/stationaer/stationaerDashboardWorkspace';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function countToolbarActions(
  primaryCount: number,
  secondaryCount: number,
  optionalCount = 0,
  refresh = true,
): number {
  return primaryCount + secondaryCount + optionalCount + (refresh ? 1 : 0);
}

describe('ActionToolbar dashboard action bar wrap layout', () => {
  const toolbar = readSrc('src/components/layout/platform/actiontoolbar.tsx');

  it('uses column outer container with full width and minWidth 0', () => {
    expect(toolbar).toContain("flexDirection: 'column'");
    expect(toolbar).toContain("width: '100%'");
    expect(toolbar).toContain("maxWidth: '100%'");
    expect(toolbar).toContain('minWidth: 0');
    expect(toolbar).toMatch(/ACTION_GAP\s*=\s*12/);
  });

  it('splits flat actions into primary (max 2) and secondary rows at render time', () => {
    expect(toolbar).toContain('PRIMARY_ROW_MAX = 2');
    expect(toolbar).toContain('actions.slice(0, PRIMARY_ROW_MAX)');
    expect(toolbar).toContain('actions.slice(PRIMARY_ROW_MAX)');
    expect(toolbar).toContain('primaryRow');
    expect(toolbar).toContain('secondaryRow');
  });

  it('uses flex-wrap rows with 12px gap and no fixed overflow width', () => {
    expect(toolbar).toContain("flexWrap: 'wrap'");
    expect(toolbar).toContain('gap: ACTION_GAP');
    expect(toolbar).not.toMatch(/actions:\s*\{[^}]*flexDirection:\s*'row'[^}]*flexWrap:\s*'nowrap'/);
    expect(toolbar).not.toMatch(/width:\s*\d{3,}/);
  });

  it('applies primary styling to first row and glass/ghost to secondary row', () => {
    expect(toolbar).toContain("renderAction(action, 'primary')");
    expect(toolbar).toContain("renderAction(action, 'secondary')");
    expect(toolbar).toContain('btnPrimary');
    expect(toolbar).toContain('btnGhost');
    expect(toolbar).toMatch(/flexShrink:\s*1/);
    expect(toolbar).toMatch(/maxWidth:\s*'100%'/);
  });
});

describe('module index screens pass flat ActionToolbar arrays', () => {
  const modules = [
    {
      name: 'Beratung',
      path: 'src/screens/beratung/BeratungIndexScreen.tsx',
      primary: BERATUNG_HEADER_PRIMARY_ACTIONS.length,
      secondary: BERATUNG_HEADER_SECONDARY_ACTIONS.length,
    },
    {
      name: 'Pflege',
      path: 'src/screens/pflege/PflegeIndexScreen.tsx',
      primary: PFLEGE_HEADER_PRIMARY_ACTIONS.length,
      secondary: PFLEGE_HEADER_SECONDARY_ACTIONS.length,
    },
    {
      name: 'Stationaer',
      path: 'src/screens/stationaer/StationaerIndexScreen.tsx',
      primary: STATIONAER_HEADER_PRIMARY_ACTIONS.length,
      secondary: STATIONAER_HEADER_SECONDARY_ACTIONS.length,
    },
    {
      name: 'Akademie',
      path: 'src/screens/akademie/AkademieIndexScreen.tsx',
      primary: AKADEMIE_HEADER_PRIMARY_ACTIONS.length,
      secondary: AKADEMIE_HEADER_SECONDARY_ACTIONS.length,
    },
    {
      name: 'Office',
      path: 'src/screens/office/OfficeIndexScreen.tsx',
      primary: OFFICE_HEADER_PRIMARY_ACTIONS.length,
      secondary:
        OFFICE_HEADER_SECONDARY_ACTIONS.length + OFFICE_HEADER_OPTIONAL_ACTIONS.length,
    },
    {
      name: 'Assist',
      path: 'src/screens/assist/AssistIndexScreen.tsx',
      primary: ASSIST_HEADER_PRIMARY_ACTIONS.length,
      secondary: 0,
    },
  ] as const;

  for (const mod of modules) {
    it(`${mod.name}IndexScreen uses ActionToolbar with flat toolbarActions array`, () => {
      const screen = readSrc(mod.path);
      expect(screen).toContain('ActionToolbar');
      expect(screen).toContain('toolbarActions');
      expect(screen).toContain('actions={toolbarActions}');
    });

    it(`${mod.name} has ${mod.primary} primary-config actions — row 1 capped at 2 by ActionToolbar`, () => {
      expect(mod.primary).toBeLessThanOrEqual(2);
    });

    it(`${mod.name} overflow actions (${mod.secondary}+ refresh) land in secondary row`, () => {
      const total = countToolbarActions(mod.primary, mod.secondary, mod.name === 'Office' ? 0 : 0);
      if (mod.name === 'Office') {
        const officeTotal = countToolbarActions(
          mod.primary,
          OFFICE_HEADER_SECONDARY_ACTIONS.length,
          OFFICE_HEADER_OPTIONAL_ACTIONS.length,
        );
        expect(officeTotal).toBeGreaterThan(2);
        expect(officeTotal - 2).toBeGreaterThanOrEqual(3);
        return;
      }
      if (mod.name === 'Assist') {
        expect(total).toBeLessThanOrEqual(2);
        return;
      }
      expect(total).toBeGreaterThan(2);
      expect(total - 2).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('Beratung action bar regression (6 actions)', () => {
  it('Beratung toolbar has 6 actions — first 2 primary, remaining 4 secondary', () => {
    const total = countToolbarActions(
      BERATUNG_HEADER_PRIMARY_ACTIONS.length,
      BERATUNG_HEADER_SECONDARY_ACTIONS.length,
    );
    expect(total).toBe(6);
    expect(BERATUNG_HEADER_PRIMARY_ACTIONS.length).toBe(2);
    expect(BERATUNG_HEADER_SECONDARY_ACTIONS.length + 1).toBe(4);
  });

  it('BeratungIndexScreen does not implement its own row split', () => {
    const screen = readSrc('src/screens/beratung/BeratungIndexScreen.tsx');
    expect(screen).not.toContain('primaryRow');
    expect(screen).not.toContain('secondaryRow');
    expect(screen).toContain('ActionToolbar actions={toolbarActions}');
  });
});
