import { useEffect, useRef } from 'react';
import type { WorkflowFeedbackKind } from './WorkflowFeedbackOverlay';
import { useWorkflowFeedback } from './GlobalWorkflowFeedback';

export function WorkflowToast({ message, kind = 'success', onDismiss }: {
  message: string | null;
  kind?: WorkflowFeedbackKind;
  onDismiss?: () => void;
}) {
  const feedback = useWorkflowFeedback();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    const id = feedback.show({
      autoDismissMs: 5000,
      kind,
      message,
      onDismiss: () => onDismissRef.current?.(),
    });
    return () => feedback.dismiss(id);
  }, [feedback, kind, message]);

  return null;
}
