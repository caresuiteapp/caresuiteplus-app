import { getSupabaseClient } from '@/lib/supabase/client';

type RpcResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

const PLATFORM_ERROR_MESSAGES: Record<string, string> = {
  platform_forbidden: 'Ihre aktuelle Rolle darf diese Aktion nicht ausführen.',
  reason_required: 'Bitte eine aussagekräftige Begründung mit mindestens fünf Zeichen angeben.',
  invoice_tenant_mismatch: 'Die Rechnung gehört nicht zum ausgewählten Unternehmen.',
  invoice_not_payable: 'Für diese Rechnung kann in ihrem aktuellen Status keine Zahlung erfasst werden.',
  last_platform_owner_protected: 'Der letzte aktive Inhaber kann nicht deaktiviert oder herabgestuft werden.',
  existing_auth_user_required: 'Es gibt kein registriertes Konto mit dieser E-Mail-Adresse.',
  platform_user_already_exists: 'Dieser Benutzer hat bereits einen Plattformzugriff. Öffnen Sie den vorhandenen Eintrag.',
  core_module_protected: 'Eine Grundfunktion darf hier nicht deaktiviert oder auf intern umgestellt werden.',
  protected_setting: 'Diese geschützte Einstellung kann nicht über die Console verändert werden.',
  setting_type_mismatch: 'Der Datentyp der Einstellung muss erhalten bleiben.',
  setting_not_found: 'Die Einstellung wurde nicht gefunden. Aktualisieren Sie die Liste.',
  request_payload_changed: 'Dieser Vorgang wurde bereits mit anderen Angaben übermittelt. Prüfen Sie den Datenstand und öffnen Sie bei Bedarf einen neuen Vorgang.',
  provider_payment_readonly: 'Zahlungen eines Zahlungsanbieters können hier nur gelesen werden.',
  invalid_flag_scope_or_rollout: 'Geltungsbereich, Unternehmen oder Rollout der Freigabe sind ungültig.',
  provider_invoice_readonly: 'Diese Rechnung wird vom Zahlungsanbieter verwaltet.',
  invoice_status_payment_managed: 'Der Zahlungsstand ergibt sich aus den dokumentierten Zahlungen. Bitte den Zahlungsvorgang prüfen.',
  invoice_not_past_due: 'Das Fälligkeitsdatum dieser Rechnung ist noch nicht überschritten.',
  invalid_invoice_values: 'Bitte Unternehmen, Betrag, Steueranteil und Fälligkeit prüfen.',
  invalid_date_range: 'Das Enddatum muss am oder nach dem Startdatum liegen.',
};
function readableError(error: {message:string;code?:string}) {
  return {code:error.code,message:PLATFORM_ERROR_MESSAGES[error.message] ?? (error.code==='PGRST202'?'Diese Verwaltungsfunktion ist auf dem Server noch nicht bereitgestellt. Bitte den Systemstand prüfen.':error.message)};
}

/** Supabase client ohne generierte Platform-RPC-Typen (bis Regenerierung der DB-Types). */
function getUntypedClient() {
  return getSupabaseClient() as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>;
    from: (table: string) => {
      select: (columns?: string) => unknown;
    };
  } | null;
}

export async function platformRpc<T>(
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const client = getUntypedClient();
  if (!client) {
    return { data: null, error: { message: 'Supabase ist nicht konfiguriert.' } };
  }
  try {
    const { data, error } = await client.rpc(fn, args);
    return { data: data as T | null, error: error ? readableError(error) : null };
  } catch (cause) {
    return {data:null,error:{message:cause instanceof Error?cause.message:'Die Serververbindung wurde unterbrochen. Bitte den Datenstand vor einer erneuten Speicherung prüfen.'}};
  }
}

export async function platformSelect<T>(
  table: string,
  columns: string,
  orderBy: string,
): Promise<RpcResult<T[]>> {
  return platformSelectWhere<T>(table, columns, { orderBy });
}

export async function platformSelectWhere<T>(
  table: string,
  columns: string,
  options: {
    orderBy: string;
    ascending?: boolean;
    eq?: Record<string, string | number | boolean | null>;
    limit?: number;
  },
): Promise<RpcResult<T[]>> {
  const client = getUntypedClient();
  if (!client) {
    return { data: null, error: { message: 'Supabase ist nicht konfiguriert.' } };
  }

  type Builder = {
    eq: (col: string, val: string | number | boolean) => Builder;
    is: (col: string, val: null) => Builder;
    order: (col: string, opts?: { ascending?: boolean }) => Builder;
    range: (from: number, to: number) => Builder;
    then: Promise<RpcResult<unknown[]>>['then'];
  };
  // Read in explicit pages: PostgREST's response cap must not silently truncate a directory.
  const pageSize = 200;
  const collected: T[] = [];
  let offset = 0;
  try {
    for (;;) {
      const count = options.limit == null ? pageSize : Math.min(pageSize, Math.max(0, options.limit - offset));
      if (!count) break;
      let query = client.from(table).select(columns) as Builder;
      for (const [column, value] of Object.entries(options.eq ?? {})) {
        if (value === null) query = query.is(column, null);
        else if (value !== undefined) query = query.eq(column, value);
      }
      query = query.order(options.orderBy, { ascending: options.ascending ?? false });
      // Credits use tenant_id as their primary key; other Console tables have id.
      const primaryKey = table === 'platform_tenant_credits' ? 'tenant_id' : 'id';
      if (options.orderBy !== primaryKey) query = query.order(primaryKey, { ascending: false });
      const { data, error } = await query.range(offset, offset + count - 1);
      if (error) return { data: null, error: readableError(error) };
      const batch = (data ?? []) as T[];
      collected.push(...batch);
      if (batch.length < count) break;
      offset += batch.length;
    }
    return { data: collected, error: null };
  } catch (cause) {
    return { data: null, error: { message: cause instanceof Error ? cause.message : 'Die Liste konnte nicht vollständig geladen werden.' } };
  }
}
