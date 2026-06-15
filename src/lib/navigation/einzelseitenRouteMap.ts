import mapData from './einzelseiten-route-map.json';

export type EinzelseitenRouteEntry = {
  id: string;
  prompt: string;
  target: string;
  tab: string | null;
};

export const EINZELSEITEN_ROUTE_MAP: EinzelseitenRouteEntry[] =
  mapData as EinzelseitenRouteEntry[];

const byPrompt = new Map(EINZELSEITEN_ROUTE_MAP.map((e) => [e.prompt, e]));

/** Resolve a Mega-Prompt route to its canonical CareSuite+ target path. */
export function resolveEinzelseitenRoute(promptRoute: string): {
  target: string;
  tab: string | null;
} {
  const entry = byPrompt.get(promptRoute);
  if (!entry) {
    return { target: promptRoute, tab: null };
  }
  return { target: entry.target, tab: entry.tab };
}

export function getEinzelseitenEntry(id: string): EinzelseitenRouteEntry | undefined {
  return EINZELSEITEN_ROUTE_MAP.find((e) => e.id === id);
}
