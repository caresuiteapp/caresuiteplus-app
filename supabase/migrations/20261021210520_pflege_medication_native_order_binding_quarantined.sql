-- Staging foundation only: nullable structured facts, no legacy conversion or application grants.
alter table public.medications
 add column if not exists prescribed_dose text,
 add column if not exists dose_unit text,
 add column if not exists minimum_interval_minutes text,
 add column if not exists maximum_dose text,
 add column if not exists maximum_dose_unit text,
 add column if not exists maximum_period_hours text;

create or replace function care_private.medication_native_order(p_native jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare key text;result jsonb;
begin
 perform care_private.med_packet_require(jsonb_typeof(p_native)='object','Strukturierte native Verordnung fehlt.');
 foreach key in array array['name','active_ingredient','strength','form','dose_unit','route','prescribed_by','indication'] loop
  perform care_private.med_packet_require(care_private.med_packet_text(p_native->key,1),'Native Verordnungsangabe fehlt: '||key);
 end loop;
 perform care_private.med_packet_require(care_private.med_packet_decimal(p_native->'prescribed_dose') and (p_native->>'prescribed_dose')::numeric>0 and jsonb_typeof(p_native->'is_prn')='boolean','Native strukturierte Dosis oder Bedarfskennzeichnung fehlt.');
 perform care_private.med_packet_date(p_native->'start_date');
 perform care_private.med_packet_require(p_native ? 'end_date','Native Gültigkeitsgrenze fehlt.');
 if p_native->'end_date'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_date(p_native->'end_date')>=care_private.med_packet_date(p_native->'start_date'),'Native Gültigkeit widersprüchlich.');end if;
 if p_native->'is_prn'='true'::jsonb then
  foreach key in array array['minimum_interval_minutes','maximum_dose','maximum_period_hours'] loop
   perform care_private.med_packet_require(care_private.med_packet_decimal(p_native->key) and (p_native->>key)::numeric>0,'Native strukturierte Bedarfsgrenze fehlt: '||key);
  end loop;
  perform care_private.med_packet_require(care_private.med_packet_text(p_native->'maximum_dose_unit',1) and p_native->'maximum_dose_unit'=p_native->'dose_unit','Native Höchstmengeneinheit widersprüchlich.');
 else
  perform care_private.med_packet_require(p_native->'minimum_interval_minutes'='null'::jsonb and p_native->'maximum_dose'='null'::jsonb and p_native->'maximum_period_hours'='null'::jsonb and (p_native->'maximum_dose_unit'='null'::jsonb or p_native->>'maximum_dose_unit'=''),'Native Regelmedikation enthält Bedarfsgrenzen.');
 end if;
 result:=jsonb_build_object('medicationName',p_native->'name','activeIngredient',p_native->'active_ingredient','strength',p_native->'strength','form',p_native->'form','dose',p_native->'prescribed_dose','unit',p_native->'dose_unit','route',p_native->'route','prescriber',p_native->'prescribed_by','validFrom',p_native->'start_date','validUntil',p_native->'end_date','indication',p_native->'indication','isPrn',p_native->'is_prn','minimumIntervalMinutes',p_native->'minimum_interval_minutes','maximumDose',p_native->'maximum_dose','maximumDoseUnit',case when p_native->'is_prn'='true'::jsonb then p_native->'maximum_dose_unit' else '""'::jsonb end,'maximumPeriodHours',p_native->'maximum_period_hours');
 return result;
end $$;
revoke all on function care_private.medication_native_order(jsonb) from public,anon,authenticated;

create or replace function care_private.validate_medication_packet(p jsonb,p_actor uuid,p_sources jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e jsonb:=p->'entry';o jsonb:=e->'order';a jsonb:=e->'administration';sr jsonb:=e->'sourceReview';s jsonb:=e->'stock';k text:=e->>'kind';key text;item jsonb;ref jsonb;source_row jsonb;actual boolean;reference_at timestamptz;prior_balance numeric;last_stock jsonb;
begin
 perform care_private.med_packet_require(care_private.med_packet_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','medicationId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) and p->>'schemaVersion'='1' and p->>'action' in('create','revise') and p_actor is not null and p->>'actorId'=p_actor::text and octet_length(p::text)<=2000000,'Paketstruktur oder Akteursbindung fehlt.');
 foreach key in array array['requestId','tenantId','clientId','medicationId','actorId'] loop perform care_private.med_packet_require(care_private.med_packet_uuid(p->key),'Ungültige Paketidentität.');end loop;
 perform care_private.med_packet_require(p->'sources' is not distinct from p_sources and jsonb_typeof(p_sources)='object' and p_sources#>>'{order,medicationId}'=p->>'medicationId' and p_sources#>>'{order,clientId}'=p->>'clientId','Aktuelle Quellenbindung fehlt.');
 perform care_private.med_packet_require(care_private.med_packet_keys(e,array['kind','title','plannedAt','occurredAt','medicationId','clientId','orderVersion','sourceReview','order','schedule','administration','effect','safety','witness','stock','orderStatus','correction','lifecycle']) and e->>'medicationId'=p->>'medicationId' and e->>'clientId'=p->>'clientId' and care_private.med_packet_text(e->'title',3,300) and e->>'lifecycle' in('open','completed'),'Medikationsereignis unvollständig.');
 perform care_private.med_packet_require(k in('reconciliation','order_capture','schedule_version','administration','late_administration','non_administration','prn_administration','effect_review','safety_signal','controlled_witness','preparation_stock','order_pause_stop','prn_interval_check','maximum_dose_check','controlled_ledger','correction'),'Unbekannte Medikationsart.');
 perform care_private.med_packet_time(e->'plannedAt');perform care_private.med_packet_time(e->'orderVersion');
 if e->'occurredAt'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_time(e->'occurredAt')<=clock_timestamp(),'Zukünftiges tatsächliches Ereignis.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(sr,array['planFingerprint','documentIds','discrepancies','allergyState','allergyText','clarification','decision']) and sr->>'planFingerprint'=p_sources#>>'{order,fingerprint}' and e->>'orderVersion'=p_sources#>>'{order,updatedAt}' and sr->'allergyState'=p_sources#>'{allergies,state}' and sr->'allergyText'=p_sources#>'{allergies,text}' and care_private.med_packet_text(sr->'allergyText') and sr->>'decision' in('unresolved','confirmed','rejected') and care_private.med_packet_text(sr->'clarification') and care_private.med_packet_uuid_list(sr->'documentIds') and jsonb_typeof(sr->'discrepancies')='array','Quellen-, Allergie- oder Verordnungsfassung widersprüchlich.');
 perform care_private.med_packet_require(jsonb_array_length(sr->'discrepancies')<=2000,'Zu viele Differenzen.');
 for item in select value from jsonb_array_elements(sr->'discrepancies') loop perform care_private.med_packet_require(care_private.med_packet_text(item,3,1000),'Ungültige Differenz.');end loop;
 for ref in select value from jsonb_array_elements(sr->'documentIds') loop perform care_private.med_packet_require(exists(select 1 from jsonb_array_elements(p_sources->'documents') d where d->'id'=ref),'Dokument fehlt im Originalbestand.');end loop;
 if e->>'lifecycle'='completed' then perform care_private.med_packet_require(sr->>'decision'='confirmed','Ungeklärte Quelle sperrt Abschluss.');end if;
 if sr->>'decision'='confirmed' and jsonb_array_length(sr->'discrepancies')>0 then perform care_private.med_packet_require(care_private.med_packet_text(sr->'clarification',10),'Differenzen benötigen konkrete Klärung.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(o,array['medicationName','activeIngredient','strength','form','dose','unit','route','prescriber','validFrom','validUntil','indication','isPrn','minimumIntervalMinutes','maximumDose','maximumDoseUnit','maximumPeriodHours']),'Verordnungsstruktur fehlt.');
 foreach key in array array['medicationName','activeIngredient','strength','form','unit','route','prescriber','indication'] loop perform care_private.med_packet_require(care_private.med_packet_text(o->key,1),'Pflichtangabe der Verordnung fehlt.');end loop;
 perform care_private.med_packet_require(care_private.med_packet_decimal(o->'dose') and jsonb_typeof(o->'isPrn')='boolean','Dosis oder Bedarfskennzeichnung fehlt.');
 perform care_private.med_packet_date(o->'validFrom');if o->'validUntil'<>'null'::jsonb then perform care_private.med_packet_require(care_private.med_packet_date(o->'validUntil')>=care_private.med_packet_date(o->'validFrom'),'Verordnungsgültigkeit widersprüchlich.');end if;
 -- A candidate may stay unresolved in an open capture; confirmed facts must match the native row exactly.
 if not(k in('reconciliation','order_capture') and sr->>'decision' in('unresolved','rejected') and e->>'lifecycle'='open') then
  perform care_private.med_packet_require(o is not distinct from care_private.medication_native_order(p_sources#>'{order,payload}'),'Verordnungsangaben weichen vom strukturierten Datenbankoriginal ab.');
 end if;
 if o->'isPrn'='true'::jsonb then
  raise exception 'Native bestätigte Bedarfsgrenzen fehlen im aktuellen Quellenvertrag.' using errcode='42501';
  foreach key in array array['minimumIntervalMinutes','maximumDose','maximumPeriodHours'] loop perform care_private.med_packet_require(care_private.med_packet_decimal(o->key) and (o->>key)::numeric>0,'Bedarfsgrenzen fehlen.');end loop;
  perform care_private.med_packet_require(care_private.med_packet_text(o->'maximumDoseUnit',1),'Höchstmengeneinheit fehlt.');
 else perform care_private.med_packet_require(o->'minimumIntervalMinutes'='null'::jsonb and o->'maximumDose'='null'::jsonb and o->'maximumPeriodHours'='null'::jsonb and o->>'maximumDoseUnit'='','Regelmedikation enthält Bedarfsgrenzen.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(a,array['outcome','actualAt','actualDose','unit','route','performedBy','deviationReason','prnIndication','precedingAdministrationIds','intervalMinutes','maximumPeriodDose']) and care_private.med_packet_uuid_list(a->'precedingAdministrationIds') and care_private.med_packet_text(a->'unit') and care_private.med_packet_text(a->'route') and care_private.med_packet_text(a->'deviationReason') and care_private.med_packet_text(a->'prnIndication'),'Gabenstruktur fehlt.');
 actual:=k in('administration','late_administration','prn_administration');
 if actual then
  perform care_private.med_packet_require(sr->>'decision'='confirmed' and p_sources#>>'{order,status}'='active' and a->>'outcome' in('administered','late') and care_private.med_packet_decimal(a->'actualDose') and a->'unit'=o->'unit' and a->'route'=o->'route' and care_private.med_packet_uuid(a->'performedBy') and e->'occurredAt'=a->'actualAt','Tatsächliche Gabe ist nicht vollständig belegt.');
  reference_at:=care_private.med_packet_time(a->'actualAt');perform care_private.med_packet_require(reference_at<=clock_timestamp() and (reference_at at time zone 'Europe/Berlin')::date>=care_private.med_packet_date(o->'validFrom') and (o->'validUntil'='null'::jsonb or (reference_at at time zone 'Europe/Berlin')::date<=care_private.med_packet_date(o->'validUntil')),'Gabezeit außerhalb bestätigter Gültigkeit.');
  -- This safety packet may reference care performed through a native writer; it is not a substitute for that writer.
  perform care_private.med_packet_require(exists(select 1 from public.medication_administrations n where n.tenant_id=(p->>'tenantId')::uuid and n.client_id=(p->>'clientId')::uuid and n.medication_id=(p->>'medicationId')::uuid and n.status=a->>'outcome' and n.occurred_at=reference_at and n.administered_by=(a->>'performedBy')::uuid and n.administered_dose=a->>'actualDose' and n.route=a->>'route' and n.creation_payload->>'unit'=a->>'unit' and exists(select 1 from jsonb_array_elements(p_sources->'administrations') original where original->>'id'=n.id::text)),'Passender nativer Gabennachweis fehlt.');
  if k='late_administration' then perform care_private.med_packet_require(care_private.med_packet_text(a->'deviationReason',3),'Verspätungsgrund fehlt.');end if;
 elsif k='non_administration' then
  perform care_private.med_packet_require(a->>'outcome' in('omitted','refused','held') and e->'occurredAt'<>'null'::jsonb and a->'actualAt'='null'::jsonb and a->'actualDose'='null'::jsonb and a->'performedBy'='null'::jsonb and a->>'unit'='' and a->>'route'='' and care_private.med_packet_text(a->'deviationReason',3),'Nichtgabe darf keine tatsächliche Gabe behaupten.');
 else perform care_private.med_packet_require(a->>'outcome'='planned' and a->'actualAt'='null'::jsonb and a->'actualDose'='null'::jsonb,'Planung darf keine tatsächliche Gabe behaupten.');end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(e->'schedule',array['versionId','effectiveFrom','slots','changeReason']) and jsonb_typeof(e#>'{schedule,slots}')='array' and jsonb_array_length(e#>'{schedule,slots}')<=2000,'Gabeplanstruktur fehlt.');
 if k='schedule_version' then
  perform care_private.med_packet_require(care_private.med_packet_uuid(e#>'{schedule,versionId}') and care_private.med_packet_text(e#>'{schedule,changeReason}',10) and jsonb_array_length(e#>'{schedule,slots}')>0,'Gabeplanfassung fehlt.');perform care_private.med_packet_time(e#>'{schedule,effectiveFrom}');
  for item in select value from jsonb_array_elements(e#>'{schedule,slots}') loop perform care_private.med_packet_require(care_private.med_packet_keys(item,array['id','plannedAt','dose','unit','route']) and care_private.med_packet_uuid(item->'id') and care_private.med_packet_decimal(item->'dose') and item->'unit'=o->'unit' and item->'route'=o->'route','Gabeplanposition widersprüchlich.');perform care_private.med_packet_time(item->'plannedAt');end loop;
  perform care_private.med_packet_require((select count(distinct value->>'id') from jsonb_array_elements(e#>'{schedule,slots}'))=jsonb_array_length(e#>'{schedule,slots}'),'Doppelte Gabeplanposition.');
 end if;
 -- PRN calculations stay blocked until structured limits are bound to an authoritative native prescription.
 if k in('prn_administration','prn_interval_check','maximum_dose_check') then raise exception 'Native bestätigte Bedarfsgrenzen fehlen im aktuellen Quellenvertrag.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(e->'effect',array['administrationId','observedAt','observation','action','painScore']) and care_private.med_packet_keys(e->'safety',array['state','observation','suspectedRelation','reaction','clinicianContact','followUp']) and care_private.med_packet_keys(e->'witness',array['required','profileId','assertion','signedAt','signatureId','qualificationEvidence']),'Kontroll- oder Gegenkontrollstruktur fehlt.');
 if k='effect_review' then perform care_private.med_packet_require(care_private.med_packet_uuid(e#>'{effect,administrationId}') and care_private.med_packet_text(e#>'{effect,observation}',3) and care_private.med_packet_text(e#>'{effect,action}',3) and exists(select 1 from jsonb_array_elements(p_sources->'administrations') x where x->'id'=e#>'{effect,administrationId}' and x->>'status' in('administered','late')),'Wirkungskontrolle ohne tatsächliche Gabe.');perform care_private.med_packet_require(care_private.med_packet_time(e#>'{effect,observedAt}')<=clock_timestamp() and exists(select 1 from jsonb_array_elements(p_sources->'administrations') x where x->'id'=e#>'{effect,administrationId}' and x->'occurredAt'<>'null'::jsonb and care_private.med_packet_time(x->'occurredAt')<=care_private.med_packet_time(e#>'{effect,observedAt}')),'Zukünftige Wirkungskontrolle.');if e#>'{effect,painScore}'<>'null'::jsonb then perform care_private.med_packet_require(jsonb_typeof(e#>'{effect,painScore}')='number' and e#>>'{effect,painScore}' ~ '^(0|[1-9]|10)$','Ungültiger Schmerzwert.');end if;end if;
 if k='safety_signal' then perform care_private.med_packet_require(e#>>'{safety,state}'='suspected','Externe Bestätigung benötigt gesonderten verifizierten Originalbeleg.');foreach key in array array['observation','suspectedRelation','reaction','clinicianContact','followUp'] loop perform care_private.med_packet_require(care_private.med_packet_text(e->'safety'->key,3),'Sicherheitsverlauf unvollständig.');end loop;end if;
 if k in('controlled_witness','order_pause_stop','correction') then raise exception 'Originalbindung für Zweitsignatur, Verordnungsänderung oder Korrektur noch nicht serverseitig freigegeben.' using errcode='42501';end if;
 perform care_private.med_packet_require(care_private.med_packet_keys(s,array['operation','packageId','batch','expiry','quantity','unit','balanceBefore','balanceAfter','reason','responsibleBy']) and care_private.med_packet_keys(e->'orderStatus',array['current','next','effectiveAt','reason','authorizationId','followUpPlanId']) and care_private.med_packet_keys(e->'correction',array['targetEventId','reason','replacementEventId','approvedBy','approvedAt']),'Bestands- oder Freigabestruktur fehlt.');
 if k in('preparation_stock','controlled_ledger') then
  perform care_private.med_packet_require(s->>'operation' in('receipt','prepare','consumption','correction') and care_private.med_packet_uuid(s->'packageId') and care_private.med_packet_decimal(s->'quantity') and (s->>'quantity')::numeric>0 and care_private.med_packet_decimal(s->'balanceBefore') and care_private.med_packet_decimal(s->'balanceAfter') and care_private.med_packet_text(s->'unit',1) and s->>'responsibleBy'=p_actor::text,'Bestandsangaben oder Verantwortung fehlen.');
  select value into last_stock from jsonb_array_elements(p_sources->'stockMovements') where value->'packageId'=s->'packageId' order by care_private.med_packet_time(value->'recordedAt') desc,(value->>'id')::uuid desc limit 1;
  prior_balance:=case when last_stock is null then 0 else (last_stock->>'balanceAfter')::numeric end;
  perform care_private.med_packet_require((last_stock is not null or s->>'operation'='receipt') and (last_stock is null or last_stock->'unit'=s->'unit') and (s->>'balanceBefore')::numeric=prior_balance,'Vorbestand stimmt nicht mit letztem Original überein.');
  if s->>'operation'='receipt' then perform care_private.med_packet_require((s->>'balanceAfter')::numeric=prior_balance+(s->>'quantity')::numeric,'Zugangssumme falsch.');elsif s->>'operation' in('prepare','consumption') then perform care_private.med_packet_require((s->>'balanceAfter')::numeric=prior_balance-(s->>'quantity')::numeric,'Abgangssumme falsch.');else perform care_private.med_packet_require(care_private.med_packet_text(s->'reason',10),'Bestandskorrekturgrund fehlt.');end if;
  if s->>'operation'='prepare' then perform care_private.med_packet_require(care_private.med_packet_text(s->'reason',3),'Richtgrund fehlt.');end if;
  if k='controlled_ledger' then perform care_private.med_packet_require(care_private.med_packet_text(s->'batch',1),'Charge fehlt.');perform care_private.med_packet_date(s->'expiry');end if;
 end if;

 perform care_private.med_packet_require(e#>>'{orderStatus,next}'='unchanged' and e#>'{orderStatus,effectiveAt}'='null'::jsonb and e#>'{orderStatus,authorizationId}'='null'::jsonb and e#>'{orderStatus,followUpPlanId}'='null'::jsonb and e#>>'{orderStatus,reason}'='','Unbelegte Verordnungsfreigabe ist gesperrt.');
 perform care_private.med_packet_require(e->'correction'='{"targetEventId":null,"reason":"","replacementEventId":null,"approvedBy":null,"approvedAt":null}'::jsonb,'Unbelegte Korrekturfreigabe ist gesperrt.');
 if k<>'effect_review' then perform care_private.med_packet_require(e->'effect'='{"administrationId":null,"observedAt":null,"observation":"","action":"","painScore":null}'::jsonb,'Wirkungsbehauptung außerhalb einer belegten Kontrolle.');end if;
 if k<>'safety_signal' then perform care_private.med_packet_require(e->'safety'='{"state":"not_observed","observation":"","suspectedRelation":"","reaction":"","clinicianContact":"","followUp":""}'::jsonb,'Unbelegte Sicherheitsbestätigung ist gesperrt.');end if;
 if k not in('preparation_stock','controlled_ledger') then perform care_private.med_packet_require(s='{"operation":"none","packageId":null,"batch":"","expiry":null,"quantity":null,"unit":"","balanceBefore":null,"balanceAfter":null,"reason":"","responsibleBy":null}'::jsonb,'Bestandsbehauptung außerhalb eines Bestandsereignisses.');end if;
 perform care_private.med_packet_require(jsonb_typeof(e#>'{witness,required}')='boolean' and e#>>'{witness,assertion}'='not_required' and e#>'{witness,required}'='false'::jsonb and e#>'{witness,profileId}'='null'::jsonb and e#>'{witness,signedAt}'='null'::jsonb and e#>'{witness,signatureId}'='null'::jsonb,'Unbelegte Zweitsignatur ist gesperrt.');
 perform care_private.med_packet_require(care_private.med_packet_text(p->'reason',0,2000) and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision' ~ '^(0|[1-9][0-9]*)$' and (p->>'expectedRevision')::numeric<=2147483647,'Revision oder Änderungsgrund ungültig.');
 if p->>'action'='create' then perform care_private.med_packet_require(p->'expectedHeadId'='null'::jsonb and p->'original'='null'::jsonb and p->>'expectedRevision'='0' and p->>'reason'='','Neuanlage enthält erfundenes Original.');else perform care_private.med_packet_require(care_private.med_packet_uuid(p->'expectedHeadId') and jsonb_typeof(p->'original')='object' and care_private.med_packet_text(p->'reason',10,2000) and e is distinct from p#>'{original,payload}','Fortschreibung ohne Original, Änderung oder Grund.');end if;
end $$;
revoke all on function care_private.med_packet_text(jsonb,integer,integer) from public,anon,authenticated;
revoke all on function care_private.med_packet_uuid(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_decimal(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_keys(jsonb,text[]) from public,anon,authenticated;
revoke all on function care_private.med_packet_require(boolean,text) from public,anon,authenticated;
revoke all on function care_private.med_packet_time(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_date(jsonb) from public,anon,authenticated;
revoke all on function care_private.med_packet_uuid_list(jsonb) from public,anon,authenticated;
revoke all on function care_private.validate_medication_packet(jsonb,uuid,jsonb) from public,anon,authenticated;

