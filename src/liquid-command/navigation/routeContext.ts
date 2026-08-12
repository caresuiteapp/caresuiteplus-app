import { liquidWorkAreas } from './moduleCatalog';
import type { LiquidModuleKey } from '../types';

type RouteAlias = {
  area: string;
  pattern: RegExp;
};

const routeAliases: Partial<Record<LiquidModuleKey, readonly RouteAlias[]>> = {
  office: [
    { area: 'communication', pattern: /^\/(?:business\/)?(?:office\/)?messages(?:\/|$)/ },
    { area: 'timekeeping', pattern: /^\/business\/office\/time-tracking(?:\/|$)/ },
    { area: 'payroll', pattern: /^\/business\/office\/payroll(?:\/|$)/ },
    { area: 'clients', pattern: /^\/(?:business\/)?office\/clients(?:\/|$)/ },
    { area: 'people', pattern: /^\/(?:business\/)?office\/(?:employees|personal|recruiting)(?:\/|$)/ },
    { area: 'billing', pattern: /^\/(?:business\/)?office\/(?:invoices|billing|payments|budgets|catalogs)(?:\/|$)/ },
    { area: 'documents', pattern: /^\/(?:business\/)?office\/documents(?:\/|$)/ },
    { area: 'portals', pattern: /^\/business\/office\/(?:portals|access|permissions)(?:\/|$)/ },
    { area: 'inventory', pattern: /^\/(?:business\/)?office\/inventory(?:\/|$)/ },
    { area: 'audit', pattern: /^\/(?:business\/)?office\/(?:audit|qm|reporting)(?:\/|$)/ },
  ],
  assist: [
    { area: 'live', pattern: /^\/assist\/live-status(?:\/|$)/ },
    { area: 'planning', pattern: /^\/assist\/(?:calendar|kalender|touren|touren-vertretung)(?:\/|$)/ },
    { area: 'proofs', pattern: /^\/assist\/(?:nachweise|signaturen)(?:\/|$)/ },
    { area: 'budgets', pattern: /^\/assist\/abrechnungsquellen(?:\/|$)/ },
    { area: 'portals', pattern: /^\/assist\/(?:portale|portal-preview)(?:\/|$)/ },
    { area: 'clients', pattern: /^\/assist\/zugeordnete-klienten(?:\/|$)/ },
    { area: 'assignments', pattern: /^\/assist\/(?:einsaetze|assignments|execution|durchfuehrung|aufgaben|fahrten)(?:\/|$)/ },
  ],
  pflege: [
    { area: 'sis', pattern: /^\/pflege\/(?:sis|informationssammlung)(?:\/|$)/ },
    { area: 'measures', pattern: /^\/pflege\/(?:planung|plans|massnahmen|evaluation|dienstplaene)(?:\/|$)/ },
    { area: 'medication', pattern: /^\/pflege\/medikation(?:\/|$)/ },
    { area: 'diagnoses', pattern: /^\/(?:pflege\/(?:diagnosen|verordnungen)|medical)(?:\/|$)/ },
    { area: 'wounds', pattern: /^\/pflege\/(?:bodymap|wund[^/]*)(?:\/|$)/ },
    { area: 'vitals', pattern: /^\/pflege\/vitalwerte(?:\/|$)/ },
    { area: 'reports', pattern: /^\/pflege\/(?:berichte|reports|uebergaben|visiten|risiken)(?:\/|$)/ },
  ],
  stationaer: [
    { area: 'residents', pattern: /^\/stationaer\/bewohner(?:\/|$)/ },
    { area: 'wards', pattern: /^\/stationaer\/(?:wohnbereiche|zimmer)(?:\/|$)/ },
    { area: 'shifts', pattern: /^\/stationaer\/bewohnerplanung(?:\/|$)/ },
    { area: 'handover', pattern: /^\/stationaer\/uebergabe(?:bericht)?(?:\/|$)/ },
    { area: 'occupancy', pattern: /^\/stationaer\/belegung(?:\/|$)/ },
    { area: 'services', pattern: /^\/stationaer\/(?:tagesstruktur|aktivitaeten|mahlzeiten|bodymap|risiken)(?:\/|$)/ },
  ],
  beratung: [
    { area: 'cases', pattern: /^\/beratung\/(?:faelle|cases|zugeordnete-klienten)(?:\/|$)/ },
    { area: 'appointments', pattern: /^\/beratung\/(?:calendar|kalender)(?:\/|$)/ },
    { area: 'assessments', pattern: /^\/beratung\/erstgespraech(?:\/|$)/ },
    { area: 'recommendations', pattern: /^\/beratung\/(?:massnahmen|leistungsberatung)(?:\/|$)/ },
    { area: 'proofs', pattern: /^\/beratung\/(?:protokolle|berichte|kontaktverlauf)(?:\/|$)/ },
    { area: 'follow-up', pattern: /^\/beratung\/wiedervorlagen(?:\/|$)/ },
  ],
  akademie: [
    { area: 'paths', pattern: /^\/akademie\/(?:schulungsplan|fortschritt|lektionen|teilnehm|dozenten)(?:\/|$)/ },
    { area: 'courses', pattern: /^\/akademie\/(?:kurse|courses|mediathek|calendar|kalender)(?:\/|$)/ },
    { area: 'exams', pattern: /^\/akademie\/pruefungen(?:\/|$)/ },
    { area: 'certificates', pattern: /^\/akademie\/zertifikate(?:\/|$)/ },
    { area: 'mandatory', pattern: /^\/akademie\/(?:pflichtschulungen|auswertungen|reports)(?:\/|$)/ },
  ],
  platform: [
    { area: 'tenants', pattern: /^\/platform\/tenants(?:\/|$)/ },
    { area: 'plans', pattern: /^\/platform\/(?:plans|discounts|modules|addons)(?:\/|$)/ },
    { area: 'billing', pattern: /^\/platform\/(?:billing|payments)(?:\/|$)/ },
    { area: 'flags', pattern: /^\/platform\/feature-flags(?:\/|$)/ },
    { area: 'support', pattern: /^\/platform\/(?:support|users|system|bodymap-review)(?:\/|$)/ },
    { area: 'releases', pattern: /^\/platform\/releases(?:\/|$)/ },
    { area: 'audit', pattern: /^\/platform\/audit(?:\/|$)/ },
  ],
  settings: [
    { area: 'organization', pattern: /^\/settings\/tenant(?:\/|$)/ },
    { area: 'roles', pattern: /^\/business\/office\/permissions(?:\/|$)/ },
    { area: 'integrations', pattern: /^\/business\/(?:connect|integrations)(?:\/|$)/ },
    { area: 'privacy', pattern: /^\/settings\/(?:data-request|account-deletion)(?:\/|$)/ },
    { area: 'templates', pattern: /^\/business\/templates(?:\/|$)/ },
    { area: 'branding', pattern: /^\/settings\/appearance(?:\/|$)/ },
  ],
};

function routePath(route: string): string {
  return route.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
}

export function inferLiquidArea(pathname: string, moduleKey: LiquidModuleKey): string | null {
  const normalized = routePath(pathname.toLowerCase());
  const canonical = [...liquidWorkAreas[moduleKey]]
    .sort((left, right) => routePath(right.route).length - routePath(left.route).length)
    .find((area) => {
      const areaPath = routePath(area.route.toLowerCase());
      return normalized === areaPath || normalized.startsWith(`${areaPath}/`);
    });
  if (canonical) return canonical.id;
  return routeAliases[moduleKey]?.find((alias) => alias.pattern.test(normalized))?.area ?? null;
}

export function describeLiquidRoute(pathname: string, moduleKey: LiquidModuleKey): {
  areaId: string | null;
  contextLabel: string;
  contextDetail: string;
} {
  const areaId = inferLiquidArea(pathname, moduleKey);
  const area = liquidWorkAreas[moduleKey].find((candidate) => candidate.id === areaId);
  const leaf = routePath(pathname)
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return {
    areaId,
    contextLabel: area?.label ?? 'Facharbeitsbereich',
    contextDetail: area?.description ?? leaf ?? 'Produktiver CareSuite-Workflow',
  };
}
