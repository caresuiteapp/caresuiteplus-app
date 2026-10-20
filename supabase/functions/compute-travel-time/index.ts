import { handleFreeGeo } from '../_shared/freeGeoRuntime.ts';
import { computeFreeRoute } from '../_shared/freeGeoEngine.ts';
Deno.serve(req => handleFreeGeo(req, (body, request) => computeFreeRoute({ origin: typeof body.origin === 'string' ? body.origin : '', destination: typeof body.destination === 'string' ? body.destination : '', transportMode: typeof body.transportMode === 'string' ? body.transportMode : '', includeRouteGeometry: body.includeRouteGeometry === true }, request)));
