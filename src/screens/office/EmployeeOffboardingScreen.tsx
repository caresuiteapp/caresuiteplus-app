import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenShell } from "@/components/layout";
import { CareDateInput } from "@/components/inputs";
import { LockedActionBanner } from "@/components/permissions";
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from "@/components/ui";
import { useAsyncQuery } from "@/hooks/core/useAsyncQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useServiceTenantId } from "@/hooks/useTenantId";
import { useAuth } from "@/lib/auth/context";
import {
  archiveOffboardingPersonnelFile,
  assignOffboardingResponsible,
  buildOffboardingIntegrationSnapshot,
  completeOffboardingFinalClearance,
  fetchOffboardingAuditTrail,
  fetchOffboardingProgress,
  fetchEmployeeOffboardingProductionGate,
  generateOffboardingCompletionProtocol,
  lockOffboardingPortalAccess,
  markOffboardingManualStep,
  prepareOffboardingExternalAccess,
  recordOffboardingReturn,
  refreshOffboardingChecks,
  saveOffboardingExitDetails,
  startOffboardingSession,
} from "@/lib/office/offboarding";
import { getServiceMode } from "@/lib/services/mode";
import { fetchEmployeePersonnelFile } from "@/lib/office/employeePersonnelFileService";
import {
  deleteEmployeePersonnelDocument,
  uploadEmployeePersonnelDocument,
} from "@/lib/office/employeePersonnelUpdateService";
import {
  OFFBOARDING_STEP_LABELS,
  TERMINATION_TYPE_LABELS,
  type OffboardingStepKey,
  type OffboardingStepStatus,
  type TerminationType,
} from "@/types/modules/employeeOffboarding";
import type { ServiceResult } from "@/types";
import type {
  EmployeeDocumentCategory,
  EmployeeDocumentRecord,
} from "@/types/modules/employeePersonnelFile";
import { radius, spacing, typography } from "@/theme";

const TERMINATION_TYPES = Object.entries(TERMINATION_TYPE_LABELS) as [
  TerminationType,
  string,
][];

const OVERALL_STATUS_LABELS = {
  not_started: "Noch nicht begonnen",
  in_progress: "In Bearbeitung",
  blocked: "Blockiert",
  ready_for_clearance: "Endfreigabe erfolgt",
  completed: "Vollständig archiviert",
  reopened: "Wieder geöffnet",
} as const;

const STEP_STATUS_LABELS: Record<OffboardingStepStatus, string> = {
  pending: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Erledigt",
  blocked: "Blockiert",
  skipped: "Übersprungen",
  not_applicable: "Nicht erforderlich",
};

const MANUAL_STEPS = new Set<OffboardingStepKey>([
  "completion_documents",
  "reference_prepared",
  "payroll_export_prepared",
]);

const WORKFLOW_PHASES: {
  key: string;
  number: number;
  title: string;
  subtitle: string;
  steps: OffboardingStepKey[];
}[] = [
  {
    key: "termination",
    number: 1,
    title: "Beendigung rechtssicher erfassen",
    subtitle: "Austritt, Beendigungsart und interner Vorgang",
    steps: ["exit_date", "termination_type"],
  },
  {
    key: "operations",
    number: 2,
    title: "Versorgung und Betrieb übergeben",
    subtitle: "Einsätze, Vertretung, Dokumentation und Unterschriften",
    steps: [
      "open_assignments",
      "replacement_required",
      "open_documentation",
      "open_corrections",
      "open_signatures",
    ],
  },
  {
    key: "payroll",
    number: 3,
    title: "Arbeitszeit und Entgelt abschließen",
    subtitle: "Zeitkonto, Auslagen und Lohnexport",
    steps: ["work_time_closure", "payroll_export_prepared"],
  },
  {
    key: "access",
    number: 4,
    title: "Eigentum und Zugänge sichern",
    subtitle: "Inventar, Schlüssel, Geräte, Portal und externe Systeme",
    steps: [
      "inventory_return",
      "uniform",
      "keys_access",
      "devices",
      "lock_portal_access",
      "external_access_prepared",
    ],
  },
  {
    key: "archive",
    number: 5,
    title: "Unterlagen freigeben und archivieren",
    subtitle: "Dokumentenpaket, Zeugnis, Protokoll und Personalakte",
    steps: [
      "completion_documents",
      "reference_prepared",
      "return_protocol",
      "final_clearance",
      "archiving",
    ],
  },
];

const STEP_DESCRIPTIONS: Record<OffboardingStepKey, string> = {
  exit_date:
    "Letzten Beschäftigungstag verbindlich und nachvollziehbar festhalten.",
  termination_type:
    "Beendigungsart, Zugang des Schreibens und Besonderheiten dokumentieren.",
  open_assignments:
    "Laufende und zukünftige Einsätze beenden oder einer Vertretung zuordnen.",
  replacement_required:
    "Versorgungskontinuität für alle betroffenen Klient:innen bestätigen.",
  open_documentation:
    "Alle Einsatzdokumentationen vollständig und prüfbar abschließen.",
  open_corrections:
    "Rückfragen, Zeitkorrekturen und fachliche Beanstandungen auflösen.",
  open_signatures:
    "Pflichtunterschriften abschließen oder kontrolliert ins Klientenportal geben.",
  work_time_closure:
    "Offene Zeitsitzungen, Pausen, Fahrzeiten und Zeitkonto abstimmen.",
  payroll_export_prepared:
    "Schlussabrechnung mit Zuschlägen, Auslagen und Restansprüchen vorbereiten.",
  inventory_return:
    "Zugeordnetes Firmeneigentum vollständig zurücknehmen und Zustand erfassen.",
  uniform:
    "Dienstkleidung vollständig zurücknehmen oder Verlust dokumentieren.",
  keys_access:
    "Schlüssel, Transponder, Karten und physische Zutrittsrechte entziehen.",
  devices:
    "Telefone, Tablets, Zubehör und lokale Unternehmensdaten zurücknehmen.",
  lock_portal_access:
    "Portal sperren, aktive Sitzungen widerrufen und Push-Geräte deaktivieren.",
  external_access_prepared:
    "E-Mail, Telefonie und Cloud beim verbundenen Provider sperren oder nachweisbar vorbereiten.",
  completion_documents:
    "Alle gesetzlichen und betrieblichen Abschlussunterlagen zusammenstellen.",
  reference_prepared:
    "Arbeitszeugnis erstellen, prüfen und zur Ausgabe vorbereiten.",
  return_protocol:
    "Rückgaben und offene Abweichungen in einem Abschlussprotokoll festhalten.",
  final_clearance:
    "Vier-Augen-Endkontrolle durchführen und den Austritt verbindlich freigeben.",
  archiving:
    "Operative Nutzung beenden und die unveränderbare Personalakte archivieren.",
};

const STEP_ROUTES: Partial<Record<OffboardingStepKey, string>> = {
  open_assignments: "/assist/einsaetze",
  replacement_required: "/assist/kalender",
  open_documentation: "/assist/nachweise",
  open_corrections: "/business/office/time-tracking/pruefqueue",
  open_signatures: "/business/office/documents/signatures",
  work_time_closure: "/business/office/time-tracking",
  payroll_export_prepared: "/business/office/time-tracking/export",
  inventory_return: "/business/office/inventory/employees",
  uniform: "/business/office/inventory/employees",
  keys_access: "/business/office/inventory/employees",
  devices: "/business/office/inventory/employees",
  lock_portal_access: "/business/office/access/employee-portal",
  external_access_prepared: "/business/connect",
  completion_documents: "/business/office/documents",
  reference_prepared: "/business/office/documents",
};

const BLOCKER_STEP_MAP: Record<string, OffboardingStepKey | undefined> = {
  open_assignments: "open_assignments",
  replacement_open: "replacement_required",
  open_documentation: "open_documentation",
  open_corrections: "open_corrections",
  open_signatures: "open_signatures",
  work_time_open: "work_time_closure",
  payroll_not_prepared: "payroll_export_prepared",
  open_returns: "inventory_return",
};

const BLOCKER_ROUTES: Record<string, string | undefined> = {
  open_assignments: STEP_ROUTES.open_assignments,
  replacement_open: STEP_ROUTES.replacement_required,
  open_documentation: STEP_ROUTES.open_documentation,
  open_corrections: STEP_ROUTES.open_corrections,
  open_signatures: STEP_ROUTES.open_signatures,
  work_time_open: STEP_ROUTES.work_time_closure,
  payroll_not_prepared: STEP_ROUTES.payroll_export_prepared,
  open_returns: STEP_ROUTES.inventory_return,
  documents_incomplete: STEP_ROUTES.completion_documents,
  reference_missing: STEP_ROUTES.reference_prepared,
};

const BLOCKER_LABELS: Record<string, string> = {
  missing_exit_date: "Austrittsdatum",
  missing_termination_type: "Art der Beendigung",
  open_assignments: "Offene und zukünftige Einsätze",
  replacement_open: "Vertretung und Versorgung",
  open_documentation: "Einsatzdokumentation",
  open_corrections: "Offene Korrekturen",
  open_signatures: "Pflichtunterschriften",
  work_time_open: "Arbeitszeit und Zeitkonto",
  payroll_not_prepared: "Schlussabrechnung und Lohnexport",
  open_returns: "Firmeneigentum und Rückgaben",
  portal_not_locked: "Mitarbeitendenportal",
  external_access_not_prepared: "Externe Zugänge",
  documents_incomplete: "Abschlussunterlagen",
  reference_missing: "Arbeitszeugnis",
  return_protocol_missing: "Rückgabe- und Abschlussprotokoll",
};

const PRODUCTION_STEP_MAP: Record<string, OffboardingStepKey | undefined> = {
  live_gps: "open_assignments",
  active_logbook_trip: "work_time_closure",
  active_work_time: "work_time_closure",
  future_assignments: "open_assignments",
  open_documentation: "open_documentation",
  open_signatures: "open_signatures",
  open_corrections: "open_corrections",
  open_inventory: "inventory_return",
};

const PRODUCTION_ROUTES: Record<string, string | undefined> = {
  active_work_time: STEP_ROUTES.work_time_closure,
  future_assignments: STEP_ROUTES.open_assignments,
  open_documentation: STEP_ROUTES.open_documentation,
  open_signatures: STEP_ROUTES.open_signatures,
  open_corrections: STEP_ROUTES.open_corrections,
  open_inventory: STEP_ROUTES.inventory_return,
  open_expenses: "/business/office/invoices",
  live_gps: "/business/office/time-tracking/live-map",
  active_logbook_trip: "/business/office/fahrtenbuch",
  active_push_devices: "/business/office/access/employee-portal",
};

const ACCESS_KINDS = [
  ["portal", "Mitarbeitendenportal"],
  ["email", "E-Mail-Konto"],
  ["phone", "Telefonie / Rufnummer"],
  ["cloud", "Cloud und Dateifreigaben"],
] as const;

type OffboardingDocumentType = {
  key: string;
  label: string;
  category: EmployeeDocumentCategory;
  helper: string;
};

const MAX_OFFBOARDING_DOCUMENT_BYTES = 15 * 1024 * 1024;

const OFFBOARDING_DOCUMENT_TYPES: OffboardingDocumentType[] = [
  {
    key: "termination_notice",
    label: "Kündigung / Aufhebungsvertrag",
    category: "offboarding_termination_notice",
    helper: "Ausgangsdokument der Beendigung",
  },
  {
    key: "termination_confirmation",
    label: "Beendigungsbestätigung",
    category: "offboarding_termination_confirmation",
    helper: "Bestätigung des Austritts und des letzten Beschäftigungstags",
  },
  {
    key: "vacation_certificate",
    label: "Urlaubsbescheinigung",
    category: "offboarding_vacation_certificate",
    helper: "Resturlaub und bereits gewährter Urlaub",
  },
  {
    key: "employment_certificate",
    label: "Arbeitsbescheinigung",
    category: "offboarding_employment_certificate",
    helper: "Bescheinigung für die Agentur für Arbeit",
  },
  {
    key: "payroll",
    label: "Entgelt- und SV-Unterlagen",
    category: "offboarding_payroll",
    helper: "Schlussabrechnung und Sozialversicherungsnachweise",
  },
  {
    key: "reference",
    label: "Arbeitszeugnis",
    category: "offboarding_reference",
    helper: "Geprüfte und freigegebene Zeugnisfassung",
  },
  {
    key: "return_protocol",
    label: "Unterschriebenes Rückgabeprotokoll",
    category: "offboarding_return_protocol",
    helper: "Rückgaben, Abweichungen und Bestätigung",
  },
  {
    key: "other",
    label: "Sonstige Offboarding-Unterlage",
    category: "offboarding_other",
    helper: "Weitere austrittsbezogene Unterlage",
  },
];

const DOCUMENT_PACKAGES: {
  stepKey: OffboardingStepKey;
  title: string;
  items: { label: string; category: EmployeeDocumentCategory }[];
}[] = [
  {
    stepKey: "completion_documents",
    title: "Abschlussunterlagen",
    items: OFFBOARDING_DOCUMENT_TYPES.filter((item) =>
      [
        "termination_confirmation",
        "vacation_certificate",
        "employment_certificate",
        "payroll",
      ].includes(item.key),
    ).map(({ label, category }) => ({ label, category })),
  },
  {
    stepKey: "reference_prepared",
    title: "Arbeitszeugnis",
    items: OFFBOARDING_DOCUMENT_TYPES.filter(
      (item) => item.key === "reference",
    ).map(({ label, category }) => ({ label, category })),
  },
  {
    stepKey: "return_protocol",
    title: "Rückgabe- und Abschlussprotokoll",
    items: OFFBOARDING_DOCUMENT_TYPES.filter(
      (item) => item.key === "return_protocol",
    ).map(({ label, category }) => ({ label, category })),
  },
];

const AUDIT_ACTION_LABELS: Record<string, string> = {
  session_started: "Offboarding gestartet",
  exit_recorded: "Austrittsdaten gespeichert",
  checks_refreshed: "Live- und Prozessprüfung aktualisiert",
  step_updated: "Arbeitsschritt aktualisiert",
  return_recorded: "Rückgabe dokumentiert",
  access_prepared: "Zugangssperrung vorbereitet",
  access_locked: "Zugang gesperrt",
  protocol_generated: "Abschlussprotokoll erstellt",
  clearance_completed: "Endfreigabe erteilt",
  personnel_archived: "Personalakte archiviert",
  session_reopened: "Offboarding wieder geöffnet",
  status_changed: "Status geändert",
};

export function EmployeeOffboardingScreen({
  employeeId: employeeIdProp,
  embedded = false,
  embeddedInModal = false,
}: {
  employeeId?: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
} = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const id = employeeIdProp ?? routeId;
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const compact = viewportWidth < 980;
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can("office.employees.edit");
  const canView = can("office.employees.view");
  const [exitDate, setExitDate] = useState("");
  const [terminationType, setTerminationType] =
    useState<TerminationType | null>(null);
  const [internalReason, setInternalReason] = useState("");
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [documentTypeKey, setDocumentTypeKey] = useState(
    "termination_confirmation",
  );
  const [documentTitle, setDocumentTitle] = useState("Beendigungsbestätigung");
  const [pickedDocument, setPickedDocument] = useState<{
    fileName: string;
    mimeType: string;
    contentBase64: string;
    sizeBytes: number;
  } | null>(null);
  const [pendingDocumentDeleteId, setPendingDocumentDeleteId] = useState<
    string | null
  >(null);
  const liveMode = getServiceMode() === "supabase";

  const query = useAsyncQuery(
    async () => {
      if (!tenantId) return { ok: false as const, error: "Kein Mandant." };
      if (!id) return { ok: false as const, error: "Keine Mitarbeitenden-ID." };
      return fetchOffboardingProgress(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && canView },
  );

  const productionQuery = useAsyncQuery(
    async () => {
      if (!tenantId || !id)
        return {
          ok: false as const,
          error: "Produktionsprüfung nicht möglich.",
        };
      return fetchEmployeeOffboardingProductionGate(
        tenantId,
        id,
        exitDate || null,
      );
    },
    [tenantId, id, exitDate],
    { enabled: liveMode && !!tenantId && !!id && canView },
  );

  const personnelFileQuery = useAsyncQuery(
    async () => {
      if (!tenantId || !id)
        return { ok: false as const, error: "Personalakte nicht verfügbar." };
      return fetchEmployeePersonnelFile(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && canView },
  );

  const auditQuery = useAsyncQuery(
    async () => {
      if (!tenantId || !id)
        return { ok: false as const, error: "Prüfpfad nicht verfügbar." };
      return fetchOffboardingAuditTrail(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && canView },
  );

  useEffect(() => {
    if (!query.data) return;
    setExitDate(query.data.session.exitDate ?? "");
    setTerminationType(query.data.session.terminationType ?? null);
    setInternalReason(query.data.session.internalReason ?? "");
    setStepNotes(
      Object.fromEntries(
        query.data.steps.map((step) => [step.stepKey, step.notes ?? ""]),
      ),
    );
  }, [query.data]);

  const runAction = async <T,>(
    key: string,
    successMessage: string,
    action: () => Promise<ServiceResult<T>>,
  ) => {
    setBusyAction(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error);
        return false;
      }
      setActionSuccess(successMessage);
      await query.refresh();
      await auditQuery.refresh();
      await personnelFileQuery.refresh();
      if (liveMode) await productionQuery.refresh();
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Aktion konnte nicht ausgeführt werden.",
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const selectDocumentType = (key: string) => {
    const definition = OFFBOARDING_DOCUMENT_TYPES.find(
      (entry) => entry.key === key,
    );
    if (!definition) return;
    setDocumentTypeKey(key);
    setDocumentTitle(definition.label);
  };

  const pickOffboardingDocument = async () => {
    setActionError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        "application/pdf",
        "image/*",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (
      typeof asset.size === "number" &&
      asset.size > MAX_OFFBOARDING_DOCUMENT_BYTES
    ) {
      setActionError("Die Datei darf höchstens 15 MB groß sein.");
      return;
    }

    try {
      const response = await fetch(asset.uri);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > MAX_OFFBOARDING_DOCUMENT_BYTES) {
        setActionError("Die Datei darf höchstens 15 MB groß sein.");
        return;
      }
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index] ?? 0);
      }
      setPickedDocument({
        fileName: asset.name ?? "offboarding-dokument.pdf",
        mimeType: asset.mimeType ?? "application/octet-stream",
        contentBase64: btoa(binary),
        sizeBytes: asset.size ?? bytes.length,
      });
    } catch {
      setActionError("Die ausgewählte Datei konnte nicht gelesen werden.");
    }
  };

  const uploadOffboardingDocument = async () => {
    if (!tenantId || !id || !pickedDocument || !documentTitle.trim()) return;
    const definition = OFFBOARDING_DOCUMENT_TYPES.find(
      (entry) => entry.key === documentTypeKey,
    );
    if (!definition) return;

    const saved = await runAction(
      "document-upload",
      `„${documentTitle.trim()}“ wurde der Personalakte von ${query.data?.employeeName ?? "der ausgewählten Person"} zugeordnet.`,
      () =>
        uploadEmployeePersonnelDocument(
          tenantId,
          id,
          {
            ...pickedDocument,
            title: documentTitle.trim(),
            category: definition.category,
            sensitive: true,
            releasedToPortal: false,
          },
          profile?.roleKey,
          profile?.id,
        ),
    );
    if (saved) {
      setPickedDocument(null);
      setDocumentTitle(definition.label);
    }
  };

  const removeOffboardingDocument = async (
    document: EmployeeDocumentRecord,
  ) => {
    if (!tenantId || !id) return;
    const removed = await runAction(
      `document-delete-${document.id}`,
      `„${document.title}“ wurde entfernt. Die Änderung ist im Prüfpfad dokumentiert.`,
      () =>
        deleteEmployeePersonnelDocument(
          tenantId,
          id,
          document.id,
          profile?.roleKey,
          profile?.id,
        ),
    );
    if (removed) setPendingDocumentDeleteId(null);
  };

  if (!canView) {
    const content = (
      <LockedActionBanner
        message={check("office.employees.view").reason ?? "Keine Berechtigung."}
        roleLabel={roleLabel}
      />
    );
    return embedded ? (
      content
    ) : (
      <ScreenShell title="Offboarding">{content}</ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    const content = <LoadingState message="Offboarding-Akte wird geladen…" />;
    return embedded ? (
      content
    ) : (
      <ScreenShell title="Offboarding">{content}</ScreenShell>
    );
  }

  if (query.error && !query.data) {
    const content = (
      <ErrorState message={query.error} onRetry={query.refresh} />
    );
    return embedded ? (
      content
    ) : (
      <ScreenShell title="Offboarding">{content}</ScreenShell>
    );
  }

  const progress = query.data;
  if (!progress) {
    const content = (
      <EmptyState
        title="Keine Daten"
        message="Offboarding konnte nicht geladen werden."
      />
    );
    return embedded ? (
      content
    ) : (
      <ScreenShell title="Offboarding">{content}</ScreenShell>
    );
  }

  const integration =
    tenantId && id ? buildOffboardingIntegrationSnapshot(tenantId, id) : null;
  const openMaterials = liveMode
    ? []
    : (integration?.workMaterials.filter((item) =>
        ["issued", "return_pending", "damaged", "lost"].includes(item.status),
      ) ?? []);
  const portalLocked = progress.accessRevocations.some(
    (item) => item.kind === "portal" && item.status === "locked",
  );
  const externalPrepared = ["email", "phone", "cloud"].every((kind) =>
    progress.accessRevocations.some(
      (item) =>
        item.kind === kind && ["prepared", "locked"].includes(item.status),
    ),
  );
  const archived = progress.session.overallStatus === "completed";
  const personnelDocuments = personnelFileQuery.data?.documents ?? [];
  const offboardingCategories = new Set(
    OFFBOARDING_DOCUMENT_TYPES.map((entry) => entry.category),
  );
  const offboardingDocuments = personnelDocuments.filter((document) =>
    offboardingCategories.has(document.category),
  );
  const packageEvidence = new Map<OffboardingStepKey, boolean>(
    DOCUMENT_PACKAGES.map((documentPackage) => [
      documentPackage.stepKey,
      documentPackage.items.every((item) =>
        offboardingDocuments.some(
          (document) => document.category === item.category,
        ),
      ),
    ]),
  );
  const completionDocumentsReady =
    packageEvidence.get("completion_documents") === true;
  const referenceDocumentReady =
    packageEvidence.get("reference_prepared") === true;
  const returnProtocolDocumentReady =
    packageEvidence.get("return_protocol") === true;
  const selectedDocumentType =
    OFFBOARDING_DOCUMENT_TYPES.find((entry) => entry.key === documentTypeKey) ??
    OFFBOARDING_DOCUMENT_TYPES[0];

  const productionChecks = productionQuery.data?.checks ?? [];
  const failedProductionChecks = productionChecks.filter(
    (entry) => !entry.passed,
  );
  const productionByStep = new Map<OffboardingStepKey, boolean>();
  for (const entry of productionChecks) {
    const stepKey = PRODUCTION_STEP_MAP[entry.key];
    if (!stepKey) continue;
    const previousResult = productionByStep.get(stepKey);
    productionByStep.set(
      stepKey,
      previousResult === undefined
        ? entry.passed
        : previousResult && entry.passed,
    );
  }
  const effectiveBlockers = progress.blockers.filter((blocker) => {
    if (!liveMode) return true;
    const stepKey = BLOCKER_STEP_MAP[blocker.checkKey];
    return !stepKey || !productionByStep.has(stepKey);
  });
  if (personnelFileQuery.data) {
    if (
      !completionDocumentsReady &&
      !effectiveBlockers.some(
        (blocker) => blocker.checkKey === "documents_incomplete",
      )
    ) {
      effectiveBlockers.push({
        checkKey: "documents_incomplete",
        message:
          "Die vier Pflichtunterlagen sind noch nicht vollständig in der Personalakte hinterlegt.",
        count:
          DOCUMENT_PACKAGES[0]?.items.filter(
            (item) =>
              !offboardingDocuments.some(
                (document) => document.category === item.category,
              ),
          ).length ?? null,
      });
    }
    if (
      !referenceDocumentReady &&
      !effectiveBlockers.some(
        (blocker) => blocker.checkKey === "reference_missing",
      )
    ) {
      effectiveBlockers.push({
        checkKey: "reference_missing",
        message:
          "Ein geprüftes Arbeitszeugnis ist noch nicht in der Personalakte hinterlegt.",
        count: 1,
      });
    }
    if (
      !returnProtocolDocumentReady &&
      !effectiveBlockers.some(
        (blocker) => blocker.checkKey === "return_protocol_missing",
      )
    ) {
      effectiveBlockers.push({
        checkKey: "return_protocol_missing",
        message:
          "Das unterschriebene Rückgabe- und Abschlussprotokoll fehlt in der Personalakte.",
        count: 1,
      });
    }
  }
  const effectiveSteps = progress.steps.map((step) => {
    const livePassed = productionByStep.get(step.stepKey);
    const documentPackage = DOCUMENT_PACKAGES.find(
      (entry) => entry.stepKey === step.stepKey,
    );
    if (
      personnelFileQuery.data &&
      documentPackage &&
      packageEvidence.get(step.stepKey) !== true
    ) {
      return {
        ...step,
        status: "blocked" as OffboardingStepStatus,
      };
    }
    if (livePassed === undefined) return step;
    return {
      ...step,
      status: (livePassed ? "completed" : "blocked") as OffboardingStepStatus,
    };
  });
  const effectiveCompletedStepCount = effectiveSteps.filter(
    (step) => step.status === "completed" || step.status === "not_applicable",
  ).length;
  const effectiveProgressPercent = Math.round(
    (effectiveCompletedStepCount / Math.max(effectiveSteps.length, 1)) * 100,
  );
  const productionUnavailable =
    liveMode &&
    !productionQuery.loading &&
    (!productionQuery.data || !!productionQuery.error);
  const unresolvedCount =
    effectiveBlockers.length +
    failedProductionChecks.length +
    (productionUnavailable ? 1 : 0);
  const nextStep = effectiveSteps.find(
    (step) => step.status !== "completed" && step.status !== "not_applicable",
  );
  const phaseSummaries = WORKFLOW_PHASES.map((phase) => {
    const steps = effectiveSteps.filter((step) =>
      phase.steps.includes(step.stepKey),
    );
    const completed = steps.filter(
      (step) => step.status === "completed" || step.status === "not_applicable",
    ).length;
    const blocked = steps.filter((step) => step.status === "blocked").length;
    return { ...phase, completed, blocked, total: steps.length };
  });
  const protocolReady =
    completionDocumentsReady &&
    referenceDocumentReady &&
    effectiveBlockers.every(
      (blocker) => blocker.checkKey === "return_protocol_missing",
    ) &&
    (!liveMode || productionQuery.data?.passed === true);
  const clearanceReady =
    !!progress.clearance?.protocolGeneratedAt &&
    completionDocumentsReady &&
    referenceDocumentReady &&
    returnProtocolDocumentReady &&
    effectiveBlockers.length === 0 &&
    (!liveMode || productionQuery.data?.passed === true);
  const overallStatusLabel =
    unresolvedCount > 0
      ? "Blockiert"
      : OVERALL_STATUS_LABELS[progress.session.overallStatus];
  const auditEvents = auditQuery.data ?? [];
  const workTimeGateChecks = productionChecks.filter(
    (entry) =>
      entry.key === "active_work_time" || entry.key === "active_logbook_trip",
  );
  const workTimeReady = liveMode
    ? workTimeGateChecks.length === 2 &&
      workTimeGateChecks.every((entry) => entry.passed)
    : effectiveSteps.find((step) => step.stepKey === "work_time_closure")
        ?.status === "completed";
  const expensesReady = liveMode
    ? productionChecks.find((entry) => entry.key === "open_expenses")
        ?.passed === true
    : true;
  const payrollExportReady =
    effectiveSteps.find((step) => step.stepKey === "payroll_export_prepared")
      ?.status === "completed";

  const body = (
    <>
      {actionError ? (
        <InfoBanner
          title="Aktion nicht möglich"
          message={actionError}
          variant="danger"
          presentation="inline"
        />
      ) : null}
      {actionSuccess ? (
        <InfoBanner
          title="Gespeichert"
          message={actionSuccess}
          variant="success"
          presentation="inline"
        />
      ) : null}

      <SectionPanel
        title="Offboarding-Steuerung"
        subtitle={`${progress.employeeName} · geführter und revisionssicherer Austrittsprozess`}
      >
        <View style={[styles.heroTop, compact && styles.stack]}>
          <View style={styles.heroIdentity}>
            <Text style={styles.eyebrow}>PERSONALAKTE · OFFBOARDING</Text>
            <Text style={styles.heroTitle}>{progress.employeeName}</Text>
            <Text style={styles.heroSubtitle}>
              {exitDate
                ? `Beschäftigungsende: ${formatDisplayDate(exitDate)}`
                : "Beschäftigungsende noch nicht eingetragen"}
            </Text>
          </View>
          <View
            style={[
              styles.heroStatus,
              unresolvedCount > 0 && styles.heroStatusBlocked,
            ]}
          >
            <Text
              style={[
                styles.heroStatusText,
                unresolvedCount > 0 && styles.heroStatusTextBlocked,
              ]}
            >
              {overallStatusLabel}
            </Text>
            <Text style={styles.heroPercent}>{effectiveProgressPercent} %</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            label="Erledigt"
            value={String(effectiveCompletedStepCount)}
            helper={`von ${progress.totalStepCount} Schritten`}
            tone="success"
          />
          <MetricCard
            label="Prozessblocker"
            value={String(unresolvedCount)}
            helper={
              unresolvedCount === 0
                ? "Endprüfung möglich"
                : "müssen bearbeitet werden"
            }
            tone={unresolvedCount === 0 ? "success" : "danger"}
          />
          <MetricCard
            label="Live-Prüfung"
            value={
              !liveMode
                ? "Demo"
                : productionQuery.loading
                  ? "Läuft"
                  : productionQuery.data?.passed
                    ? "Bestanden"
                    : "Gesperrt"
            }
            helper={
              liveMode ? "Produktivdaten maßgeblich" : "kein Produktionszugriff"
            }
            tone={
              !liveMode || productionQuery.data?.passed ? "success" : "warning"
            }
          />
          <MetricCard
            label="Verantwortung"
            value={
              progress.session.responsibleUserId === profile?.id
                ? "Bei Ihnen"
                : progress.session.responsibleUserId
                  ? "Zugewiesen"
                  : "Offen"
            }
            helper={
              progress.session.lastSavedAt
                ? `Stand ${formatDateTime(progress.session.lastSavedAt)}`
                : "noch nicht gespeichert"
            }
            tone={progress.session.responsibleUserId ? "success" : "warning"}
          />
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${effectiveProgressPercent}%` },
            ]}
          />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>
            {effectiveCompletedStepCount}/{progress.totalStepCount}{" "}
            Prozessschritte abgeschlossen
          </Text>
          <Text style={styles.progressLabel}>{effectiveProgressPercent} %</Text>
        </View>

        {!archived && nextStep ? (
          <View style={[styles.nextAction, compact && styles.stack]}>
            <View style={styles.nextActionNumber}>
              <Text style={styles.nextActionNumberText}>
                {progress.steps.findIndex(
                  (step) => step.stepKey === nextStep.stepKey,
                ) + 1}
              </Text>
            </View>
            <View style={styles.nextActionCopy}>
              <Text style={styles.nextActionEyebrow}>
                NÄCHSTER VERBINDLICHER SCHRITT
              </Text>
              <Text style={styles.nextActionTitle}>
                {OFFBOARDING_STEP_LABELS[nextStep.stepKey]}
              </Text>
              <Text style={styles.nextActionText}>
                {STEP_DESCRIPTIONS[nextStep.stepKey]}
              </Text>
            </View>
            {STEP_ROUTES[nextStep.stepKey] ? (
              <PremiumButton
                title="Arbeitsbereich öffnen"
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push(STEP_ROUTES[nextStep.stepKey] as never)
                }
              />
            ) : null}
          </View>
        ) : null}

        {archived ? (
          <InfoBanner
            title="Personalakte revisionssicher archiviert"
            message="Das Beschäftigungsverhältnis ist beendet, die operativen Zugänge sind gesperrt und der Datensatz bleibt für Nachweis- und Aufbewahrungspflichten erhalten."
            variant="success"
            presentation="inline"
          />
        ) : null}

        {!archived && canManage ? (
          <View style={[styles.actionsRow, compact && styles.stack]}>
            {progress.session.overallStatus === "not_started" ? (
              <PremiumButton
                title="Offboarding verbindlich starten"
                loading={busyAction === "start"}
                onPress={() =>
                  tenantId &&
                  id &&
                  runAction("start", "Offboarding wurde gestartet.", () =>
                    startOffboardingSession(
                      tenantId,
                      id,
                      profile?.roleKey,
                      profile?.id,
                    ),
                  )
                }
              />
            ) : null}
            {profile?.id &&
            progress.session.responsibleUserId !== profile.id ? (
              <PremiumButton
                title="Verantwortung übernehmen"
                variant="secondary"
                loading={busyAction === "responsible"}
                onPress={() =>
                  tenantId &&
                  id &&
                  runAction(
                    "responsible",
                    "Verantwortung wurde Ihnen zugewiesen.",
                    () =>
                      assignOffboardingResponsible(
                        tenantId,
                        id,
                        profile.id,
                        profile?.roleKey,
                        profile.id,
                      ),
                  )
                }
              />
            ) : null}
            <PremiumButton
              title="Gesamtstatus aktualisieren"
              variant="secondary"
              loading={busyAction === "refresh"}
              onPress={() =>
                tenantId &&
                id &&
                runAction("refresh", "Prüfstatus wurde aktualisiert.", () =>
                  refreshOffboardingChecks(
                    tenantId,
                    id,
                    profile?.roleKey,
                    profile?.id,
                  ),
                )
              }
            />
          </View>
        ) : null}
      </SectionPanel>

      <SectionPanel
        title="Der vollständige Ablauf"
        subtitle="Fünf Prozessphasen · 20 verbindliche Schritte · Live-Daten haben Vorrang"
      >
        <View style={styles.phaseGrid}>
          {phaseSummaries.map((phase) => {
            const complete = phase.completed === phase.total;
            return (
              <View
                key={phase.key}
                style={[
                  styles.phaseCard,
                  phase.blocked > 0 && styles.phaseCardBlocked,
                  complete && styles.phaseCardDone,
                ]}
              >
                <View
                  style={[
                    styles.phaseNumber,
                    complete && styles.phaseNumberDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.phaseNumberText,
                      complete && styles.phaseNumberTextDone,
                    ]}
                  >
                    {complete ? "✓" : phase.number}
                  </Text>
                </View>
                <Text style={styles.phaseTitle}>{phase.title}</Text>
                <Text style={styles.phaseSubtitle}>{phase.subtitle}</Text>
                <View style={styles.phaseFooter}>
                  <Text style={styles.phaseCount}>
                    {phase.completed}/{phase.total} erledigt
                  </Text>
                  <Text
                    style={[
                      styles.phaseState,
                      phase.blocked > 0 && styles.phaseStateBlocked,
                    ]}
                  >
                    {phase.blocked > 0
                      ? `${phase.blocked} blockiert`
                      : complete
                        ? "Abgeschlossen"
                        : "In Bearbeitung"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </SectionPanel>

      {!archived ? (
        <SectionPanel
          title="1. Beendigung und Fristen"
          subtitle="Verbindliche Grundlage für alle weiteren Schritte"
        >
          <InfoBanner
            title="Zuerst die arbeitsrechtliche Grundlage vollständig erfassen"
            message="Das Austrittsdatum steuert Einsatzplanung, Arbeitszeit, Zugriffsende und Endabrechnung. Der interne Vermerk muss Zugang, Frist, Besonderheiten und zuständige Bearbeitung nachvollziehbar festhalten."
            variant="info"
            presentation="inline"
          />
          <View style={styles.formSection}>
            <CareDateInput
              label="Letzter Tag des Beschäftigungsverhältnisses"
              value={exitDate}
              onChange={setExitDate}
              error={
                !exitDate && actionError
                  ? "Austrittsdatum ist erforderlich."
                  : undefined
              }
              viewContext="form"
            />
            <Text style={styles.fieldLabel}>Art der Beendigung</Text>
            <View style={styles.choiceGrid}>
              {TERMINATION_TYPES.map(([key, label]) => {
                const selected = terminationType === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setTerminationType(key)}
                    style={[styles.choice, selected && styles.choiceSelected]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selected && styles.choiceTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <PremiumInput
              label="Interner Grund / Vermerk"
              value={internalReason}
              onChangeText={setInternalReason}
              placeholder="z. B. Kündigung eingegangen am …, Frist, Besonderheiten"
              multiline
              onLightSurface
              viewContext="form"
            />
            {canManage ? (
              <PremiumButton
                title="Kündigungsdaten verbindlich speichern"
                loading={busyAction === "exit"}
                disabled={!exitDate || !terminationType}
                onPress={() => {
                  if (!tenantId || !id || !exitDate || !terminationType) return;
                  void runAction(
                    "exit",
                    "Kündigungsdaten wurden gespeichert.",
                    () =>
                      saveOffboardingExitDetails(
                        tenantId,
                        id,
                        { exitDate, terminationType, internalReason },
                        profile?.roleKey,
                        profile?.id,
                      ),
                  );
                }}
              />
            ) : null}
          </View>
        </SectionPanel>
      ) : null}

      {(effectiveBlockers.length > 0 ||
        failedProductionChecks.length > 0 ||
        productionUnavailable) &&
      !archived ? (
        <SectionPanel
          title="Handlungsbedarf"
          subtitle={`${unresolvedCount} offene Prüfungen verhindern derzeit Abschluss und Archivierung`}
        >
          <View style={styles.blockerList}>
            {effectiveBlockers.map((blocker) => {
              const route = BLOCKER_ROUTES[blocker.checkKey];
              return (
                <View
                  key={blocker.checkKey}
                  style={[styles.blockerCard, compact && styles.stack]}
                >
                  <View style={styles.blockerIconWrap}>
                    <Text style={styles.blockerIcon}>!</Text>
                  </View>
                  <View style={styles.blockerCopy}>
                    <Text style={styles.blockerTitle}>
                      {BLOCKER_LABELS[blocker.checkKey] ??
                        "Offener Pflichtpunkt"}
                    </Text>
                    <Text style={styles.blocker}>{blocker.message}</Text>
                  </View>
                  {route ? (
                    <PremiumButton
                      title="Jetzt bearbeiten"
                      size="sm"
                      variant="secondary"
                      onPress={() => router.push(route as never)}
                    />
                  ) : null}
                </View>
              );
            })}
            {failedProductionChecks.map((entry) => {
              const route = PRODUCTION_ROUTES[entry.key];
              return (
                <View
                  key={`live-${entry.key}`}
                  style={[styles.blockerCard, compact && styles.stack]}
                >
                  <View style={styles.blockerIconWrap}>
                    <Text style={styles.blockerIcon}>!</Text>
                  </View>
                  <View style={styles.blockerCopy}>
                    <Text style={styles.blockerTitle}>{entry.label}</Text>
                    <Text style={styles.blocker}>{entry.message}</Text>
                    <Text style={styles.liveSource}>
                      Echte Produktivdaten · kein Demo-Fallback
                    </Text>
                  </View>
                  {route ? (
                    <PremiumButton
                      title="Arbeitsbereich öffnen"
                      size="sm"
                      variant="secondary"
                      onPress={() => router.push(route as never)}
                    />
                  ) : null}
                </View>
              );
            })}
            {productionUnavailable ? (
              <View style={[styles.blockerCard, compact && styles.stack]}>
                <View style={styles.blockerIconWrap}>
                  <Text style={styles.blockerIcon}>!</Text>
                </View>
                <View style={styles.blockerCopy}>
                  <Text style={styles.blockerTitle}>
                    Produktionsprüfung nicht verfügbar
                  </Text>
                  <Text style={styles.blocker}>
                    Die Endfreigabe bleibt sicher gesperrt, bis die echten
                    Produktivdaten wieder vollständig geprüft werden konnten.
                  </Text>
                  <Text style={styles.liveSource}>
                    Deny-by-default · kein Abschluss ohne belastbaren Prüfstatus
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <PremiumButton
            title="Alle Live- und Prozessdaten erneut prüfen"
            variant="secondary"
            loading={busyAction === "refresh" || productionQuery.loading}
            onPress={() =>
              tenantId &&
              id &&
              runAction("refresh", "Prüfstatus wurde aktualisiert.", () =>
                refreshOffboardingChecks(
                  tenantId,
                  id,
                  profile?.roleKey,
                  profile?.id,
                ),
              )
            }
          />
        </SectionPanel>
      ) : null}

      {liveMode && !archived ? (
        <SectionPanel
          title="2. Versorgung und operativen Betrieb sichern"
          subtitle="Zehn verbindliche Live-Prüfungen aus den Produktivdaten"
        >
          {productionQuery.loading && !productionQuery.data ? (
            <LoadingState message="GPS, Fahrtenbuch, Einsätze, Dokumentation, Arbeitszeit, Auslagen und Portalgeräte werden geprüft…" />
          ) : productionQuery.error ? (
            <InfoBanner
              title="Endfreigabe sicher gesperrt"
              message={productionQuery.error}
              variant="danger"
              presentation="inline"
            />
          ) : (
            <>
              <View style={styles.productionGrid}>
                {productionChecks.map((entry) => {
                  const route = PRODUCTION_ROUTES[entry.key];
                  return (
                    <View
                      key={entry.key}
                      style={[
                        styles.productionCard,
                        entry.passed
                          ? styles.productionCardDone
                          : styles.productionCardOpen,
                      ]}
                    >
                      <View style={styles.productionHeader}>
                        <View
                          style={[
                            styles.checkCircle,
                            entry.passed && styles.checkCircleDone,
                          ]}
                        >
                          <Text
                            style={[
                              styles.checkMark,
                              entry.passed && styles.checkMarkDone,
                            ]}
                          >
                            {entry.passed ? "✓" : "!"}
                          </Text>
                        </View>
                        <Text style={styles.productionTitle}>
                          {entry.label}
                        </Text>
                        <Text
                          style={[
                            styles.statusPill,
                            entry.passed
                              ? styles.statusPillDone
                              : styles.statusPillBlocked,
                          ]}
                        >
                          {entry.passed ? "Erledigt" : "Offen"}
                        </Text>
                      </View>
                      <Text style={styles.productionMessage}>
                        {entry.message}
                      </Text>
                      {route ? (
                        <PremiumButton
                          title={
                            entry.passed
                              ? "Details bearbeiten"
                              : "Vorgang bearbeiten"
                          }
                          size="sm"
                          variant="secondary"
                          onPress={() => router.push(route as never)}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View style={[styles.liveFooter, compact && styles.stack]}>
                <View style={styles.liveFooterCopy}>
                  <Text style={styles.liveFooterTitle}>
                    {productionQuery.data?.passed
                      ? "Produktionsprüfung bestanden"
                      : "Endfreigabe bleibt gesperrt"}
                  </Text>
                  <Text style={styles.liveFooterText}>
                    Letzte Prüfung:{" "}
                    {formatDateTime(productionQuery.data?.checkedAt)}
                  </Text>
                </View>
                <PremiumButton
                  title="Live-Daten erneut prüfen"
                  variant="secondary"
                  loading={productionQuery.loading}
                  onPress={() => productionQuery.refresh()}
                />
              </View>
            </>
          )}
        </SectionPanel>
      ) : null}

      {!archived ? (
        <SectionPanel
          title="3. Arbeitszeit, Entgelt und Auslagen abschließen"
          subtitle="Zeitkonto, Fahrten, Erstattungen und Schlussabrechnung verbindlich abstimmen"
        >
          <View style={styles.documentGrid}>
            <View
              style={[
                styles.documentCard,
                workTimeReady && styles.documentCardDone,
              ]}
            >
              <View style={styles.documentHeader}>
                <Text style={styles.documentTitle}>
                  Arbeitszeit und Fahrten
                </Text>
                <Text
                  style={[
                    styles.statusPill,
                    workTimeReady
                      ? styles.statusPillDone
                      : styles.statusPillBlocked,
                  ]}
                >
                  {workTimeReady ? "Abgeschlossen" : "Offen"}
                </Text>
              </View>
              <Text style={styles.documentItemText}>
                Laufende Arbeitszeitsitzungen und Fahrten beenden, Pausen prüfen
                und das Zeitkonto abstimmen.
              </Text>
              <PremiumButton
                title="Arbeitszeit bearbeiten"
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push("/business/office/time-tracking" as never)
                }
              />
            </View>

            <View
              style={[
                styles.documentCard,
                expensesReady && styles.documentCardDone,
              ]}
            >
              <View style={styles.documentHeader}>
                <Text style={styles.documentTitle}>
                  Auslagen und Erstattung
                </Text>
                <Text
                  style={[
                    styles.statusPill,
                    expensesReady
                      ? styles.statusPillDone
                      : styles.statusPillBlocked,
                  ]}
                >
                  {expensesReady ? "Abgerechnet" : "Prüfung offen"}
                </Text>
              </View>
              <Text style={styles.documentItemText}>
                Belege, Vorschüsse und offene Erstattungen vor der
                Schlussabrechnung vollständig prüfen.
              </Text>
              <PremiumButton
                title={
                  expensesReady ? "Auslagen bearbeiten" : "Auslagen prüfen"
                }
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push("/business/office/invoices" as never)
                }
              />
            </View>

            <View
              style={[
                styles.documentCard,
                payrollExportReady && styles.documentCardDone,
              ]}
            >
              <View style={styles.documentHeader}>
                <Text style={styles.documentTitle}>
                  Lohnexport und Schlussabrechnung
                </Text>
                <Text
                  style={[
                    styles.statusPill,
                    payrollExportReady
                      ? styles.statusPillDone
                      : styles.statusPillPending,
                  ]}
                >
                  {payrollExportReady ? "Vorbereitet" : "Ausstehend"}
                </Text>
              </View>
              <Text style={styles.documentItemText}>
                Zuschläge, Resturlaub, Zeitkonto, Auslagen und Austrittswerte
                für die Entgeltabrechnung freigeben.
              </Text>
              <PremiumButton
                title={
                  payrollExportReady
                    ? "Lohnexport bearbeiten"
                    : "Lohnexport vorbereiten"
                }
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push("/business/office/time-tracking/export" as never)
                }
              />
            </View>
          </View>
        </SectionPanel>
      ) : null}

      {!archived ? (
        <SectionPanel
          title="4.1 Digitale Zugänge entziehen"
          subtitle="Least Privilege · aktive Sitzungen widerrufen · externe Sperren nachweisbar ausführen"
        >
          <View style={styles.accessGrid}>
            {ACCESS_KINDS.map(([kind, label]) => {
              const entry = progress.accessRevocations.find(
                (item) => item.kind === kind,
              );
              const status =
                kind === "portal" && portalLocked
                  ? "locked"
                  : (entry?.status ?? "pending");
              const done = status === "locked" || status === "prepared";
              const statusLabel =
                status === "locked"
                  ? "Gesperrt"
                  : status === "prepared"
                    ? "Vorbereitet"
                    : status === "failed"
                      ? "Fehlgeschlagen"
                      : "Offen";
              return (
                <View
                  key={kind}
                  style={[styles.accessCard, done && styles.accessCardDone]}
                >
                  <View style={styles.accessHeader}>
                    <Text style={styles.accessTitle}>{label}</Text>
                    <Text
                      style={[
                        styles.statusPill,
                        done ? styles.statusPillDone : styles.statusPillBlocked,
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  <Text style={styles.accessDescription}>
                    {kind === "portal"
                      ? "CareSuite-Konto, aktive Anmeldung und Push-Geräte"
                      : entry?.providerConnected
                        ? "Provider verbunden · Sperrung wird technisch ausgeführt"
                        : "Kein Provider verbunden · externe Durchführung und Nachweis erforderlich"}
                  </Text>
                  {entry?.updatedAt ? (
                    <Text style={styles.accessMeta}>
                      Aktualisiert: {formatDateTime(entry.updatedAt)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          <InfoBanner
            title="Keine vorgetäuschten Fremdsperren"
            message="CareSuite sperrt den eigenen Portalzugang technisch. E-Mail, Telefonie und Cloud werden bei verbundenem Provider gesperrt; ohne Provider wird ein verbindlicher manueller Sperrauftrag vorbereitet und im Prüfpfad dokumentiert."
            variant="info"
            presentation="inline"
          />
          {canManage ? (
            <View style={[styles.actionsRow, compact && styles.stack]}>
              <PremiumButton
                title={
                  portalLocked
                    ? "Portalzugang sicher gesperrt"
                    : "Portalzugang jetzt sperren"
                }
                variant="secondary"
                disabled={portalLocked}
                loading={busyAction === "portal"}
                onPress={() =>
                  tenantId &&
                  id &&
                  runAction(
                    "portal",
                    "Portalzugang und Sitzungen wurden gesperrt.",
                    () =>
                      lockOffboardingPortalAccess(
                        tenantId,
                        id,
                        profile?.roleKey,
                        profile?.id,
                      ),
                  )
                }
              />
              <PremiumButton
                title={
                  externalPrepared
                    ? "Externe Sperren dokumentiert"
                    : "Externe Sperren ausführen / vorbereiten"
                }
                variant="secondary"
                disabled={externalPrepared}
                loading={busyAction === "external"}
                onPress={() =>
                  tenantId &&
                  id &&
                  runAction(
                    "external",
                    "Externe Zugangssperren wurden bearbeitet.",
                    () =>
                      prepareOffboardingExternalAccess(
                        tenantId,
                        id,
                        profile?.roleKey,
                        profile?.id,
                      ),
                  )
                }
              />
            </View>
          ) : null}
          <View style={[styles.actionsRow, compact && styles.stack]}>
            <PremiumButton
              title="Portal- und Gerätezustand bearbeiten"
              variant="secondary"
              onPress={() =>
                router.push("/business/office/access/employee-portal" as never)
              }
            />
            <PremiumButton
              title="Externe Zugänge und Sperrnachweise bearbeiten"
              variant="secondary"
              onPress={() => router.push("/business/connect" as never)}
            />
          </View>
        </SectionPanel>
      ) : null}

      {!archived ? (
        <SectionPanel
          title="4.2 Firmeneigentum und Rückgaben"
          subtitle="Geräte, Schlüssel, Kleidung und Zubehör mit nachvollziehbarem Rückgabestatus"
        >
          {openMaterials.length > 0 ? (
            <View style={styles.returnList}>
              {openMaterials.map((material) => (
                <View
                  key={material.id}
                  style={[styles.returnRow, compact && styles.stack]}
                >
                  <View style={styles.returnText}>
                    <Text style={styles.returnTitle}>{material.itemName}</Text>
                    <Text style={styles.returnMeta}>
                      {material.category} · Rückgabe und Zustand noch offen
                    </Text>
                  </View>
                  {canManage ? (
                    <PremiumButton
                      title="Rückgabe bestätigen"
                      size="sm"
                      variant="secondary"
                      loading={busyAction === `return-${material.id}`}
                      onPress={() =>
                        tenantId &&
                        id &&
                        runAction(
                          `return-${material.id}`,
                          `${material.itemName} wurde zurückgenommen.`,
                          () =>
                            recordOffboardingReturn(
                              tenantId,
                              id,
                              material.id,
                              profile?.roleKey,
                              profile?.id,
                            ),
                        )
                      }
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <InfoBanner
              title={
                liveMode
                  ? "Inventar wird über die Produktivprüfung geführt"
                  : "Keine offenen Rückgaben"
              }
              message={
                liveMode
                  ? "Die verbindliche Anzahl offener Gegenstände steht in der Live-Prüfung. Im Inventarbereich werden Ausgabe, Zustand, Rückgabe, Verlust und Rückgabeprotokoll je Gegenstand dokumentiert."
                  : "Im aktuellen Datenstand sind keine ausgegebenen Arbeitsmittel mehr offen."
              }
              variant={
                failedProductionChecks.some(
                  (entry) => entry.key === "open_inventory",
                )
                  ? "warning"
                  : "success"
              }
              presentation="inline"
            />
          )}
          <PremiumButton
            title="Inventarakte der Mitarbeitenden öffnen"
            variant="secondary"
            onPress={() =>
              router.push("/business/office/inventory/employees" as never)
            }
          />
        </SectionPanel>
      ) : null}

      <SectionPanel
        title="20-Schritte-Arbeitsplan"
        subtitle="Jeder Schritt erklärt Zweck, Status, Nachweis und nächsten Arbeitsbereich"
      >
        <View style={styles.workflowList}>
          {WORKFLOW_PHASES.map((phase) => (
            <View key={phase.key} style={styles.workflowPhase}>
              <View style={styles.workflowPhaseHeader}>
                <View style={styles.workflowPhaseNumber}>
                  <Text style={styles.workflowPhaseNumberText}>
                    {phase.number}
                  </Text>
                </View>
                <View style={styles.workflowPhaseCopy}>
                  <Text style={styles.workflowPhaseTitle}>{phase.title}</Text>
                  <Text style={styles.workflowPhaseSubtitle}>
                    {phase.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.stepList}>
                {phase.steps.map((stepKey) => {
                  const step = effectiveSteps.find(
                    (item) => item.stepKey === stepKey,
                  );
                  if (!step) return null;
                  const originalStep =
                    progress.steps.find((item) => item.stepKey === stepKey) ??
                    step;
                  const done =
                    step.status === "completed" ||
                    step.status === "not_applicable";
                  const blocked = step.status === "blocked";
                  const manual = MANUAL_STEPS.has(step.stepKey);
                  const route = STEP_ROUTES[step.stepKey];
                  const stepNumber =
                    progress.steps.findIndex(
                      (item) => item.stepKey === step.stepKey,
                    ) + 1;
                  const liveControlled = productionByStep.has(step.stepKey);
                  const documentPackage = DOCUMENT_PACKAGES.find(
                    (entry) => entry.stepKey === step.stepKey,
                  );
                  const documentEvidenceReady =
                    !documentPackage ||
                    packageEvidence.get(step.stepKey) === true;
                  return (
                    <View
                      key={step.id}
                      style={[
                        styles.stepCard,
                        done && styles.stepCardDone,
                        blocked && styles.stepCardBlocked,
                      ]}
                    >
                      <View style={[styles.stepMain, compact && styles.stack]}>
                        <View
                          style={[
                            styles.stepNumber,
                            done && styles.stepNumberDone,
                            blocked && styles.stepNumberBlocked,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepNumberText,
                              done && styles.stepNumberTextDone,
                            ]}
                          >
                            {done ? "✓" : stepNumber}
                          </Text>
                        </View>
                        <View style={styles.stepCopy}>
                          <Text style={styles.stepTitle}>
                            {OFFBOARDING_STEP_LABELS[step.stepKey]}
                          </Text>
                          <Text style={styles.stepDescription}>
                            {STEP_DESCRIPTIONS[step.stepKey]}
                          </Text>
                          {originalStep.notes ? (
                            <Text style={styles.stepNote}>
                              Nachweis: {originalStep.notes}
                            </Text>
                          ) : null}
                          {liveControlled ? (
                            <Text style={styles.liveSource}>
                              Status aus der verbindlichen Produktivprüfung
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.stepActionColumn}>
                          <Text
                            style={[
                              styles.statusPill,
                              done && styles.statusPillDone,
                              blocked && styles.statusPillBlocked,
                              !done && !blocked && styles.statusPillPending,
                            ]}
                          >
                            {STEP_STATUS_LABELS[step.status]}
                          </Text>
                          {route ? (
                            <PremiumButton
                              title={done ? "Bearbeiten" : "Öffnen"}
                              size="sm"
                              variant="secondary"
                              onPress={() => router.push(route as never)}
                            />
                          ) : null}
                        </View>
                      </View>
                      {manual && canManage && !archived ? (
                        <View style={styles.manualEvidence}>
                          <PremiumInput
                            label="Nachweis / interner Vermerk"
                            value={stepNotes[step.stepKey] ?? ""}
                            onChangeText={(value) =>
                              setStepNotes((current) => ({
                                ...current,
                                [step.stepKey]: value,
                              }))
                            }
                            placeholder="Was wurde geprüft, erstellt oder übergeben?"
                            multiline
                            onLightSurface
                            viewContext="form"
                          />
                          {!documentEvidenceReady ? (
                            <InfoBanner
                              title="Dokumentnachweis fehlt"
                              message="Bitte zuerst alle Pflichtunterlagen dieses Pakets direkt im Bereich „Abschlussunterlagen“ hochladen."
                              variant="warning"
                              presentation="inline"
                            />
                          ) : null}
                          <PremiumButton
                            title={
                              done
                                ? "Schritt wieder öffnen"
                                : "Prüfung bestätigen und abschließen"
                            }
                            size="sm"
                            variant="secondary"
                            loading={busyAction === `step-${step.stepKey}`}
                            disabled={
                              !done &&
                              (!stepNotes[step.stepKey]?.trim() ||
                                !documentEvidenceReady)
                            }
                            onPress={() =>
                              tenantId &&
                              id &&
                              runAction(
                                `step-${step.stepKey}`,
                                `${OFFBOARDING_STEP_LABELS[step.stepKey]} wurde aktualisiert.`,
                                () =>
                                  markOffboardingManualStep(
                                    tenantId,
                                    id,
                                    step.stepKey,
                                    done ? "pending" : "completed",
                                    stepNotes[step.stepKey]?.trim() ||
                                      undefined,
                                    profile?.roleKey,
                                    profile?.id,
                                  ),
                              )
                            }
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </SectionPanel>

      <SectionPanel
        title="5. Abschlussunterlagen und Personalakte"
        subtitle="Unterlagen direkt hochladen, eindeutig zuordnen, prüfen und bei Bedarf korrigieren"
      >
        <InfoBanner
          title="Direkt mit der Personalakte verknüpft"
          message={`Jeder Upload wird vertraulich unter ${progress.employeeName} gespeichert. Dokumentart, Dateiname, Zeitpunkt und Änderungen bleiben im Prüfpfad nachvollziehbar.`}
          variant="info"
          presentation="inline"
        />

        {canManage ? (
          <View style={styles.documentUploadPanel}>
            <View style={styles.documentUploadHeader}>
              <View style={styles.documentUploadCopy}>
                <Text style={styles.eyebrow}>NEUE UNTERLAGE</Text>
                <Text style={styles.documentUploadTitle}>
                  Dokument manuell hinzufügen
                </Text>
                <Text style={styles.documentUploadSubtitle}>
                  PDF, Bild oder Word-Datei · maximal 15 MB · nur für
                  berechtigte Personalverantwortliche
                </Text>
              </View>
              <Text style={[styles.statusPill, styles.statusPillPending]}>
                Vertraulich
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Dokumentart</Text>
            <View style={styles.choiceGrid}>
              {OFFBOARDING_DOCUMENT_TYPES.map((definition) => {
                const selected = definition.key === documentTypeKey;
                return (
                  <Pressable
                    key={definition.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectDocumentType(definition.key)}
                    style={[styles.choice, selected && styles.choiceSelected]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selected && styles.choiceTextSelected,
                      ]}
                    >
                      {definition.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.documentTypeHelper}>
              {selectedDocumentType?.helper}
            </Text>

            <PremiumInput
              label="Bezeichnung in der Personalakte"
              value={documentTitle}
              onChangeText={setDocumentTitle}
              placeholder="Eindeutige Dokumentbezeichnung"
              onLightSurface
              viewContext="form"
            />

            <View style={[styles.documentPickerRow, compact && styles.stack]}>
              <View style={styles.documentPickerCopy}>
                <Text style={styles.documentPickerLabel}>
                  {pickedDocument
                    ? pickedDocument.fileName
                    : "Noch keine Datei ausgewählt"}
                </Text>
                <Text style={styles.documentPickerMeta}>
                  {pickedDocument
                    ? `${(pickedDocument.sizeBytes / 1024 / 1024).toFixed(2)} MB · wird vertraulich gespeichert`
                    : "Datei auswählen und anschließend verbindlich hochladen"}
                </Text>
              </View>
              <PremiumButton
                title={pickedDocument ? "Datei ersetzen" : "Datei auswählen"}
                size="sm"
                variant="secondary"
                onPress={pickOffboardingDocument}
              />
              <PremiumButton
                title="Der Personalakte zuordnen"
                size="sm"
                loading={busyAction === "document-upload"}
                disabled={!pickedDocument || !documentTitle.trim()}
                onPress={uploadOffboardingDocument}
              />
            </View>
          </View>
        ) : null}

        {personnelFileQuery.loading && !personnelFileQuery.data ? (
          <LoadingState message="Zugeordnete Personalunterlagen werden geladen…" />
        ) : personnelFileQuery.error ? (
          <InfoBanner
            title="Personalunterlagen konnten nicht geladen werden"
            message={personnelFileQuery.error}
            variant="danger"
            presentation="inline"
          />
        ) : (
          <>
            <View style={styles.documentGrid}>
              {DOCUMENT_PACKAGES.map((documentPackage) => {
                const attachedCount = documentPackage.items.filter((item) =>
                  offboardingDocuments.some(
                    (document) => document.category === item.category,
                  ),
                ).length;
                const evidenceReady =
                  attachedCount === documentPackage.items.length;
                const workflowStep = progress.steps.find(
                  (item) => item.stepKey === documentPackage.stepKey,
                );
                const workflowDone =
                  workflowStep?.status === "completed" ||
                  workflowStep?.status === "not_applicable";

                return (
                  <View
                    key={documentPackage.stepKey}
                    style={[
                      styles.documentCard,
                      evidenceReady && styles.documentCardDone,
                    ]}
                  >
                    <View style={styles.documentHeader}>
                      <View style={styles.documentPackageCopy}>
                        <Text style={styles.documentTitle}>
                          {documentPackage.title}
                        </Text>
                        <Text style={styles.documentPackageMeta}>
                          {attachedCount} von {documentPackage.items.length}{" "}
                          Unterlagen hinterlegt
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.statusPill,
                          evidenceReady
                            ? styles.statusPillDone
                            : styles.statusPillPending,
                        ]}
                      >
                        {evidenceReady
                          ? "Nachweise vollständig"
                          : "Unvollständig"}
                      </Text>
                    </View>
                    {documentPackage.items.map((item) => {
                      const attached = offboardingDocuments.filter(
                        (document) => document.category === item.category,
                      );
                      return (
                        <View key={item.category} style={styles.documentItem}>
                          <Text
                            style={[
                              styles.documentCheck,
                              attached.length > 0 && styles.documentCheckDone,
                            ]}
                          >
                            {attached.length > 0 ? "✓" : "•"}
                          </Text>
                          <View style={styles.documentItemCopy}>
                            <Text style={styles.documentItemTitle}>
                              {item.label}
                            </Text>
                            <Text style={styles.documentItemText}>
                              {attached.length > 0
                                ? attached
                                    .map((document) => document.fileName)
                                    .join(", ")
                                : "Noch keine Datei zugeordnet"}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    <Text style={styles.documentPackageHint}>
                      {evidenceReady && !workflowDone
                        ? "Alle Dateien sind vorhanden. Die fachliche Prüfung muss im 20-Schritte-Arbeitsplan noch bestätigt werden."
                        : evidenceReady
                          ? "Dateinachweise und fachliche Bestätigung sind vollständig."
                          : "Fehlende Dateien oben auswählen und direkt hochladen."}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.assignedDocumentsPanel}>
              <View style={styles.documentUploadHeader}>
                <View style={styles.documentUploadCopy}>
                  <Text style={styles.documentUploadTitle}>
                    Zugeordnete Offboarding-Unterlagen
                  </Text>
                  <Text style={styles.documentUploadSubtitle}>
                    {offboardingDocuments.length} Dokument
                    {offboardingDocuments.length === 1 ? "" : "e"} in der
                    Personalakte von {progress.employeeName}
                  </Text>
                </View>
                <PremiumButton
                  title="Gesamte Personalakte öffnen"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    router.push("/business/office/documents" as never)
                  }
                />
              </View>

              {offboardingDocuments.length === 0 ? (
                <EmptyState
                  title="Noch keine Unterlagen zugeordnet"
                  message="Wählen Sie oben Dokumentart und Datei aus. Der Upload wird sofort dieser Personalakte zugeordnet."
                />
              ) : (
                <View style={styles.assignedDocumentList}>
                  {offboardingDocuments.map((document) => {
                    const definition = OFFBOARDING_DOCUMENT_TYPES.find(
                      (entry) => entry.category === document.category,
                    );
                    const confirmDelete =
                      pendingDocumentDeleteId === document.id;
                    return (
                      <View
                        key={document.id}
                        style={styles.assignedDocumentRow}
                      >
                        <View style={styles.assignedDocumentIcon}>
                          <Text style={styles.assignedDocumentIconText}>D</Text>
                        </View>
                        <View style={styles.assignedDocumentCopy}>
                          <Text style={styles.assignedDocumentTitle}>
                            {document.title}
                          </Text>
                          <Text style={styles.assignedDocumentMeta}>
                            {definition?.label ?? "Offboarding-Unterlage"} ·{" "}
                            {document.fileName} ·{" "}
                            {formatDateTime(document.createdAt)}
                          </Text>
                          <Text style={styles.assignedDocumentSecurity}>
                            Vertraulich · nicht für das Mitarbeitendenportal
                            freigegeben
                          </Text>
                        </View>
                        {canManage ? (
                          confirmDelete ? (
                            <View style={styles.documentDeleteActions}>
                              <Text style={styles.documentDeleteWarning}>
                                Datei wirklich entfernen?
                              </Text>
                              <PremiumButton
                                title="Entfernen bestätigen"
                                size="sm"
                                variant="danger"
                                loading={
                                  busyAction ===
                                  `document-delete-${document.id}`
                                }
                                onPress={() =>
                                  removeOffboardingDocument(document)
                                }
                              />
                              <PremiumButton
                                title="Abbrechen"
                                size="sm"
                                variant="secondary"
                                onPress={() => setPendingDocumentDeleteId(null)}
                              />
                            </View>
                          ) : (
                            <PremiumButton
                              title="Zuordnung korrigieren"
                              size="sm"
                              variant="secondary"
                              onPress={() =>
                                setPendingDocumentDeleteId(document.id)
                              }
                            />
                          )
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </SectionPanel>

      <SectionPanel
        title="Prüfpfad und Verantwortungsnachweis"
        subtitle="Chronologische, unveränderbare Historie aller Offboarding-Aktionen"
      >
        {auditQuery.loading && auditEvents.length === 0 ? (
          <LoadingState message="Prüfpfad wird geladen…" />
        ) : auditQuery.error ? (
          <InfoBanner
            title="Prüfpfad konnte nicht geladen werden"
            message={auditQuery.error}
            variant="danger"
            presentation="inline"
          />
        ) : auditEvents.length === 0 ? (
          <InfoBanner
            title="Noch keine protokollierten Aktionen"
            message="Mit dem verbindlichen Start des Offboardings wird der erste Audit-Eintrag erzeugt."
            variant="info"
            presentation="inline"
          />
        ) : (
          <View style={styles.auditList}>
            {auditEvents.slice(0, 12).map((event, index) => (
              <View key={event.id} style={styles.auditRow}>
                <View style={styles.auditRail}>
                  <View style={styles.auditDot} />
                  {index < Math.min(auditEvents.length, 12) - 1 ? (
                    <View style={styles.auditLine} />
                  ) : null}
                </View>
                <View style={styles.auditCopy}>
                  <View style={styles.auditHeader}>
                    <Text style={styles.auditTitle}>
                      {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                    </Text>
                    <Text style={styles.auditTime}>
                      {formatDateTime(event.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.auditDetail}>{event.detail}</Text>
                  <Text style={styles.auditActor}>
                    {event.actorId
                      ? "Durch berechtigte Personalverantwortung"
                      : "Automatische Systemprüfung"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionPanel>

      {!archived && canManage ? (
        <SectionPanel
          title="Endfreigabe und revisionssichere Archivierung"
          subtitle="Dreistufige Abschlusskontrolle: Protokoll → Endfreigabe → Archivierung"
        >
          <InfoBanner
            title="Kein Löschen – vollständige Nachweisführung"
            message="Ehemalige Mitarbeitende werden nicht gelöscht. Erst nach bestandener Live-Prüfung, vollständigen Unterlagen, gesperrten Zugängen und erzeugtem Abschlussprotokoll wird die operative Nutzung beendet und die Personalakte archiviert."
            variant="warning"
            presentation="inline"
          />
          <View style={styles.clearanceGrid}>
            <ClearanceStage
              number={1}
              title="Abschlussprotokoll"
              description="Fasst Austritt, Rückgaben, Zugänge, Unterlagen und Prüfstatus verbindlich zusammen."
              done={!!progress.clearance?.protocolGeneratedAt}
              blocked={!protocolReady}
            />
            <ClearanceStage
              number={2}
              title="Endfreigabe"
              description="Bestätigt im Vier-Augen-Prinzip, dass keine operative oder abrechnungsrelevante Pflicht offen ist."
              done={!!progress.clearance?.clearedAt}
              blocked={!clearanceReady}
            />
            <ClearanceStage
              number={3}
              title="Personalakte archivieren"
              description="Beendet die operative Nutzung, erhält aber den vollständigen und auditierbaren Datensatz."
              done={archived}
              blocked={!progress.clearance?.clearedAt}
            />
          </View>
          {!protocolReady && !progress.clearance?.protocolGeneratedAt ? (
            <InfoBanner
              title="Abschlussprotokoll noch blockiert"
              message={`${unresolvedCount} Pflichtpunkt(e) sind noch offen. Bearbeiten Sie zuerst den Handlungsbedarf und aktualisieren Sie anschließend die Live-Prüfung.`}
              variant="danger"
              presentation="inline"
            />
          ) : null}
          <View style={[styles.actionsRow, compact && styles.stack]}>
            <PremiumButton
              title={
                progress.clearance?.protocolGeneratedAt
                  ? "Abschlussprotokoll erstellt"
                  : "Abschlussprotokoll erstellen"
              }
              variant="secondary"
              disabled={
                !!progress.clearance?.protocolGeneratedAt || !protocolReady
              }
              loading={busyAction === "protocol"}
              onPress={() =>
                tenantId &&
                id &&
                runAction(
                  "protocol",
                  "Abschlussprotokoll wurde erstellt.",
                  () =>
                    generateOffboardingCompletionProtocol(
                      tenantId,
                      id,
                      profile?.roleKey,
                      profile?.id,
                    ),
                )
              }
            />
            <PremiumButton
              title={
                progress.clearance?.clearedAt
                  ? "Endfreigabe erteilt"
                  : "Endfreigabe erteilen"
              }
              variant="secondary"
              disabled={!!progress.clearance?.clearedAt || !clearanceReady}
              loading={busyAction === "clearance"}
              onPress={() =>
                tenantId &&
                id &&
                runAction("clearance", "Endfreigabe wurde erteilt.", () =>
                  completeOffboardingFinalClearance(
                    tenantId,
                    id,
                    profile?.roleKey,
                    profile?.id,
                  ),
                )
              }
            />
            <PremiumButton
              title="Ehemalige Mitarbeitende archivieren"
              disabled={!progress.clearance?.clearedAt}
              loading={busyAction === "archive"}
              onPress={() =>
                tenantId &&
                id &&
                runAction("archive", "Personalakte wurde archiviert.", () =>
                  archiveOffboardingPersonnelFile(
                    tenantId,
                    id,
                    profile?.roleKey,
                    profile?.id,
                  ),
                )
              }
            />
          </View>
        </SectionPanel>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <View style={embeddedInModal ? styles.embeddedModal : styles.embedded}>
        {body}
      </View>
    );
  }

  return (
    <ScreenShell
      title="Kündigung / Offboarding"
      subtitle={progress.employeeName}
      showBack
      onBack={() => router.back()}
      scroll
    >
      {body}
    </ScreenShell>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === "success" && styles.metricCardSuccess,
        tone === "warning" && styles.metricCardWarning,
        tone === "danger" && styles.metricCardDanger,
      ]}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function ClearanceStage({
  number,
  title,
  description,
  done,
  blocked,
}: {
  number: number;
  title: string;
  description: string;
  done: boolean;
  blocked: boolean;
}) {
  return (
    <View style={[styles.clearanceCard, done && styles.clearanceCardDone]}>
      <View
        style={[styles.clearanceNumber, done && styles.clearanceNumberDone]}
      >
        <Text
          style={[
            styles.clearanceNumberText,
            done && styles.clearanceNumberTextDone,
          ]}
        >
          {done ? "✓" : number}
        </Text>
      </View>
      <Text style={styles.clearanceTitle}>{title}</Text>
      <Text style={styles.clearanceDescription}>{description}</Text>
      <Text
        style={[
          styles.statusPill,
          done
            ? styles.statusPillDone
            : blocked
              ? styles.statusPillBlocked
              : styles.statusPillPending,
        ]}
      >
        {done ? "Abgeschlossen" : blocked ? "Noch gesperrt" : "Bereit"}
      </Text>
    </View>
  );
}

function formatDisplayDate(value?: string | null): string {
  if (!value) return "nicht festgelegt";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE").format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "noch nicht geprüft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const styles = StyleSheet.create({
  embedded: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  embeddedModal: {
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  heroIdentity: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#0879F5",
    fontWeight: "900",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: "#09213F",
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#526A84",
    marginTop: spacing.xs,
  },
  heroStatus: {
    minWidth: 132,
    borderWidth: 1,
    borderColor: "#7DE0B2",
    backgroundColor: "#E8FBF1",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "flex-end",
  },
  heroStatusBlocked: {
    borderColor: "#FFB1BC",
    backgroundColor: "#FFF0F2",
  },
  heroStatusText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#08735A",
    fontWeight: "900",
  },
  heroStatusTextBlocked: {
    color: "#A62039",
  },
  heroPercent: {
    fontSize: 24,
    lineHeight: 29,
    color: "#09213F",
    fontWeight: "900",
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 170,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.lg,
    backgroundColor: "#F7FBFF",
    padding: spacing.md,
  },
  metricCardSuccess: {
    borderColor: "#91E2BB",
    backgroundColor: "#F1FCF6",
  },
  metricCardWarning: {
    borderColor: "#F4CF75",
    backgroundColor: "#FFF9E9",
  },
  metricCardDanger: {
    borderColor: "#FFB1BC",
    backgroundColor: "#FFF3F5",
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#526A84",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 28,
    color: "#09213F",
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  metricHelper: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526A84",
    marginTop: 2,
  },
  progressTrack: {
    height: 12,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "#D8E7F7",
    marginTop: spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#0879F5",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusLabel: {
    ...typography.label,
    color: "#09213F",
  },
  progressLabel: {
    ...typography.label,
    color: "#056CE8",
  },
  nextAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: "#8CC3FA",
    borderRadius: radius.lg,
    backgroundColor: "#EAF5FF",
    padding: spacing.md,
  },
  nextActionNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0879F5",
  },
  nextActionNumberText: {
    fontSize: 17,
    color: "#FFFFFF",
    fontWeight: "900",
  },
  nextActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextActionEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    color: "#056CE8",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  nextActionTitle: {
    fontSize: 18,
    lineHeight: 23,
    color: "#09213F",
    fontWeight: "900",
    marginTop: 2,
  },
  nextActionText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#395571",
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phaseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  phaseCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 210,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.lg,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
  },
  phaseCardBlocked: {
    borderColor: "#F0B1BA",
    backgroundColor: "#FFF7F8",
  },
  phaseCardDone: {
    borderColor: "#83DCAE",
    backgroundColor: "#F3FCF7",
  },
  phaseNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEEFF",
  },
  phaseNumberDone: {
    backgroundColor: "#DDF7EF",
  },
  phaseNumberText: {
    color: "#056CE8",
    fontWeight: "900",
  },
  phaseNumberTextDone: {
    color: "#08735A",
  },
  phaseTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#09213F",
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  phaseSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526A84",
    marginTop: 2,
  },
  phaseFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phaseCount: {
    fontSize: 13,
    color: "#395571",
    fontWeight: "800",
  },
  phaseState: {
    fontSize: 13,
    color: "#08735A",
    fontWeight: "900",
  },
  phaseStateBlocked: {
    color: "#A62039",
  },
  formSection: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: "#09213F",
    marginBottom: spacing.xs,
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#9CC8F7",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "#F5FAFF",
  },
  choiceSelected: {
    borderColor: "#056CE8",
    backgroundColor: "#DCEEFF",
  },
  choiceText: {
    ...typography.caption,
    color: "#395571",
    fontWeight: "800",
  },
  choiceTextSelected: {
    color: "#045BBF",
  },
  blockerList: {
    gap: spacing.sm,
  },
  blockerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#F0B1BA",
    borderRadius: radius.lg,
    backgroundColor: "#FFF6F7",
    padding: spacing.md,
  },
  blockerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9354D",
  },
  blockerIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  blockerCopy: {
    flex: 1,
    minWidth: 0,
  },
  blockerTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: "#7E1730",
    fontWeight: "900",
  },
  blocker: {
    fontSize: 14,
    lineHeight: 20,
    color: "#8A1830",
    marginTop: 2,
  },
  liveSource: {
    fontSize: 12,
    lineHeight: 17,
    color: "#526A84",
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  productionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  productionCard: {
    flexGrow: 1,
    flexBasis: 350,
    minWidth: 280,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  productionCardDone: {
    borderColor: "#86DBAE",
    backgroundColor: "#F2FCF7",
  },
  productionCardOpen: {
    borderColor: "#F2B4BD",
    backgroundColor: "#FFF6F7",
  },
  productionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  productionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
    color: "#09213F",
    fontWeight: "900",
  },
  productionMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: "#395571",
    marginTop: spacing.sm,
  },
  checkCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D96C7D",
    backgroundColor: "#FFFFFF",
  },
  checkCircleDone: {
    borderColor: "#188A6B",
    backgroundColor: "#DDF7EF",
  },
  checkMark: {
    color: "#C9354D",
    fontWeight: "900",
  },
  checkMarkDone: {
    color: "#08735A",
  },
  statusPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 99,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  statusPillDone: {
    color: "#08735A",
    backgroundColor: "#DDF7EF",
  },
  statusPillBlocked: {
    color: "#A62039",
    backgroundColor: "#FFE4E8",
  },
  statusPillPending: {
    color: "#8A5B00",
    backgroundColor: "#FFF0C7",
  },
  liveFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#BBD5EE",
    paddingTop: spacing.md,
  },
  liveFooterCopy: {
    flex: 1,
    minWidth: 0,
  },
  liveFooterTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "900",
  },
  liveFooterText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#526A84",
    marginTop: 2,
  },
  accessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  accessCard: {
    flexGrow: 1,
    flexBasis: 250,
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#F0B1BA",
    borderRadius: radius.lg,
    backgroundColor: "#FFF8F9",
    padding: spacing.md,
  },
  accessCardDone: {
    borderColor: "#86DBAE",
    backgroundColor: "#F3FCF7",
  },
  accessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  accessTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    color: "#09213F",
    fontWeight: "900",
  },
  accessDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#395571",
    marginTop: spacing.sm,
  },
  accessMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: "#607A94",
    marginTop: spacing.sm,
  },
  returnList: {
    gap: spacing.sm,
  },
  returnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.md,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
  },
  returnText: {
    flex: 1,
    minWidth: 0,
  },
  returnTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "900",
  },
  returnMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#526A84",
    marginTop: 2,
  },
  workflowList: {
    gap: spacing.md,
  },
  workflowPhase: {
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  workflowPhaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#EAF5FF",
    padding: spacing.md,
  },
  workflowPhaseNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0879F5",
  },
  workflowPhaseNumberText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  workflowPhaseCopy: {
    flex: 1,
    minWidth: 0,
  },
  workflowPhaseTitle: {
    fontSize: 18,
    lineHeight: 23,
    color: "#09213F",
    fontWeight: "900",
  },
  workflowPhaseSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#526A84",
    marginTop: 2,
  },
  stepList: {
    gap: 0,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#BBD5EE",
    backgroundColor: "#FFFFFF",
  },
  stepCardDone: {
    backgroundColor: "#F5FCF8",
  },
  stepCardBlocked: {
    backgroundColor: "#FFF8F9",
  },
  stepMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    flex: 1,
    minWidth: 260,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#8AA9C8",
    backgroundColor: "#FFFFFF",
  },
  stepNumberDone: {
    borderColor: "#188A6B",
    backgroundColor: "#DDF7EF",
  },
  stepNumberBlocked: {
    borderColor: "#D96C7D",
    backgroundColor: "#FFE4E8",
  },
  stepNumberText: {
    color: "#526A84",
    fontSize: 13,
    fontWeight: "900",
  },
  stepNumberTextDone: {
    color: "#08735A",
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: "#09213F",
    fontWeight: "900",
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#395571",
    marginTop: 2,
  },
  stepNote: {
    fontSize: 12,
    lineHeight: 17,
    color: "#607A94",
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  stepActionColumn: {
    minWidth: 150,
    maxWidth: 300,
    alignItems: "stretch",
    gap: spacing.xs,
  },
  manualEvidence: {
    minWidth: 220,
    marginTop: spacing.sm,
  },
  documentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  documentCard: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 260,
    borderWidth: 1,
    borderColor: "#F0B1BA",
    borderRadius: radius.lg,
    backgroundColor: "#FFF8F9",
    padding: spacing.md,
  },
  documentCardDone: {
    borderColor: "#86DBAE",
    backgroundColor: "#F3FCF7",
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  documentTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: "#09213F",
    fontWeight: "900",
  },
  documentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: 5,
  },
  documentCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    overflow: "hidden",
    backgroundColor: "#FFE4E8",
    color: "#A62039",
    fontWeight: "900",
  },
  documentCheckDone: {
    backgroundColor: "#DDF7EF",
    color: "#08735A",
  },
  documentItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#395571",
  },
  documentUploadPanel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#8DC5F7",
    borderRadius: radius.lg,
    backgroundColor: "#F4FAFF",
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  documentUploadHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  documentUploadCopy: {
    flex: 1,
    minWidth: 240,
  },
  documentUploadTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: "#09213F",
    fontWeight: "900",
  },
  documentUploadSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#526A84",
    marginTop: 3,
  },
  documentTypeHelper: {
    fontSize: 13,
    lineHeight: 19,
    color: "#395571",
    fontWeight: "700",
    marginTop: -spacing.sm,
  },
  documentPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
  },
  documentPickerCopy: {
    flex: 1,
    minWidth: 220,
  },
  documentPickerLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "900",
  },
  documentPickerMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#607A94",
    marginTop: 2,
  },
  documentPackageCopy: {
    flex: 1,
    minWidth: 180,
  },
  documentPackageMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#607A94",
    fontWeight: "700",
    marginTop: 2,
  },
  documentItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  documentItemTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "800",
  },
  documentPackageHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#526A84",
    fontWeight: "700",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C8DDF0",
  },
  assignedDocumentsPanel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.lg,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  assignedDocumentList: {
    gap: spacing.sm,
  },
  assignedDocumentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "#D3E3F2",
    borderRadius: radius.md,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
  },
  assignedDocumentIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEEFF",
    borderWidth: 1,
    borderColor: "#8DC5F7",
  },
  assignedDocumentIconText: {
    color: "#056CE8",
    fontSize: 15,
    fontWeight: "900",
  },
  assignedDocumentCopy: {
    flex: 1,
    minWidth: 220,
  },
  assignedDocumentTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "900",
  },
  assignedDocumentMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526A84",
    marginTop: 2,
  },
  assignedDocumentSecurity: {
    fontSize: 12,
    lineHeight: 18,
    color: "#08735A",
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  documentDeleteActions: {
    minWidth: 190,
    gap: spacing.xs,
  },
  documentDeleteWarning: {
    fontSize: 12,
    lineHeight: 17,
    color: "#A62039",
    fontWeight: "900",
  },
  auditList: {
    gap: 0,
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
    minHeight: 72,
  },
  auditRail: {
    width: 24,
    alignItems: "center",
  },
  auditDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#0879F5",
    marginTop: 5,
  },
  auditLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#BFD8F1",
    marginTop: 3,
  },
  auditCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: spacing.md,
  },
  auditHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  auditTitle: {
    flex: 1,
    minWidth: 180,
    fontSize: 15,
    lineHeight: 20,
    color: "#09213F",
    fontWeight: "900",
  },
  auditTime: {
    fontSize: 12,
    lineHeight: 17,
    color: "#607A94",
  },
  auditDetail: {
    fontSize: 13,
    lineHeight: 19,
    color: "#395571",
    marginTop: 3,
  },
  auditActor: {
    fontSize: 12,
    lineHeight: 17,
    color: "#607A94",
    marginTop: 2,
  },
  clearanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  clearanceCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 230,
    borderWidth: 1,
    borderColor: "#BFD8F1",
    borderRadius: radius.lg,
    backgroundColor: "#F8FBFF",
    padding: spacing.md,
  },
  clearanceCardDone: {
    borderColor: "#86DBAE",
    backgroundColor: "#F3FCF7",
  },
  clearanceNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEEFF",
  },
  clearanceNumberDone: {
    backgroundColor: "#DDF7EF",
  },
  clearanceNumberText: {
    color: "#056CE8",
    fontSize: 15,
    fontWeight: "900",
  },
  clearanceNumberTextDone: {
    color: "#08735A",
  },
  clearanceTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#09213F",
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  clearanceDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526A84",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
