import type { RoleKey, ServiceResult } from '@/types';
import type { MainModuleKey } from '@/types/navigation/platform';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import { fetchAppointmentList } from '@/lib/office/appointmentListService';
import { fetchInvoiceList } from '@/lib/office/invoiceListService';
import { fetchOfficeDocumentList } from '@/lib/office/officeDocumentsService';
import { fetchOfficeMessageThreads } from '@/lib/office/messagethreadservice';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { fetchExecutionList } from '@/lib/assist/executionListService';
import { fetchTripLogList } from '@/lib/assist/tripLogService';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchCounselingCaseList } from '@/lib/beratung/caseListService';
import { fetchCourseList } from '@/lib/akademie/courseListService';
import { fetchResidentList } from '@/lib/stationaer/residentListService';
import { listThreads } from '@/features/communication/communication.service';
import {
  getActiveOverviewModuleKeys,
  MAIN_MODULE_RAIL,
  type ModuleNavContext,
} from '@/lib/navigation/mainmodulerail';
import { matchesSearchQuery, normalizeSearchQuery, sortBySearchRelevance } from './tenantSearchMatch';
import { resolveTenantSearchHref } from './tenantSearchRoutes';
import type {
  TenantSearchEntityKind,
  TenantSearchResponse,
  TenantSearchResultItem,
} from './tenantSearchTypes';

export type TenantSearchContext = ModuleNavContext & {
  actorRoleKey?: RoleKey | null;
  profileId?: string | null;
};

const MAX_RESULTS_PER_KIND = 12;
const MAX_TOTAL_RESULTS = 80;

function moduleLabel(moduleKey: MainModuleKey): string {
  return MAIN_MODULE_RAIL.find((item) => item.key === moduleKey)?.label ?? moduleKey;
}

function buildResult(
  kind: TenantSearchEntityKind,
  moduleKey: MainModuleKey,
  id: string,
  title: string,
  subtitle?: string,
  routeOptions?: { clientId?: string | null; assignmentId?: string | null },
): TenantSearchResultItem {
  return {
    id,
    kind,
    title,
    subtitle,
    moduleKey,
    moduleLabel: moduleLabel(moduleKey),
    href: resolveTenantSearchHref(kind, id, routeOptions),
  };
}

function takeResults(items: TenantSearchResultItem[]): TenantSearchResultItem[] {
  return items.slice(0, MAX_RESULTS_PER_KIND);
}

async function collectOk<T>(result: ServiceResult<T[]>): Promise<T[]> {
  return result.ok ? result.data : [];
}

function isOfficeModuleActive(activeModules: MainModuleKey[]): boolean {
  return activeModules.includes('office');
}

async function searchOfficeEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const [
    clients,
    employees,
    appointments,
    invoices,
    documents,
    officeMessages,
  ] = await Promise.all([
    fetchClientList(tenantId, actorRoleKey, { search: query, lifecycleFilter: 'all' }),
    fetchEmployeeList(tenantId, actorRoleKey),
    fetchAppointmentList(tenantId, actorRoleKey),
    fetchInvoiceList(tenantId, actorRoleKey),
    fetchOfficeDocumentList(tenantId, actorRoleKey),
    fetchOfficeMessageThreads(tenantId, actorRoleKey),
  ]);

  const results: TenantSearchResultItem[] = [];

  const clientItems = sortBySearchRelevance(
    query,
    (await collectOk(clients)).filter((client) =>
      matchesSearchQuery(
        query,
        client.firstName,
        client.lastName,
        `${client.firstName} ${client.lastName}`,
        client.city,
        client.zip,
        client.costCarrier,
      ),
    ),
    (client) => [client.firstName, client.lastName, client.city, client.costCarrier],
  );
  results.push(
    ...takeResults(
      clientItems.map((client) =>
        buildResult(
          'client',
          'office',
          client.id,
          `${client.firstName} ${client.lastName}`.trim(),
          client.city ?? undefined,
        ),
      ),
    ),
  );

  const employeeItems = sortBySearchRelevance(
    query,
    (await collectOk(employees)).filter((employee) =>
      matchesSearchQuery(
        query,
        employee.firstName,
        employee.lastName,
        `${employee.firstName} ${employee.lastName}`,
        employee.jobTitle,
        employee.email,
        employee.phone,
      ),
    ),
    (employee) => [employee.firstName, employee.lastName, employee.jobTitle, employee.email],
  );
  results.push(
    ...takeResults(
      employeeItems.map((employee) =>
        buildResult(
          'employee',
          'office',
          employee.id,
          `${employee.firstName} ${employee.lastName}`.trim(),
          employee.jobTitle ?? undefined,
        ),
      ),
    ),
  );

  const appointmentItems = sortBySearchRelevance(
    query,
    (await collectOk(appointments)).filter((appointment) =>
      matchesSearchQuery(
        query,
        appointment.title,
        appointment.clientName,
        appointment.employeeName,
        appointment.location,
      ),
    ),
    (appointment) => [appointment.title, appointment.clientName, appointment.employeeName],
  );
  results.push(
    ...takeResults(
      appointmentItems.map((appointment) =>
        buildResult(
          'appointment',
          'office',
          appointment.id,
          appointment.title,
          appointment.clientName ?? undefined,
        ),
      ),
    ),
  );

  const invoiceItems = sortBySearchRelevance(
    query,
    (await collectOk(invoices)).filter((invoice) =>
      matchesSearchQuery(
        query,
        invoice.invoiceNumber,
        invoice.clientName,
        invoice.status,
      ),
    ),
    (invoice) => [invoice.invoiceNumber, invoice.clientName],
  );
  results.push(
    ...takeResults(
      invoiceItems.map((invoice) =>
        buildResult(
          'invoice',
          'office',
          invoice.id,
          invoice.invoiceNumber,
          invoice.clientName ?? undefined,
        ),
      ),
    ),
  );

  const documentItems = sortBySearchRelevance(
    query,
    (await collectOk(documents)).filter((document) =>
      matchesSearchQuery(query, document.title, document.fileName, document.category),
    ),
    (document) => [document.title, document.fileName, document.category],
  );
  results.push(
    ...takeResults(
      documentItems.map((document) =>
        buildResult('document', 'office', document.id, document.title, document.category),
      ),
    ),
  );

  const officeMessageItems = sortBySearchRelevance(
    query,
    (await collectOk(officeMessages)).filter((thread) =>
      matchesSearchQuery(
        query,
        thread.subject,
        thread.lastMessagePreview,
        thread.clientName,
        thread.employeeName,
        thread.participantName,
        thread.categoryLabel,
      ),
    ),
    (thread) => [
      thread.subject,
      thread.lastMessagePreview,
      thread.clientName,
      thread.employeeName,
      thread.participantName,
    ],
  );
  results.push(
    ...takeResults(
      officeMessageItems.map((thread) =>
        buildResult(
          'office_message',
          'office',
          thread.id,
          thread.subject ||
            thread.clientName ||
            thread.employeeName ||
            thread.participantName ||
            'Office-Nachricht',
          thread.lastMessagePreview ?? undefined,
        ),
      ),
    ),
  );

  return results;
}

async function searchAssistEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const [assignments, executions, trips] = await Promise.all([
    fetchAssignmentList(tenantId, actorRoleKey),
    fetchExecutionList(tenantId, actorRoleKey),
    fetchTripLogList(tenantId, actorRoleKey),
  ]);

  const results: TenantSearchResultItem[] = [];

  const assignmentItems = sortBySearchRelevance(
    query,
    (await collectOk(assignments)).filter((assignment) =>
      matchesSearchQuery(
        query,
        assignment.title,
        assignment.clientName,
        assignment.employeeName,
        assignment.location,
        assignment.serviceName,
      ),
    ),
    (assignment) => [assignment.title, assignment.clientName, assignment.employeeName],
  );
  results.push(
    ...takeResults(
      assignmentItems.map((assignment) =>
        buildResult(
          'assignment',
          'assist',
          assignment.id,
          assignment.title,
          assignment.clientName ?? undefined,
        ),
      ),
    ),
  );

  const executionItems = sortBySearchRelevance(
    query,
    (await collectOk(executions)).filter((execution) =>
      matchesSearchQuery(query, execution.title, execution.clientName, execution.location),
    ),
    (execution) => [execution.title, execution.clientName, execution.location],
  );
  results.push(
    ...takeResults(
      executionItems.map((execution) =>
        buildResult(
          'execution',
          'assist',
          execution.assignmentId,
          execution.title,
          execution.clientName ?? undefined,
          { assignmentId: execution.assignmentId },
        ),
      ),
    ),
  );

  const tripItems = sortBySearchRelevance(
    query,
    (await collectOk(trips)).filter((trip) =>
      matchesSearchQuery(
        query,
        trip.purpose,
        trip.routeSummary,
        trip.employeeName,
        trip.vehicleLabel,
      ),
    ),
    (trip) => [trip.purpose, trip.routeSummary, trip.employeeName, trip.vehicleLabel],
  );
  results.push(
    ...takeResults(
      tripItems.map((trip) =>
        buildResult(
          'trip',
          'assist',
          trip.id,
          trip.routeSummary || trip.purpose || 'Fahrt',
          trip.employeeName ?? undefined,
        ),
      ),
    ),
  );

  return results;
}

async function searchPflegeEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const carePlans = await fetchCarePlanList(tenantId, actorRoleKey);
  const planItems = sortBySearchRelevance(
    query,
    (await collectOk(carePlans)).filter((plan) =>
      matchesSearchQuery(query, plan.title, plan.clientName, plan.careLevel),
    ),
    (plan) => [plan.title, plan.clientName],
  );
  return takeResults(
    planItems.map((plan) =>
      buildResult('care_plan', 'pflege', plan.id, plan.title, plan.clientName ?? undefined),
    ),
  );
}

async function searchBeratungEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const cases = await fetchCounselingCaseList(tenantId, actorRoleKey);
  const caseItems = sortBySearchRelevance(
    query,
    (await collectOk(cases)).filter((item) =>
      matchesSearchQuery(
        query,
        item.subject,
        item.clientName,
        item.counselorName,
        item.category,
      ),
    ),
    (item) => [item.subject, item.clientName, item.counselorName],
  );
  return takeResults(
    caseItems.map((item) =>
      buildResult('case', 'beratung', item.id, item.subject, item.clientName ?? undefined),
    ),
  );
}

async function searchAkademieEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const courses = await fetchCourseList(tenantId, actorRoleKey);
  const courseItems = sortBySearchRelevance(
    query,
    (await collectOk(courses)).filter((course) =>
      matchesSearchQuery(query, course.title, course.category),
    ),
    (course) => [course.title, course.category],
  );
  return takeResults(
    courseItems.map((course) =>
      buildResult('course', 'akademie', course.id, course.title, course.category),
    ),
  );
}

async function searchStationaerEntities(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<TenantSearchResultItem[]> {
  const residents = await fetchResidentList(tenantId, actorRoleKey);
  const residentItems = sortBySearchRelevance(
    query,
    (await collectOk(residents)).filter((resident) =>
      matchesSearchQuery(
        query,
        resident.firstName,
        resident.lastName,
        `${resident.firstName} ${resident.lastName}`,
        resident.roomName,
        resident.careLevel,
      ),
    ),
    (resident) => [resident.firstName, resident.lastName, resident.roomName],
  );
  return takeResults(
    residentItems.map((resident) =>
      buildResult(
        'resident',
        'stationaer',
        resident.id,
        `${resident.firstName} ${resident.lastName}`.trim(),
        resident.roomName ?? undefined,
      ),
    ),
  );
}

async function searchCommunicationCenter(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<TenantSearchResultItem[]> {
  const threads = await listThreads(tenantId, { search: query }, actorRoleKey, profileId ?? undefined);
  const threadItems = sortBySearchRelevance(
    query,
    (await collectOk(threads)).filter((thread) =>
      matchesSearchQuery(query, thread.title, thread.previewText, thread.participantLabel),
    ),
    (thread) => [thread.title, thread.previewText, thread.participantLabel],
  );
  return takeResults(
    threadItems.map((thread) =>
      buildResult(
        'communication',
        'zentrale',
        thread.id,
        thread.title,
        thread.previewText ?? undefined,
      ),
    ),
  );
}

export function resolveActiveTenantSearchModules(
  context: TenantSearchContext,
): MainModuleKey[] {
  const active = getActiveOverviewModuleKeys(context);
  return active;
}

/** Cross-module tenant search — only queries modules enabled for the tenant. */
export async function searchTenant(
  tenantId: string,
  query: string,
  context: TenantSearchContext,
): Promise<ServiceResult<TenantSearchResponse>> {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return { ok: false, error: 'Bitte einen Suchbegriff eingeben.' };
  }

  if (!tenantId?.trim()) {
    return { ok: false, error: 'Kein Mandant ausgewählt.' };
  }

  const activeModules = resolveActiveTenantSearchModules(context);
  const tasks: Promise<TenantSearchResultItem[]>[] = [];

  if (isOfficeModuleActive(activeModules)) {
    tasks.push(searchOfficeEntities(tenantId, query, context.actorRoleKey));
  }
  if (activeModules.includes('assist')) {
    tasks.push(searchAssistEntities(tenantId, query, context.actorRoleKey));
  }
  if (activeModules.includes('pflege')) {
    tasks.push(searchPflegeEntities(tenantId, query, context.actorRoleKey));
  }
  if (activeModules.includes('beratung')) {
    tasks.push(searchBeratungEntities(tenantId, query, context.actorRoleKey));
  }
  if (activeModules.includes('akademie')) {
    tasks.push(searchAkademieEntities(tenantId, query, context.actorRoleKey));
  }
  if (activeModules.includes('stationaer')) {
    tasks.push(searchStationaerEntities(tenantId, query, context.actorRoleKey));
  }

  tasks.push(
    searchCommunicationCenter(
      tenantId,
      query,
      context.actorRoleKey,
      context.profileId,
    ),
  );

  const chunks = await Promise.all(tasks);
  const merged = chunks.flat().slice(0, MAX_TOTAL_RESULTS);

  return {
    ok: true,
    data: {
      query: query.trim(),
      results: merged,
    },
  };
}

export type { TenantModuleSettings };
