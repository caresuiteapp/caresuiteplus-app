import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareInvoiceCostShares } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';

const basisLabel={calculated:'Berechneter Eigenanteil',exemption:'Befreiung belegt',documented_zero:'Nullanteil dokumentiert',self_payer:'Selbstzahler'} as const;

export function ClientInvoiceCostShareSummary({clientId}:{clientId:string}){
  const tenantId=useServiceTenantId();const{roleKey}=usePermissions();
  const query=useAsyncQuery(()=>tenantId&&clientId?listCareInvoiceCostShares(tenantId,roleKey,clientId):Promise.resolve({ok:false as const,error:'Kein Mandant oder Pflegefall.'}),[tenantId,roleKey,clientId],{enabled:Boolean(tenantId&&clientId)});
  if(query.loading&&!query.data)return <LoadingState message="Kostenträger- und Eigenanteile werden geladen…"/>;
  if(query.error&&!query.data)return <ErrorState message={query.error} onRetry={query.refresh}/>;
  const items=query.data??[];
  return <SectionPanel title="Eigenanteil und Zuzahlung" subtitle="Freigegebener Leistungsbetrag = Kostenträgeranteil + Eigenanteil">
    {items.length===0?<EmptyState title="Keine Anteilsfeststellung" message="Anteile werden erst aus einer freigegebenen Rechnung und einer versionierten Leistungsgrundlage dokumentiert."/>:items.map(item=><PremiumCard key={item.costShareAssessmentId} style={{marginBottom:spacing.sm}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:spacing.sm,flexWrap:'wrap'}}>
        <View style={{flex:1,minWidth:180}}><Text style={typography.label}>{item.invoiceNumber}</Text><Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Grundlage {item.coverageBasisId} · Fassung {item.coverageBasisVersion}</Text></View>
        <PremiumBadge label="Centgenau abgestimmt" variant="green"/>
      </View>
      <Text style={{...typography.caption,marginTop:spacing.sm}}>Leistung {formatCurrency(item.totalAmountCents,true)} = Kostenträger {formatCurrency(item.coverageTotalCents,true)} + Eigenanteil {formatCurrency(item.personalTotalCents,true)}</Text>
      {item.lines.map(line=><View key={`${item.costShareAssessmentId}:${line.positionNo}`} style={{marginTop:spacing.sm}}>
        <Text style={typography.caption}>{line.positionNo}. {line.serviceDate} · {line.serviceCode} · {formatCurrency(line.approvedAmountCents,true)}</Text>
        <Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Kostenträger: {line.coverageRecipientName??'Keiner'} · {formatCurrency(line.coverageShareCents,true)} · Eigenanteil: {line.personalRecipientName} · {formatCurrency(line.personalShareCents,true)}</Text>
        <Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>{basisLabel[line.personalShareBasisKind]}{line.exemptionEvidenceId?` · Befreiungsbeleg ${line.exemptionEvidenceId}`:''}</Text>
      </View>)}
    </PremiumCard>)}
    <Text style={{...typography.caption,color:colors.textSecondary}}>Eine dokumentierte Aufteilung berechnet keine gesetzliche Zuzahlung. Sie belegt weder Versand noch Einzug oder Zahlung und verändert keine freigegebene Leistung.</Text>
  </SectionPanel>;
}
