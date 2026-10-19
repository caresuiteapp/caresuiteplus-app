-- PREPARED ONLY. Apply before committing new G requests; no data writes or fixtures here.
create or replace function care_private.validate_nutrition_entry(e jsonb,s jsonb)
returns void language plpgsql security definer set search_path='' as $$declare k text;v jsonb;item jsonb;actual boolean;begin
 if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['kind','title','plannedAt','occurredAt','planVersionId','measureId','visitId','assessmentId','planSnapshotSha256','decision','assistance','intake','elimination','swallowing','enteral','device','weight','execution','followUp','lifecycle']) then raise exception 'Vollständiger Eintrag fehlt.' using errcode='23514';end if;
 foreach k in array array['decision','assistance','intake','elimination','swallowing','enteral','device','weight','execution','followUp'] loop
  if jsonb_typeof(e->k) is distinct from 'object' then raise exception 'Eintragsabschnitt fehlt.' using errcode='23514';end if;
 end loop;
 if length(btrim(coalesce(e->>'title','')))<3 or length(e->>'title')>300 or coalesce(e#>>'{execution,outcome}','') not in('planned','offered','performed','partial','refused','not_performed')
 or coalesce(e#>>'{assistance,level}','') not in('independent','prompting','partial_assist','full_assist') or coalesce(e#>>'{intake,unit}','') not in('none','g','ml','percent')
 or coalesce(e#>>'{intake,targetUnit}','') not in('none','g','ml') or coalesce(e#>>'{enteral,unit}','') not in('none','g','ml') or coalesce(e#>>'{elimination,unit}','') not in('none','ml')
 or coalesce(e#>>'{followUp,state}','') not in('not_required','open','closed') or jsonb_typeof(e#>'{followUp,required}') is distinct from 'boolean' or jsonb_typeof(e#>'{elimination,complete}') is distinct from 'boolean' then raise exception 'Status oder Originaleinheit ist ungültig.' using errcode='23514';end if;
 foreach v in array array[e#>'{execution,performedBy}',e#>'{assistance,helpers}'] loop
  if jsonb_typeof(v) is distinct from 'array' then raise exception 'Personenliste fehlt.' using errcode='23514';end if;
  if jsonb_array_length(v)>100 or(select count(distinct x) from jsonb_array_elements_text(v) x)<>jsonb_array_length(v) then raise exception 'Personenliste ist doppelt oder übergroß.' using errcode='23514';end if;
  for item in select x from jsonb_array_elements(v) x loop if jsonb_typeof(item) is distinct from 'string' then raise exception 'Personenidentität fehlt.' using errcode='23514';end if;perform (item#>>'{}')::uuid;end loop;
 end loop;
 foreach v in array array[e#>'{intake,offered}',e#>'{intake,actual}',e#>'{intake,target}',e#>'{elimination,input}',e#>'{elimination,output}',e#>'{enteral,amount}',e#>'{enteral,durationMinutes}',e#>'{enteral,flushMl}',e#>'{weight,value}'] loop
  if v is null or jsonb_typeof(v) not in('null','string') or jsonb_typeof(v)='string' and(v#>>'{}')!~'^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$' then raise exception 'Menge ist weder exakter Dezimalwert noch ausdrücklich fehlend.' using errcode='23514';end if;
 end loop;
 actual:=e#>>'{execution,outcome}' in('performed','partial');
 if not actual and(jsonb_array_length(e#>'{execution,performedBy}')<>0 or btrim(coalesce(e#>>'{execution,result}',''))<>'' or e#>'{intake,actual}' is distinct from 'null'::jsonb or e#>'{elimination,input}' is distinct from 'null'::jsonb or e#>'{elimination,output}' is distinct from 'null'::jsonb) then raise exception 'Planung oder Nichtdurchführung darf keine tatsächlichen Mengen oder Durchführung enthalten.' using errcode='23514';end if;
 if e#>>'{intake,unit}'='percent' and(e#>>'{intake,actual}')::numeric>100 then raise exception 'Portionsanteil überschreitet 100 Prozent.' using errcode='23514';end if;
 if e#>>'{execution,outcome}'='refused' and(e#>>'{decision,state}' is distinct from 'refused' or length(btrim(coalesce(e#>>'{decision,reason}','')))<1 or length(btrim(coalesce(e#>>'{decision,consultation}','')))<3 or e#>>'{followUp,required}' is distinct from 'true') then raise exception 'Ablehnung benötigt Grund, Beratung und weiteres Vorgehen.' using errcode='23514';end if;
 if e#>>'{execution,outcome}' in('partial','not_performed') and length(btrim(coalesce(e#>>'{execution,deviation}','')))<3 then raise exception 'Konkrete Abweichung fehlt.' using errcode='23514';end if;
 if e#>>'{followUp,required}'='true' then
  if e#>>'{followUp,state}'='not_required' or length(btrim(coalesce(e#>>'{followUp,reason}','')))<3 or e#>>'{followUp,responsibleProfileId}' is null or e#>>'{followUp,dueAt}' is null then raise exception 'Verantwortung, Anlass oder Frist fehlt.' using errcode='23514';end if;
  perform(e#>>'{followUp,responsibleProfileId}')::uuid;perform(e#>>'{followUp,dueAt}')::timestamptz;
  if e#>>'{followUp,state}'='closed' and(length(btrim(coalesce(e#>>'{followUp,closureEvidence}','')))<3 or not exists(select 1 from jsonb_array_elements(s->'tasks') task where task->>'id'=e#>>'{followUp,taskId}' and task->>'state'='completed' and task->>'dueAt'=e#>>'{followUp,dueAt}')) then raise exception 'Tatsächlich erledigtes Auftragsoriginal mit derselben Frist fehlt.' using errcode='23514';end if;
 else
  if e#>>'{followUp,state}' is distinct from 'not_required' or e#>>'{followUp,reason}' is distinct from '' or e#>>'{followUp,closureEvidence}' is distinct from '' or e#>'{followUp,responsibleProfileId}' is distinct from 'null'::jsonb or e#>'{followUp,dueAt}' is distinct from 'null'::jsonb or e#>'{followUp,taskId}' is distinct from 'null'::jsonb then raise exception 'Ohne Folgeauftrag dürfen keine Folgebelege entstehen.' using errcode='23514';end if;
 end if;
 if actual and e->>'kind' in('enteral_nutrition','catheter_care','stoma_care','tube_observation') and not exists(select 1 from jsonb_array_elements(s->'devices') d where d->>'id'=case when e->>'kind'='enteral_nutrition' then e#>>'{enteral,deviceId}' else e#>>'{device,deviceId}' end and d->>'status'='active') then raise exception 'Aktives Geräteoriginal fehlt.' using errcode='23514';end if;
 if e->>'kind' in('meal_support','drink_protocol') and actual and e#>'{intake,actual}'='null'::jsonb then raise exception 'Tatsächliche Aufnahme fehlt.' using errcode='23514';end if;
 if e->>'kind' in('enteral_nutrition','catheter_care','stoma_care','tube_observation','continence_support') and not exists(
  select 1 from jsonb_array_elements(s->'protocols') protocol where protocol->>'id'=case e->>'kind' when 'enteral_nutrition' then e#>>'{enteral,prescriptionId}' when 'continence_support' then e#>>'{elimination,profileId}' else e#>>'{device,changeBasisId}' end
  and protocol->>'kind'=case e->>'kind' when 'enteral_nutrition' then 'prescription' when 'continence_support' then 'continence_profile' else 'device_change_basis' end
 ) then raise exception 'Passende Verordnung, Wechselgrundlage oder Kontinenzprofil als Quelloriginal fehlt.' using errcode='23514';end if;
 if e->>'kind'='fluid_balance' and(e#>>'{elimination,unit}' is distinct from 'ml' or e#>'{elimination,input}'='null'::jsonb and e#>'{elimination,output}'='null'::jsonb or e#>>'{elimination,complete}' is distinct from 'false' or length(btrim(coalesce(e#>>'{elimination,observation}','')))<3) then raise exception 'Unvollständiger Mengenausschnitt fehlt.' using errcode='23514';end if;
end$$;
revoke all on function care_private.validate_nutrition_entry(jsonb,jsonb) from public,anon,authenticated;
