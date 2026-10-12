export type PortalOverviewAction = 'upload' | 'nachweise' | 'termin_aendern' | 'zusatztermin' | 'rueckruf';

/** Deep links use the same release gates as visible dashboard actions. */
export function resolvePortalOverviewAction(action: unknown, releases: {
  requestsReleased: boolean;
  proofsReleased: boolean;
  uploadReleased: boolean;
}): PortalOverviewAction | null {
  if (action === 'upload') return releases.uploadReleased ? action : null;
  if (action === 'nachweise') return releases.proofsReleased ? action : null;
  if (action === 'termin_aendern' || action === 'zusatztermin' || action === 'rueckruf') {
    return releases.requestsReleased ? action : null;
  }
  return null;
}
