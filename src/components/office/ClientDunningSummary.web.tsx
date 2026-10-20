import { useState } from 'react';
import { Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareDunningStatus } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';

const stateLabel={eligible:'Nächste Stufe prüfbar',not_due:'Noch nicht überfällig',awaiting_review_date:'Prüfdatum ausstehend',settled:'Bezahlt',maximum_stage_reached:'Letzte Stufe erreicht'} as const;
const stageLabel={payment_reminder:'Zahlungserinnerung',first_notice:'1. Mahnung',second_notice:'2. Mahnung',final_notice:'Letzte Mahnung'} as const;

export function ClientDunningSummary({clientId}:{clientId:string}){
  const tenantId=useServiceTenantId();const{roleKey}=usePermissions();
  const[evaluatedAt]=useState(()=>new Date().toISOString().replace('Z','000Z'));const asOfDate=evaluatedAt.slice(0,10);
  const query=useAsyncQuery(()=>tenantId&&clientId?listCareDunningStatus(tenantId,roleKey,clientId,asOfDate,evaluatedAt):Promise.resolve({ok:false as const,error:'Kein Mandant oder Pflegefall.'}),[tenantId,roleKey,clientId,asOfDate,evaluatedAt],{enabled:Boolean(tenantId&&clientId)});
  if(query.loading&&!query.data)return <LoadingState message="Mahnwesen wird geladen…"/>;
  if(query.error&&!query.data)return <ErrorState message={query.error} onRetry={query.refresh}/>;
  const summary=query.data;
  return <SectionPanel title="Mahnwesen" subtitle={`Stand ${asOfDate} · Zahlung vor jedem Schritt neu prüfen`}>
    {!summary||summary.items.length===0?<EmptyState title="Keine Forderungen für das Mahnwesen" message="Mahnungen entstehen nicht aus einer Rechnung oder Fälligkeit allein."/>:summary.items.map((item)=>{
      const lastNotice=item.notices.at(-1);
      return <PremiumCard key={item.openItem.openItemId} style={{marginBottom:spacing.sm}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:spacing.sm,flexWrap:'wrap'}}>
          <View style={{flex:1,minWidth:180}}><Text style={typography.label}>{item.openItem.invoiceNumber}</Text><Text style={{...typography.caption,color:colors.textMuted,marginTop:spacing.xs}}>Fällig {item.openItem.dueDate} · Rest {formatCurrency(item.openItem.remainingAmountCents,true)}</Text></View>
          <PremiumBadge label={stateLabel[item.currentState]} variant={item.currentState==='settled'?'green':item.currentState==='eligible'?'orange':'muted'}/>
        </View>
        <Text style={{...typography.caption,marginTop:spacing.sm}}>Letzte Stufe {lastNotice?stageLabel[lastNotice.stage]:'Keine'} · Versand {item.lastNoticeDispatchState==='dispatched'?'belegt':item.lastNoticeDispatchState==='not_dispatched'?'nicht belegt':'entfällt'}</Text>
        {item.nextStage?<Text style={{...typography.caption,marginTop:spacing.xs}}>Nächste prüfbare Stufe: {stageLabel[item.nextStage]}</Text>:null}
        {item.paymentChangedSinceLastNotice?<Text style={{...typography.caption,color:colors.textSecondary,marginTop:spacing.sm}}>Der Zahlungsstand hat sich seit der letzten Stufe geändert. Betrag und Berechtigung müssen vor einem weiteren Schritt neu bestätigt werden.</Text>:null}
      </PremiumCard>;
    })}
    <Text style={{...typography.caption,color:colors.textSecondary}}>Eine zwischenzeitliche Zahlung sperrt einen unveränderten Versand oder aktualisiert den nächsten Mahnbetrag. Empfängerberechtigung, Versandnachweis, Gebühren, Zinsen und Vollstreckung bleiben eigene Nachweise und werden nicht automatisch abgeleitet.</Text>
  </SectionPanel>;
}
