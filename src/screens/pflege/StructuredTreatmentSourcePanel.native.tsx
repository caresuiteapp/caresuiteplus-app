// Generated native presentation from src/screens/pflege/StructuredTreatmentSourcePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import {} from 'react-native';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchStructuredTreatmentProof } from '@/lib/pflege/treatmentExecutionService';
import { treatmentProfileVersion } from '@/lib/pflege/treatmentExecutionDomain';
import { OriginalTreatmentSection, useTreatmentCorrectionStyles } from "./TreatmentCorrectionScreen.native.tsx";
type Row = Record<string, unknown>;
export function StructuredTreatmentSourcePanel({ execution }: {
    execution: Row;
}) { const tenant = useServiceTenantId(), { profile } = useAuth(), p = usePermissions(); return <SourcePanel key={`${tenant}:${profile?.id}:${p.roleKey}:${execution.id}`} execution={execution} tenant={tenant ?? ''} role={p.roleKey}/>; }
function SourcePanel({ execution, tenant, role }: {
    execution: Row;
    tenant: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
}) {
    const [open, setOpen] = useState(false), styles = useTreatmentCorrectionStyles();
    let structured = false;
    try {
        structured = JSON.parse(String(execution.details)).profileVersion === treatmentProfileVersion;
    }
    catch { /* Legacy narrative remains visible in the containing record. */ }
    const q = useAsyncQuery(() => fetchStructuredTreatmentProof(tenant, execution, role), [tenant, execution, role], { enabled: open && structured, queryKey: `${tenant}:${role}:${execution.id}:structured-treatment-proof` });
    if (!structured)
        return null;
    return <SectionPanel title="Gesicherte damalige Entscheidungsgrundlagen"><PremiumButton title={open ? 'Quellenbelege ausblenden' : 'Gesicherte Quellenbelege laden und anzeigen'} variant="secondary" onPress={() => setOpen(v => !v)}/>{open ? <>{q.loading && !q.data ? <LoadingState message="Historische Quellenbezüge werden geladen und geprüft…"/> : !q.data ? <ErrorState message={q.error ?? 'Gesicherte Quellen nicht vollständig zugänglich.'} onRetry={q.refresh}/> : null}{q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{q.data ? <><InfoBanner variant="info" message="Damals gespeicherte Quellenstände. Spätere Anordnungsänderungen ersetzen diese Belege nicht. Heutige Gültigkeit, spätere Berichtigungen und fachliche Freigaben gesondert prüfen."/>{q.data.order_snapshot ? <SectionPanel title="Damals zugeordnete ärztliche Anordnung"><OriginalTreatmentSection value={Object.fromEntries(['id', 'title', 'description', 'ordering_physician', 'ordered_at', 'valid_from', 'valid_until', 'frequency', 'execution_instructions', 'qualification_requirement', 'source_document', 'insurer_approval_status', 'insurer_approval_reference'].map(k => [k, (q.data!.order_snapshot as Row)[k] ?? null]))}/></SectionPanel> : <Text style={styles.body}>Keine bestätigte ärztliche Quelle zugeordnet; dokumentierten Klärungsbedarf im Durchführungstext beachten.</Text>}{q.data.administration_snapshot ? <SectionPanel title="Damals zugeordneter tatsächlicher Gabenachweis"><OriginalTreatmentSection value={{ medicationName: ((q.data.administration_snapshot as Row).order_snapshot as Row)?.name, administeredDose: (q.data.administration_snapshot as Row).administered_dose, route: (q.data.administration_snapshot as Row).route, occurredAt: (q.data.administration_snapshot as Row).occurred_at }}/></SectionPanel> : null}{q.data.measurement_snapshot ? <SectionPanel title="Damals zugeordneter tatsächlicher Messnachweis"><OriginalTreatmentSection value={{ measurementType: (q.data.measurement_snapshot as Row).vital_key, measurementValue: (q.data.measurement_snapshot as Row).display_value, measurementUnit: (q.data.measurement_snapshot as Row).unit, occurredAt: (q.data.measurement_snapshot as Row).occurred_at }}/></SectionPanel> : null}</> : null}</> : null}</SectionPanel>;
}
