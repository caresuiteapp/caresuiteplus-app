-- W-06: fehlgeschlagene Zustellung darf nie als zugestellt oder gelesen gelten.

ALTER TABLE public.communication_messages
  DROP CONSTRAINT IF EXISTS communication_messages_failed_without_receipt;
ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_failed_without_receipt
  CHECK (status <> 'failed' OR (delivered_at IS NULL AND read_at IS NULL)) NOT VALID;

ALTER TABLE public.communication_messages
  DROP CONSTRAINT IF EXISTS communication_messages_read_requires_delivery;
ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_read_requires_delivery
  CHECK (
    read_at IS NULL
    OR (
      status IN ('read', 'edited', 'deleted', 'archived')
      AND sent_at IS NOT NULL
      AND delivered_at IS NOT NULL
      AND sent_at <= delivered_at
      AND delivered_at <= read_at
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_communication_message_delivery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'failed' AND (NEW.delivered_at IS NOT NULL OR NEW.read_at IS NOT NULL) THEN
    RAISE EXCEPTION 'failed message cannot be delivered or read';
  END IF;
  IF NEW.read_at IS NOT NULL AND (
    NEW.status NOT IN ('read', 'edited', 'deleted', 'archived')
    OR NEW.sent_at IS NULL
    OR NEW.delivered_at IS NULL
    OR NEW.sent_at > NEW.delivered_at
    OR NEW.delivered_at > NEW.read_at
  ) THEN
    RAISE EXCEPTION 'read requires ordered sent and delivered evidence';
  END IF;
  IF NEW.delivered_at IS NOT NULL AND NEW.status NOT IN ('delivered', 'read', 'edited', 'deleted', 'archived') THEN
    RAISE EXCEPTION 'delivery timestamp requires delivered or read status';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'failed' AND NEW.status IN ('delivered', 'read') THEN
    RAISE EXCEPTION 'failed delivery is terminal; retry as a new message';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_communication_message_delivery_evidence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_communication_message_delivery_evidence ON public.communication_messages;
CREATE TRIGGER guard_communication_message_delivery_evidence
  BEFORE INSERT OR UPDATE OF status, sent_at, delivered_at, read_at
  ON public.communication_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_communication_message_delivery_evidence();

CREATE OR REPLACE FUNCTION public.guard_communication_read_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_status text;
  source_delivered_at timestamptz;
BEGIN
  SELECT m.status, m.delivered_at
    INTO source_status, source_delivered_at
    FROM public.communication_messages m
   WHERE m.id = NEW.message_id
     AND m.thread_id = NEW.thread_id
     AND m.tenant_id = NEW.tenant_id
   FOR SHARE;
  IF NOT FOUND OR source_status NOT IN ('read', 'edited', 'deleted', 'archived') OR source_delivered_at IS NULL
     OR NEW.read_at < source_delivered_at THEN
    RAISE EXCEPTION 'read receipt requires the same delivered and read message';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_communication_read_receipt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_communication_read_receipt ON public.communication_read_receipts;
CREATE TRIGGER guard_communication_read_receipt
  BEFORE INSERT OR UPDATE OF tenant_id, thread_id, message_id, read_at
  ON public.communication_read_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_communication_read_receipt();

COMMENT ON FUNCTION public.guard_communication_message_delivery_evidence() IS
  'W-06: separates send acceptance, delivery failure, delivery and read evidence; failed is terminal.';
COMMENT ON FUNCTION public.guard_communication_read_receipt() IS
  'W-06: a receipt can only reference the same message after ordered delivery and read evidence.';
