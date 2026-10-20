#!/usr/bin/env node
/**
 * Generates Expo Router bridge files so all 174 Einzelseiten-Prompt routes resolve
 * to functional CareSuite+ screens (redirect or screen re-export).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');
const routesJson = join(root, 'tmp-einzelseiten-routes.json');
const mapOut = join(root, 'src/lib/navigation/einzelseiten-route-map.json');

const CLIENT_TAB_SUFFIX = {
  edit: { tab: 'stammdaten' },
  documents: { tab: 'dokumente' },
  contracts: { tab: 'vertrag' },
  consents: { tab: 'einwilligungen' },
  care: { tab: 'pflege' },
  billing: { tab: 'abrechnung' },
  modules: { tab: 'module' },
  portal: { tab: 'portal' },
  timeline: { tab: 'verlauf' },
  medical: { tab: 'icd' },
  medication: { tab: 'medikation' },
  vitals: { tab: 'vitalwerte' },
  'service-records': { tab: 'nachweise' },
  communication: { tab: 'nachrichten' },
};

/** Explicit prompt route → canonical target (no dynamic segments). */
const EXACT = {
  '/': '/',
  '/auth': '/auth',
  '/auth/business-login': '/auth/business-login',
  '/auth/employee-login': '/auth/employee-login',
  '/auth/employee-first-login': '/auth/employee-first-login',
  '/auth/portal-code-login': '/auth/portal-code-login',
  '/auth/register-business': '/auth/register-business',
  '/auth/forgot-password': '/auth/forgot-password',
  '/business/office/dashboard': '/office',
  '/business/office/clients': '/office/clients',
  '/business/office/clients/new': '/business/office/clients/new',
  '/business/office/employees': '/office/employees',
  '/business/office/employees/new': '/office/employees/create',
  '/business/office/documents': '/office/documents',
  '/business/office/documents/upload': '/office/documents/upload',
  '/business/office/documents/categories': '/office/catalogs',
  '/business/office/invoices': '/office/invoices',
  '/business/office/invoices/new': '/office/invoices/create',
  '/business/office/invoices/runs': '/business/office/modules/billing',
  '/business/office/invoices/payments': '/office/invoices',
  '/business/office/invoices/dunning': '/office/invoices',
  '/business/office/templates': '/business/office/modules/templates',
  '/business/office/templates/new': '/business/templates',
  '/business/office/templates/categories': '/business/templates',
  '/business/office/qm': '/business/office/qm',
  '/business/office/qm/manual': '/business/office/qm/handbook',
  '/business/office/qm/policies': '/business/office/qm/compliance',
  '/business/office/qm/audit-packages': '/business/office/qm/audits',
  '/business/office/qm/md-check': '/business/office/qm/md-audit',
  '/business/office/modules': '/business/office/modules',
  '/business/office/modules/clients': '/business/office/modules/clients',
  '/business/office/modules/employees': '/business/office/modules/employees',
  '/business/office/modules/services': '/business/office/modules/services',
  '/business/office/modules/documents': '/business/office/modules/documents',
  '/business/office/modules/templates': '/business/office/modules/templates',
  '/business/office/modules/permissions': '/business/office/modules/permissions',
  '/business/office/modules/billing': '/business/office/modules/billing',
  '/business/office/portals': '/business/office/access',
  '/business/office/portals/employees': '/business/office/access/employee-portal',
  '/business/office/portals/clients': '/business/office/access/client-portal',
  '/business/office/portals/relatives': '/business/office/access/relative-portal',
  '/business/office/portals/access-codes': '/business/office/access/employee-portal/new',
  '/business/office/permissions': '/business/office/modules/permissions',
  '/business/office/settings': '/business/office/settings',
  '/business/office/reporting': '/business/office/reporting',
  '/business/office/audit-log': '/business/office/audit-log',
  '/assist': '/assist',
  '/assist/einsaetze': '/assist/assignments',
  '/assist/einsaetze/new': '/assist/assignments',
  '/assist/nachweise': '/assist/nachweise',
  '/assist/fahrten': '/assist/fahrten',
  '/assist/kalender': '/assist/calendar',
  '/assist/durchfuehrung': '/assist/durchfuehrung',
  '/assist/aufgaben': '/assist/assignments',
  '/assist/signaturen': '/assist/nachweise',
  '/assist/touren': '/assist/fahrten',
  '/assist/live-status': '/assist/durchfuehrung',
  '/assist/qualitaet': '/assist/nachweise',
  '/assist/abrechnungsquellen': '/business/office/modules/billing',
  '/assist/einstellungen': '/assist',
  '/pflege': '/pflege',
  '/pflege/informationssammlung': '/pflege/sis',
  '/pflege/informationssammlung/new': '/pflege/sis/create',
  '/pflege/planung': '/pflege/plans',
  '/pflege/planung/new': '/pflege/plans/create',
  '/pflege/massnahmen': '/pflege/plans',
  '/pflege/berichte': '/pflege/dokumentation',
  '/pflege/berichte/new': '/pflege/dokumentation',
  '/pflege/vitalwerte': '/pflege/vitalwerte',
  '/pflege/vitalwerte/new': '/pflege/vitalwerte/create',
  '/pflege/medikation': '/pflege/medikation',
  '/pflege/medikation/new': '/pflege/medikation',
  '/pflege/wunden': '/pflege/wunddokumentation',
  '/pflege/wunden/new': '/pflege/wunddokumentation',
  '/pflege/bodymap': '/pflege/wunddokumentation',
  '/pflege/risiken': '/pflege/sis',
  '/pflege/assessments': '/pflege/sis',
  '/pflege/sis': '/pflege/sis',
  '/pflege/sis/new': '/pflege/sis/create',
  '/pflege/verordnungen': '/pflege/medikation',
  '/pflege/evaluation': '/pflege/plans',
  '/pflege/visiten': '/pflege/dokumentation',
  '/pflege/uebergaben': '/pflege/dokumentation',
  '/pflege/dienstplaene': '/pflege/dienstplaene',
  '/pflege/dienstplaene/new': '/pflege/dienstplaene',
  '/pflege/reports': '/pflege/auswertungen',
  '/pflege/einstellungen': '/pflege/settings',
  '/beratung': '/beratung',
  '/beratung/faelle': '/beratung/cases',
  '/beratung/faelle/new': '/beratung/cases',
  '/beratung/erstgespraech': '/beratung/cases',
  '/beratung/protokolle': '/beratung/protokolle',
  '/beratung/protokolle/new': '/beratung/protokolle',
  '/beratung/massnahmen': '/beratung/cases',
  '/beratung/wiedervorlagen': '/beratung/wiedervorlagen',
  '/beratung/leistungsberatung': '/beratung/cases',
  '/beratung/angehoerige': '/beratung/cases',
  '/beratung/kontaktverlauf': '/beratung/protokolle',
  '/beratung/berichte': '/beratung/auswertungen',
  '/beratung/abrechnungsquellen': '/business/office/modules/billing',
  '/beratung/einstellungen': '/beratung/settings',
  '/stationaer': '/stationaer',
  '/stationaer/bewohner': '/stationaer/bewohner',
  '/stationaer/wohnbereiche': '/stationaer/wohnbereiche',
  '/stationaer/zimmer': '/stationaer/wohnbereiche',
  '/stationaer/belegung': '/stationaer/wohnbereiche',
  '/stationaer/tagesstruktur': '/stationaer/bewohner',
  '/stationaer/mahlzeiten': '/stationaer/bewohner',
  '/stationaer/aktivitaeten': '/stationaer/bewohner',
  '/stationaer/uebergabe': '/stationaer/uebergabebericht',
  '/stationaer/risiken': '/stationaer/auswertungen',
  '/stationaer/bewohnerplanung': '/stationaer/bewohner',
  '/stationaer/reports': '/stationaer/auswertungen',
  '/stationaer/einstellungen': '/stationaer/settings',
  '/akademie': '/akademie',
  '/akademie/kurse': '/akademie/courses',
  '/akademie/kurse/new': '/akademie/courses',
  '/akademie/lektionen': '/akademie/courses',
  '/akademie/teilnehmende': '/akademie/teilnehmer',
  '/akademie/pruefungen': '/akademie/courses',
  '/akademie/zertifikate': '/akademie/zertifikate',
  '/akademie/pflichtschulungen': '/akademie/courses',
  '/akademie/schulungsplan': '/akademie/courses',
  '/akademie/mediathek': '/akademie/courses',
  '/akademie/dozenten': '/akademie/teilnehmer',
  '/akademie/fortschritt': '/akademie/teilnehmer',
  '/akademie/reports': '/akademie/auswertungen',
  '/akademie/einstellungen': '/akademie/settings',
  '/business/messages': '/business/messages',
  '/business/messages/archived': '/business/messages/archived',
  '/business/documents': '/office/documents',
  '/business/qm': '/business/office/qm',
  '/business/insight': '/insight',
  '/business/settings': '/business/office/settings',
  '/business/ti': '/business/ti',
  '/portal/employee': '/portal/employee',
  '/portal/client': '/portal/client',
  '/portal/relative': '/portal/relative',
};

function resolvePromptRoute(promptRoute) {
  if (EXACT[promptRoute]) {
    return { target: EXACT[promptRoute], tab: null };
  }

  const clientSub = promptRoute.match(
    /^\/business\/office\/clients\/\[id\]\/(.+)$/,
  );
  if (clientSub) {
    const suffix = clientSub[1];
    if (suffix === 'edit') {
      return { target: '/office/clients/[id]/edit', tab: null };
    }
    const tabInfo = CLIENT_TAB_SUFFIX[suffix];
    if (tabInfo) {
      return { target: '/business/office/clients/[id]', tab: tabInfo.tab };
    }
  }

  if (promptRoute === '/business/office/clients/[id]') {
    return { target: '/business/office/clients/[id]', tab: null };
  }

  if (promptRoute === '/business/office/employees/[id]') {
    return { target: '/office/employees/[id]', tab: null };
  }
  if (promptRoute === '/business/office/employees/[id]/edit') {
    return { target: '/office/employees/[id]/edit', tab: null };
  }

  if (promptRoute === '/business/office/documents/[id]') {
    return { target: '/office/documents', tab: null };
  }
  if (promptRoute === '/business/office/templates/[id]') {
    return { target: '/business/templates/[id]', tab: null };
  }
  if (promptRoute === '/business/office/invoices/[id]') {
    return { target: '/office/invoices/[id]', tab: null };
  }
  if (promptRoute === '/business/office/qm/manual/[id]') {
    return { target: '/business/office/qm/handbook/[id]', tab: null };
  }

  if (promptRoute === '/assist/einsaetze/[id]') {
    return { target: '/assist/assignments/[id]', tab: null };
  }
  if (promptRoute === '/assist/einsaetze/[id]/edit') {
    return { target: '/assist/assignments/[id]', tab: null };
  }
  if (promptRoute === '/assist/durchfuehrung/[id]') {
    return { target: '/assist/assignments/[id]/execute', tab: null };
  }
  if (promptRoute === '/assist/nachweise/[id]') {
    return { target: '/assist/nachweise/[id]', tab: null };
  }

  if (promptRoute === '/pflege/informationssammlung/[id]') {
    return { target: '/pflege/sis/[id]', tab: null };
  }
  if (promptRoute === '/pflege/planung/[id]') {
    return { target: '/pflege/plans/[id]', tab: null };
  }
  if (promptRoute === '/pflege/planung/[id]/edit') {
    return { target: '/pflege/plans/[id]', tab: null };
  }
  if (promptRoute === '/pflege/berichte/[id]') {
    return { target: '/pflege/dokumentation/[id]', tab: null };
  }
  if (promptRoute === '/pflege/wunden/[id]') {
    return { target: '/pflege/wunddokumentation/[id]', tab: null };
  }
  if (promptRoute === '/pflege/sis/[id]') {
    return { target: '/pflege/sis/[id]', tab: null };
  }

  if (promptRoute === '/beratung/faelle/[id]') {
    return { target: '/beratung/cases/[id]', tab: null };
  }
  if (promptRoute === '/beratung/faelle/[id]/edit') {
    return { target: '/beratung/cases/[id]', tab: null };
  }
  if (promptRoute === '/beratung/protokolle/[id]') {
    return { target: '/beratung/protokolle/[id]', tab: null };
  }

  if (promptRoute === '/stationaer/bewohner/[id]') {
    return { target: '/stationaer/bewohner/[id]', tab: null };
  }

  if (promptRoute === '/akademie/kurse/[id]') {
    return { target: '/akademie/courses/[id]', tab: null };
  }

  if (promptRoute === '/business/messages/[threadId]') {
    return { target: '/business/messages', tab: null };
  }

  return { target: promptRoute, tab: null };
}

function routeToAppRelative(routePath) {
  return routePath.replace(/^\//, '');
}

function bridgeFileExists(relativePath) {
  const base = join(appRoot, relativePath);
  if (existsSync(`${base}.tsx`)) return true;
  if (existsSync(join(base, 'index.tsx'))) return true;
  return false;
}

function writeBridge(relativePath, content) {
  const full = join(appRoot, `${relativePath}.tsx`);
  mkdirSync(dirname(full), { recursive: true });
  if (existsSync(full)) {
    const existing = readFileSync(full, 'utf8');
    if (!existing.includes('Einzelseiten-Bridge:')) return false;
  }
  writeFileSync(full, content, 'utf8');
  return true;
}

function bridgeSource(entry) {
  const { prompt, target, tab } = entry;
  if (prompt === target && !tab) return null;

  if (tab) {
    return `import { Redirect, useLocalSearchParams } from 'expo-router';

/** Einzelseiten-Bridge: ${prompt} → ${target}?tab=${tab} */
export default function EinzelseitenBridgeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect
      href={{
        pathname: '${target}',
        params: { id: id ?? '', tab: '${tab}' },
      } as never}
    />
  );
}
`;
  }

  if (target.includes('[id]') || target.includes('[threadId]')) {
    const paramName = target.includes('[threadId]') ? 'threadId' : 'id';
    const paramsType =
      paramName === 'id' ? '{ id?: string }' : '{ threadId?: string; id?: string }';
    const valueExpr = paramName === 'id' ? 'params.id ?? \'\'' : 'params.threadId ?? params.id ?? \'\'';
    const paramsLine =
      paramName === 'id'
        ? `params: { id: value },`
        : `params: { ${paramName}: value },`;
    return `import { Redirect, useLocalSearchParams } from 'expo-router';

/** Einzelseiten-Bridge: ${prompt} → ${target} */
export default function EinzelseitenBridgeRoute() {
  const params = useLocalSearchParams<${paramsType}>();
  const value = ${valueExpr};
  return (
    <Redirect
      href={{
        pathname: '${target}',
        ${paramsLine}
      } as never}
    />
  );
}
`;
  }

  return `import { Redirect } from 'expo-router';

/** Einzelseiten-Bridge: ${prompt} → ${target} */
export default function EinzelseitenBridgeRoute() {
  return <Redirect href={'${target}' as never} />;
}
`;
}

const prompts = JSON.parse(readFileSync(routesJson, 'utf8'));
const mapEntries = [];
let created = 0;
let skipped = 0;

for (const { id, route: prompt } of prompts) {
  if (!prompt) continue;
  const { target, tab } = resolvePromptRoute(prompt);
  mapEntries.push({ id, prompt, target, tab });

  const relative = routeToAppRelative(prompt);
  if (prompt === target && !tab) {
    skipped += 1;
    continue;
  }

  const source = bridgeSource({ prompt, target, tab });
  if (!source) continue;

  if (writeBridge(relative, source)) {
    created += 1;
  } else {
    skipped += 1;
  }
}

writeFileSync(mapOut, JSON.stringify(mapEntries, null, 2));
console.log(`Einzelseiten map: ${mapEntries.length} entries`);
console.log(`Bridge files created: ${created}, skipped: ${skipped}`);
