import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitExecutionUiState } from '@/lib/portal/resolveVisitExecutionUiState';

export type VisitExecutionPhase =
  | 'preview'
  | 'en_route'
  | 'arrived'
  | 'live'
  | 'post_service'
  | 'completed'
  | 'no_show'
  | 'locked';

export type VisitExecutionPhaseInput = {
  effectiveStatus: AssignmentStatus;
  uiState: VisitExecutionUiState | null;
  isLocked: boolean;
};

export function resolveVisitExecutionPhase(input: VisitExecutionPhaseInput): VisitExecutionPhase {
  const { effectiveStatus, uiState, isLocked } = input;

  if (effectiveStatus === 'nicht_erschienen') return 'no_show';
  if (effectiveStatus === 'storniert') return 'locked';
  if (effectiveStatus === 'abgeschlossen') {
    return isLocked ? 'completed' : 'post_service';
  }
  if (isLocked) return 'locked';

  if (effectiveStatus === 'unterwegs') return 'en_route';
  if (effectiveStatus === 'angekommen') return 'arrived';
  if (effectiveStatus === 'gestartet' || effectiveStatus === 'pausiert') return 'live';

  const postService =
    effectiveStatus === 'beendet' ||
    effectiveStatus === 'dokumentation_offen' ||
    effectiveStatus === 'unterschrift_offen' ||
    uiState?.documentationSubmitted ||
    uiState?.showDocumentationForm ||
    uiState?.showSignature ||
    uiState?.showFinalize;

  if (postService) return 'post_service';

  return 'preview';
}

export function showLiveBottomBar(phase: VisitExecutionPhase): boolean {
  return phase === 'live' || phase === 'post_service';
}

export function showCompactProgress(phase: VisitExecutionPhase): boolean {
  return phase !== 'preview' && phase !== 'no_show' && phase !== 'locked';
}
