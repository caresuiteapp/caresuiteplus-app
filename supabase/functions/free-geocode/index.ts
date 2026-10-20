import { handleFreeGeo } from '../_shared/freeGeoRuntime.ts';
import { geocodeFree } from '../_shared/freeGeoEngine.ts';
Deno.serve(req => handleFreeGeo(req, async (body, request) => ({ coordinate: await geocodeFree(typeof body.address === 'string' ? body.address : '', request) })));
