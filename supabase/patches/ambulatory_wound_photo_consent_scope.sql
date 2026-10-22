-- Quarantined follow-up after ambulatory_wound_workspace_quarantined.sql.
-- A general granted consent never authorizes a photo; native explicit type is foto_video.
-- This proves current metadata/consent binding only, not Storage bytes or a real clinical qualification.
create or replace function care_private.assert_wound_photo_current(e jsonb,t uuid,c uuid,w uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if e#>>'{observation,photoId}' is not null and not exists(
  select 1 from public.ambulatory_wound_photo_links x
  join public.client_consents consent on consent.id=x.consent_id and consent.tenant_id=x.tenant_id and consent.client_id=x.client_id
  where x.id=(e#>>'{observation,photoId}')::uuid and x.tenant_id=t and x.client_id=c and x.wound_case_id=w
   and x.assessment_id=(e#>>'{observation,assessmentId}')::uuid and x.consent_id=(e#>>'{observation,photoConsentId}')::uuid
   and consent.granted and consent.consent_type='foto_video'
   and consent.granted_at is not null and isfinite(consent.granted_at) and consent.granted_at<=x.captured_at
   and isfinite(x.captured_at) and x.captured_at<=clock_timestamp()
   and(consent.expires_at is null or consent.expires_at>clock_timestamp())
 ) then raise exception 'Bildverwendung benötigt eine aktuell gültige ausdrückliche Fotoeinwilligung, die bereits zum tatsächlichen Aufnahmezeitpunkt galt.' using errcode='42501';end if;
end$$;
revoke all on function care_private.assert_wound_photo_current(jsonb,uuid,uuid,uuid) from public,anon,authenticated,service_role;
