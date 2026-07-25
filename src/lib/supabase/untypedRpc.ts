import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

type RpcResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/**
 * Calls migrations that are deployed live but not yet present in the checked-in
 * generated Database function map. Runtime behavior stays fully typed at the
 * response boundary while generated-type drift is isolated here.
 */
export async function callUnknownRpc<T = unknown>(
  client: SupabaseClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<RpcResponse<T>> {
  const rpc = client.rpc as unknown as (
    name: string,
    parameters: Record<string, unknown>,
  ) => Promise<RpcResponse<T>>;
  return rpc(functionName, args);
}
