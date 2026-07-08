import { getSupabaseClient } from '@/lib/supabase/client';

type RpcResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

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
  const { data, error } = await client.rpc(fn, args);
  return {
    data: data as T | null,
    error: error ? { message: error.message, code: error.code } : null,
  };
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
    order: (col: string, opts?: { ascending?: boolean }) => Builder;
    limit: (n: number) => Builder;
    then: Promise<RpcResult<unknown[]>>['then'];
  };

  let query = client.from(table).select(columns) as Builder;
  if (options.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      if (val !== null && val !== undefined) {
        query = query.eq(col, val);
      }
    }
  }
  query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  if (options.limit) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;

  return {
    data: (data ?? null) as T[] | null,
    error: error ? { message: error.message, code: error.code } : null,
  };
}
