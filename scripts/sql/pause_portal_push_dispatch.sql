-- Pauses future claims; does not delete business records or undo an Expo handoff.
UPDATE public.portal_push_runtime SET enabled=false,updated_at=now() WHERE singleton;
SELECT NOT enabled AS automatischer_versand_pausiert FROM public.portal_push_runtime;
