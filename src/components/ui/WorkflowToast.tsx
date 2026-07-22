import { WorkflowFeedbackOverlay, type WorkflowFeedbackKind } from './WorkflowFeedbackOverlay';

export function WorkflowToast({ message, kind = 'success', onDismiss }: {
  message: string | null;
  kind?: WorkflowFeedbackKind;
  onDismiss?: () => void;
}) {
  return (
    <WorkflowFeedbackOverlay
      autoDismissMs={5000}
      kind={kind}
      message={message}
      onDismiss={onDismiss}
      testID="workflow-toast"
    />
  );
}
