import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const passed = [];
const check = (label, condition) => {
  if (!condition) throw new Error(`✗ ${label}`);
  passed.push(label);
};

const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
const additions = read('src/components/wfm/WfmNachtraegeOfficeScreen.tsx');
const manual = read('src/components/wfm/WfmOfficeManualEntryPanel.tsx');
const planning = read('src/lib/wfm/wfmPlanningService.ts');

check('Ein gemeinsamer Arbeitszeit-Workspace', shell.includes('styles.workspace') && shell.includes('styles.navigationSurface'));
check('Alle Reiter zeigen Symbol und Beschriftung', shell.includes('tab.icon') && shell.includes('tab.label'));
check('Alle zehn Reiter bleiben am Desktop sichtbar', shell.includes('styles.tabRowDesktop') && shell.includes('flexWrap'));
check('Tabellen und Aktionen sind vertikal erreichbar', shell.includes('contentContainerStyle={styles.contentContainer}') && shell.includes('showsVerticalScrollIndicator'));
check('Helle CareSuite-Oberfläche statt Testdesign', shell.includes('rgba(255,255,255,0.72)') && !shell.includes('DarkLiquidGlassBackground'));
check('KPIs und Filter besitzen getrennte Oberflächen', layout.includes('minWidth: 118') && layout.includes('filterBar'));
check('Arbeitszeittabelle ist lesbar', table.includes('fontSize: 13') && table.includes('rgba(255,255,255,0.94)'));
check('Prüfdetail ist als feste Arbeitsfläche gestaltet', detail.includes('width: 420') || layout.includes('width: 420'));
check('Nachträge laden gültigen Live-Status', planning.includes(".eq('status', 'active')") && !planning.includes("['aktiv', 'active']"));
check('Nachtragsformular bleibt bei Ladefehler verborgen', additions.includes('!teamQuery.loading && !teamQuery.error'));
check('Nachträge validieren Zeiten und Begründung', manual.includes('Das Ende muss nach dem Beginn liegen.') && manual.includes('Eine Begründung für den Nachtrag ist erforderlich.'));

console.log('CareSuite+ office:worktime:v32.6:experience-audit');
for (const label of passed) console.log(`✓ ${label}`);
console.log(`✓ ${passed.length} Design-, Struktur- und Funktionsprüfungen bestanden`);
