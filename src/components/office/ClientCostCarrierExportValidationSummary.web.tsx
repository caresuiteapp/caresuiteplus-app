import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { SGB_XI_105_EXPORT_PROFILE } from '@/lib/pflege/careCostCarrierExportDomain';
import { listCareCostCarrierExportCandidates } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';

export function ClientCostCarrierExportValidationSummary({ clientId }: { clientId: string }) {
  const tenantId=useServiceTenantId();const {roleKey}=usePermissions();
  const query=useAsyncQuery(()=>tenantId&&clientId?listCareCostCarrierExportCandidates(tenantId,roleKey,clientId):Promise.resolve({ok:false as const,error:'Kein Mandant oder Pflegefall.'}),[tenantId,roleKey,clientId],{enabled:Boolean(tenantId&&clientId)});
  if(query.loading&&!query.data)return <LoadingState message="Kostenträgerexporte werden geprüft…"/>;
  if(query.error&&!query.data)return <ErrorState message={query.error} onRetry={query.refresh}/>;
  const candidates=query.data??[];
  return <SectionPanel title="DTA- und Kostenträgerexport" subtitle="Dateifassung und Formatprüfung getrennt von Übermittlung und Annahme">
    <PremiumCard style={{marginBottom:spacing.sm}}>
      <PremiumBadge label="§105 SGB XI · aktuelles Empfangsprofil" variant="orange"/>
      <Text style={{...typography.label,marginTop:spacing.xs}}>TA 1 {SGB_XI_105_EXPORT_PROFILE.technicalSpecificationVersion} · TA 3 {SGB_XI_105_EXPORT_PROFILE.keyDirectoryVersion} · Kostenträgerformat {SGB_XI_105_EXPORT_PROFILE.carrierDirectoryFormatVersion}</Text>
      <Text style={{...typography.caption,marginTop:spacing.xs}}>Gültig {SGB_XI_105_EXPORT_PROFILE.validFrom} bis {SGB_XI_105_EXPORT_PROFILE.validUntil}. Das Profil gilt nicht für §302 SGB V.</Text>
    </PremiumCard>
    {candidates.length===0?<EmptyState title="Keine exportprüfbare Freigabefassung" message="Benötigt wird eine unveränderte, noch nicht übertragene §105-SGB-XI-Freigabe mit Kostenträger-IK."/>:candidates.map((candidate)=><PremiumCard key={candidate.approvalId} style={{marginBottom:spacing.sm}}>
      <PremiumBadge label="Formatprüfung ausstehend" variant="orange"/>
      <Text style={{...typography.label,marginTop:spacing.xs}}>{candidate.invoiceNumber} · {candidate.recipientName}</Text>
      <Text style={{...typography.caption,marginTop:spacing.xs}}>IK {candidate.recipientIk} · {formatCurrency(candidate.totalAmountCents,true)} · Freigabeversion {candidate.approvalVersion}</Text>
      <View style={{marginTop:spacing.xs,gap:spacing.xs}}>
        <Text style={typography.caption}>Erforderlich: unveränderte Nutz- und Auftragsdatei mit SHA-256, konkrete Kostenträgerdatei und darin aufgelöste Annahme-, physische Empfänger- und Verschlüsselungs-IK.</Text>
        <Text style={typography.caption}>Erforderlich: unabhängiger Validator mit Version und Regelsatz-Fingerprint; sein Protokoll muss exakt dieselben Dateihashes nennen.</Text>
      </View>
    </PremiumCard>)}
    <Text style={{...typography.caption,color:colors.textSecondary}}>Eine erzeugte oder lokal formatgeprüfte Datei gilt weiterhin als nicht übermittelt. Annahme, fachliche Verarbeitung und Zahlung werden nicht aus dem Prüfprotokoll abgeleitet.</Text>
  </SectionPanel>;
}
