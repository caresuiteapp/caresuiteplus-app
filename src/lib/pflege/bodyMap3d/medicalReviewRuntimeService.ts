import { getSupabaseClient } from '@/lib/supabase/client';

type ApprovalRow = {
  approved: boolean;
  review_id: string | null;
  approved_at: string | null;
};

export async function getActiveBodyMapMedicalApproval(
  variantId: string,
  assetSha256: string,
): Promise<ApprovalRow> {
  const client = getSupabaseClient() as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: ApprovalRow[] | null; error: { message: string } | null }>;
  } | null;
  if (!client) return { approved: false, review_id: null, approved_at: null };
  const { data, error } = await client.rpc('bodymap_get_active_medical_approval', {
    p_variant_id: variantId,
    p_asset_sha256: assetSha256,
  });
  if (error || !data?.[0]) {
    return { approved: false, review_id: null, approved_at: null };
  }
  return data[0];
}
