import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareInvoicePeriodClosures } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';

export function ClientInvoicePeriodClosureSummary({clientId}:{clientId:string}){
  const tenantId=useServiceTenantId();const{roleKey}=usePermissions();
  const query=useAsyncQuery(()=>tenantId&&clientId?listCareInvoicePeriodClosures(tenantId,roleKey,clientId):Promise.resolve({ok:false as const,error:'Kein Mandant oder Pflegefall.'}),[tenantId,roleKey,clientId],{enabled:Boolean(tenantId&&clientId)});
  if(query.loading&&!query.data)return <LoadingState message="Periodenabschlüsse werden geladen…"/>;
  if(query.error&&!query.data)return <ErrorState message={query.error} onRetry={query.refresh}/>;
  const items=query.data??[];
  return <SectionPanel title="Abrechnungsperioden abschließen" subtitle="Unveränderlicher Abschluss mit späterer Korrekturperiode">
    {items.length===0?<EmptyState title="Kein Periodenabschluss" message="Ein Abschluss erscheint erst nach vollständiger Prüfung aller offenen Fälle und freigegebenen Rechnungsfassungen."/>:items.map(item=><PremiumCard key={item.periodClosureId} style={{marginBottom:spacing.sm}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:spacing.sm,flexWrap:'wrap'}}>
        <View style={{flex:1,minWidth:180}}><Text style={typography.label}>{item.periodFrom} bis {item.periodTo}</Text><Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Stichtag {item.cutoffAt} · Abschluss {item.closedAt}</Text></View>
        <PremiumBadge label="Unveränderlich geschlossen" variant="green"/>
      </View>
      <Text style={{...typography.caption,marginTop:spacing.sm}}>{item.invoiceCount} freigegebene Rechnungsfassung{item.invoiceCount===1?'':'en'} · {formatCurrency(item.invoiceTotalCents,true)} · 0 offene Fälle</Text>
      {item.invoiceApprovals.map(source=><Text key={source.invoiceApprovalId} style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>{source.invoiceDate} · {source.invoiceNumber} · Fassung {source.approvalVersion} · {formatCurrency(source.totalAmountCents,true)}</Text>)}
      <Text style={{...typography.caption,marginTop:spacing.sm}}>Abschlussfreigabe: {item.approvedByName} · Beleg {item.approvalEvidenceId}</Text>
      {item.corrections.length?<View style={{marginTop:spacing.sm}}><Text style={typography.label}>Spätere Korrekturen</Text>{item.corrections.map(correction=><Text key={correction.correctionId} style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Folgeperiode {correction.correctionPeriodFrom} bis {correction.correctionPeriodTo} · {formatCurrency(correction.amountDeltaCents,true)} · {correction.reason} · Beleg {correction.adjustmentEvidenceId}</Text>)}</View>:<Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.sm}}>Keine spätere Korrektur dokumentiert.</Text>}
    </PremiumCard>)}
    <Text style={{...typography.caption,color:colors.textSecondary}}>Ein Abschluss verändert keine frühere Rechnung. Spätere Änderungen werden ausschließlich als belegte Folge in einer späteren Korrekturperiode geführt. Abschluss, Versand und Zahlung bleiben getrennt.</Text>
  </SectionPanel>;
}
