import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
export type FreeCoordinate = {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
};
export async function geocodeWithFreeProvider(address: string, tenantId?: string | null): Promise<FreeCoordinate | null> {
    if (!address.trim())
        return null;
    const result = await invokeEdgeFunction<{
        coordinate: FreeCoordinate | null;
    }>('free-geocode', { address: address.trim(), tenantId });
    if (!result.ok)
        throw new Error(result.error);
    return result.data.coordinate;
}
