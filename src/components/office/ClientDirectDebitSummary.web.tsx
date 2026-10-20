import { useState } from 'react';
import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareDirectDebitStatus } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';

const mandateLabel={missing:'Fehlt',not_yet_valid:'Noch nicht gültig',active:'Aktiv',expired:'Abgelaufen',revoked:'Widerrufen'} as const;
const eligibilityLabel={eligible:'Freigabe prüfbar',missing_mandate:'Mandat fehlt',invalid_mandate:'Mandat ungültig',settled:'Forderung ausgeglichen',amount_changed:'Betrag neu prüfen',already_released:'Datei freigegeben'} as const;

export function ClientDirectDebitSummary({clientId}:{clientId:string}){
  const tenantId=useServiceTenantId();const{roleKey}=usePermissions();
  const[evaluatedAt]=useState(()=>new Date().toISOString().replace('Z','000Z'));const asOfDate=evaluatedAt.slice(0,10);
  const query=useAsyncQuery(()=>tenantId&&clientId?listCareDirectDebitStatus(tenantId,roleKey,clientId,asOfDate,evaluatedAt):Promise.resolve({ok:false as const,error:'Kein Mandant oder Pflegefall.'}),[tenantId,roleKey,clientId,asOfDate,evaluatedAt],{enabled:Boolean(tenantId&&clientId)});
  if(query.loading&&!query.data)return <LoadingState message="Einzugsgrundlagen werden geladen…"/>;
  if(query.error&&!query.data)return <ErrorState message={query.error} onRetry={query.refresh}/>;
  const summary=query.data;
  return <SectionPanel title="Bank und Einzugsmandat" subtitle={`Stand ${asOfDate} · Mandat und Zahlungsstand vor Dateifreigabe neu lesen`}>
    {!summary||summary.items.length===0?<EmptyState title="Keine offenen Einzugsposten" message="Ein Mandat allein erzeugt weder einen Einzugsauftrag noch eine Zahlung."/>:summary.items.map((item)=>{
      const order=item.orders.at(-1);const release=order?item.releases.find(value=>value.directDebitOrderId===order.directDebitOrderId):undefined;const returned=release?item.returns.find(value=>value.directDebitReleaseId===release.directDebitReleaseId):undefined;
      return <PremiumCard key={item.openItem.openItemId} style={{marginBottom:spacing.sm}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:spacing.sm,flexWrap:'wrap'}}>
          <View style={{flex:1,minWidth:180}}><Text style={typography.label}>{item.openItem.invoiceNumber}</Text><Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Rest {formatCurrency(item.openItem.remainingAmountCents,true)} · Einzug {order?.collectionDate??'nicht vorbereitet'}</Text></View>
          <PremiumBadge label={eligibilityLabel[item.releaseEligibility]} variant={item.releaseEligibility==='eligible'?'green':item.releaseEligibility==='already_released'?'muted':'orange'}/>
        </View>
        <Text style={{...typography.caption,marginTop:spacing.sm}}>Mandatsgrundlage: {mandateLabel[item.mandateState]}{item.mandate?` · ${item.mandate.mandateReference} · Konto-Fingerprint ${item.mandate.debtorAccountFingerprint}`:''}</Text>
        {item.mandate?<Text style={{...typography.caption,marginTop:spacing.xs}}>Gültigkeit {item.mandate.validFrom} bis {item.mandate.validUntil??'offen'} · Widerruf {item.mandate.revokedAt??'nicht dokumentiert'} · Beleg-Fingerprint {item.mandate.authorizationFingerprint}</Text>:null}
        {order?<Text style={{...typography.caption,marginTop:spacing.xs}}>Auftrag {formatCurrency(order.amountCents,true)} · Mandatsversion {item.mandate?.revision??'—'} · Vorbereitung belegt</Text>:null}
        {release?<Text style={{...typography.caption,marginTop:spacing.xs}}>Dateifreigabe {release.releasedAt} · {release.exportFileName} · Datei-Fingerprint {release.exportFileFingerprint}</Text>:null}
        {returned?<Text style={{...typography.caption,marginTop:spacing.xs}}>Rücklastschrift {formatCurrency(returned.returnedAmountCents,true)} · {returned.returnCodeSystem} {returned.returnCode} · Wertstellung {returned.valueDate}</Text>:null}
        {item.amountChangedSinceOrder?<Text style={{...typography.caption,color:colors.textSecondary,marginTop:spacing.sm}}>Der offene Betrag hat sich seit der Vorbereitung geändert; eine unveränderte Dateifreigabe ist gesperrt.</Text>:null}
      </PremiumCard>;
    })}
    <Text style={{...typography.caption,color:colors.textSecondary}}>Eine Dateifreigabe ist keine Zahlung. Eine Rücklastschrift bleibt ein separates Bankereignis; Zahlungsstatus, klinische Durchführung und Aufgabenabschluss werden nicht abgeleitet.</Text>
  </SectionPanel>;
}
