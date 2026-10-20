import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {Record<string, { ui?: string[], serviceImport?: string }>} */
const SCREEN_FIXES = {
  'src/screens/auth/PortalCodeLoginScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/auth/EmployeeFirstLoginPasswordScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/auth/EmployeePortalLoginScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/auth/BusinessLoginScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/auth/BusinessRegisterScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/akademie/AkademieReportsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/akademie/AkademieSettingsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/communication/ArchivedConversationsScreen.tsx': {
    ui: ['ErrorState', 'PremiumInput'],
    serviceImport: "import { listThreads } from '@/features/communication/communication.service';",
  },
  'src/screens/beratung/BeratungSettingsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/beratung/BeratungReportsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/stationaer/ResidentDetailScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchResidentDetail } from '@/lib/stationaer/residentDetailService';",
  },
  'src/screens/assist/AssignmentCreateScreen.tsx': {
    ui: ['EmptyState', 'ErrorState', 'LoadingState', 'PremiumInput'],
  },
  'src/screens/assist/AssignmentDetailScreen.tsx': {
    ui: ['PremiumInput'],
    serviceImport: "import { fetchAssignmentDetail } from '@/lib/assist/assignmentDetailService';",
  },
  'src/screens/beratung/ErstgespraechCreateScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/beratung/CaseCreateScreen.tsx': {
    ui: ['EmptyState', 'ErrorState', 'LoadingState', 'PremiumInput'],
  },
  'src/screens/beratung/CaseDetailScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchCounselingCaseDetail } from '@/lib/beratung/caseDetailService';",
  },
  'src/screens/pflege/InformationCollectionCreateScreen.tsx': { ui: ['EmptyState', 'LoadingState'] },
  'src/screens/insight/InsightIndexScreen.tsx': {
    ui: ['EmptyState', 'ErrorState', 'LoadingState', 'PremiumInput'],
    serviceImport: "import { fetchInsightDashboardStats } from '@/lib/insight/insightDashboardService';",
  },
  'src/screens/assist/AssistCalendarScreen.tsx': {
    ui: ['PremiumInput'],
    serviceImport: "import { fetchCalendarWeek } from '@/lib/assist/calendarService';",
  },
  'src/screens/akademie/CourseCreateScreen.tsx': {
    ui: ['EmptyState', 'ErrorState', 'LoadingState', 'PremiumInput'],
  },
  'src/screens/akademie/CourseDetailScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchCourseDetail } from '@/lib/akademie/courseDetailService';",
  },
  'src/screens/assist/CareRecordsListScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchCareRecordList } from '@/lib/assist/careRecordService';",
  },
  'src/screens/assist/ActiveExecutionsScreen.tsx': {
    ui: ['PremiumInput'],
    serviceImport: "import { fetchActiveExecutions } from '@/lib/assist/executionService';",
  },
  'src/screens/pflege/MedicationCreateScreen.tsx': {
    ui: ['EmptyState', 'LoadingState'],
    serviceImport: "import { fetchMedicationList } from '@/lib/pflege/medicationListService';",
  },
  'src/screens/communication/ConversationScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/assist/CareRecordDetailScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchCareRecordDetail } from '@/lib/assist/careRecordService';",
  },
  'src/screens/pflege/PflegeReportsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/pflege/PflegeSettingsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/pflege/CarePlanCreateScreen.tsx': {
    ui: ['EmptyState', 'ErrorState', 'LoadingState', 'PremiumInput'],
  },
  'src/screens/pflege/CarePlanDetailScreen.tsx': {
    ui: ['PremiumInput'],
    serviceImport: "import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';",
  },
  'src/screens/beratung/CounselingProtocolsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/pflege/SisDetailScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/stationaer/StationaerReportsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/stationaer/StationaerSettingsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
  'src/screens/ti/TIDashboardScreen.tsx': {
    ui: ['EmptyState', 'PremiumInput'],
    serviceImport: "import { fetchTIProviders } from '@/lib/ti/tiProviderService';",
  },
  'src/screens/pflege/VitalReadingCreateScreen.tsx': { ui: ['EmptyState', 'ErrorState', 'LoadingState'] },
  'src/screens/beratung/FollowUpsScreen.tsx': { ui: ['EmptyState', 'PremiumInput'] },
};

function mergeUiImport(src, symbols) {
  const needed = symbols.filter((s) => !new RegExp(`\\b${s}\\b`).test(src));
  if (needed.length === 0) return src;

  const uiImportRe = /import\s*\{([^}]+)\}\s*from\s*'@\/components\/ui';/;
  const match = src.match(uiImportRe);
  if (match) {
    const existing = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...needed])].sort((a, b) => a.localeCompare(b));
    return src.replace(uiImportRe, `import { ${merged.join(', ')} } from '@/components/ui';`);
  }

  const insertAfter = src.match(/^import .+;\n/m);
  const line = `import { ${needed.join(', ')} } from '@/components/ui';\n`;
  if (insertAfter) {
    const idx = src.indexOf(insertAfter[0]) + insertAfter[0].length;
    return src.slice(0, idx) + line + src.slice(idx);
  }
  return line + src;
}

function addServiceImport(src, line) {
  if (!line || src.includes(line.trim())) return src;
  const insertAfter = src.match(/^import .+;\n/m);
  if (insertAfter) {
    const idx = src.indexOf(insertAfter[0]) + insertAfter[0].length;
    return src.slice(0, idx) + `${line}\n` + src.slice(idx);
  }
  return `${line}\n${src}`;
}

let changed = 0;
for (const [rel, fix] of Object.entries(SCREEN_FIXES)) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    console.warn('missing', rel);
    continue;
  }
  let src = readFileSync(filePath, 'utf8');
  const before = src;
  if (fix.ui) src = mergeUiImport(src, fix.ui);
  src = addServiceImport(src, fix.serviceImport);
  if (src !== before) {
    writeFileSync(filePath, src, 'utf8');
    changed += 1;
    console.log('fixed', rel);
  }
}

console.log(`\nUpdated ${changed} screen files.`);
