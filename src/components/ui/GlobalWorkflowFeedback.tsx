import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  WorkflowFeedbackOverlay,
  type WorkflowFeedbackKind,
} from './WorkflowFeedbackOverlay';

export type WorkflowFeedbackInput = {
  message: string;
  title?: string;
  kind?: WorkflowFeedbackKind;
  loading?: boolean;
  loadingMessage?: string;
  autoDismissMs?: number | null;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

type ActiveWorkflowFeedback = WorkflowFeedbackInput & {
  id: string;
  kind: WorkflowFeedbackKind;
};

export type WorkflowFeedbackApi = {
  show: (input: WorkflowFeedbackInput) => string;
  showSuccess: (message: string, title?: string) => string;
  showError: (message: string, title?: string, onRetry?: () => void) => string;
  showWarning: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
  showLoading: (message?: string) => string;
  dismiss: (id?: string) => void;
};

let feedbackSequence = 0;

const noopApi: WorkflowFeedbackApi = {
  show: () => '',
  showSuccess: () => '',
  showError: () => '',
  showWarning: () => '',
  showInfo: () => '',
  showLoading: () => '',
  dismiss: () => undefined,
};

const WorkflowFeedbackContext = createContext<WorkflowFeedbackApi>(noopApi);

export function GlobalWorkflowFeedbackProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveWorkflowFeedback | null>(null);
  const activeRef = useRef<ActiveWorkflowFeedback | null>(null);
  const queueRef = useRef<ActiveWorkflowFeedback[]>([]);
  const lastFingerprintRef = useRef<{ value: string; at: number } | null>(null);

  const dismiss = useCallback((id?: string) => {
    const current = activeRef.current;
    if (id && current?.id !== id) {
      queueRef.current = queueRef.current.filter((item) => item.id !== id);
      return;
    }
    if (!current) return;
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const show = useCallback((input: WorkflowFeedbackInput) => {
    const kind = input.kind ?? 'info';
    const fingerprint = `${kind}|${input.loading ? 'loading' : 'message'}|${input.title ?? ''}|${input.message}`;
    const now = Date.now();
    const previous = lastFingerprintRef.current;
    if (previous?.value === fingerprint && now - previous.at < 750) {
      const duplicate = [activeRef.current, ...queueRef.current].find((item) => {
        if (!item) return false;
        return `${item.kind}|${item.loading ? 'loading' : 'message'}|${item.title ?? ''}|${item.message}` === fingerprint;
      });
      if (duplicate) return duplicate.id;
    }

    const next: ActiveWorkflowFeedback = {
      ...input,
      id: `workflow-feedback-${++feedbackSequence}`,
      kind,
    };
    lastFingerprintRef.current = { value: fingerprint, at: now };
    const current = activeRef.current;
    if (!current || input.loading || current.loading) {
      activeRef.current = next;
      setActive(next);
    } else {
      queueRef.current.push(next);
    }
    return next.id;
  }, []);

  const showSuccess = useCallback(
    (message: string, title?: string) =>
      show({ message, title, kind: 'success', autoDismissMs: 5000 }),
    [show],
  );
  const showError = useCallback(
    (message: string, title?: string, onRetry?: () => void) =>
      show({
        message,
        title,
        kind: 'error',
        autoDismissMs: null,
        actionLabel: onRetry ? 'Erneut versuchen' : undefined,
        onAction: onRetry,
      }),
    [show],
  );
  const showWarning = useCallback(
    (message: string, title?: string) =>
      show({ message, title, kind: 'warning', autoDismissMs: 7000 }),
    [show],
  );
  const showInfo = useCallback(
    (message: string, title?: string) =>
      show({ message, title, kind: 'info', autoDismissMs: 5000 }),
    [show],
  );
  const showLoading = useCallback(
    (message = 'Vorgang wird ausgeführt…') =>
      show({
        message,
        kind: 'info',
        loading: true,
        loadingMessage: message,
        autoDismissMs: null,
      }),
    [show],
  );

  const api = useMemo<WorkflowFeedbackApi>(
    () => ({
      show,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showLoading,
      dismiss,
    }),
    [dismiss, show, showError, showInfo, showLoading, showSuccess, showWarning],
  );

  const closeActive = () => {
    const current = activeRef.current;
    if (!current) return;
    current.onDismiss?.();
    dismiss(current.id);
  };

  const runActiveAction = () => {
    const current = activeRef.current;
    if (!current) return;
    current.onAction?.();
    dismiss(current.id);
  };

  return (
    <WorkflowFeedbackContext.Provider value={api}>
      {children}
      <WorkflowFeedbackOverlay
        actionLabel={active?.actionLabel}
        autoDismissMs={active?.autoDismissMs}
        kind={active?.kind}
        loading={Boolean(active?.loading)}
        loadingMessage={active?.loadingMessage}
        message={active?.message}
        onAction={active?.onAction ? runActiveAction : undefined}
        onDismiss={closeActive}
        testID="global-workflow-feedback"
        title={active?.title}
      />
    </WorkflowFeedbackContext.Provider>
  );
}

export function useWorkflowFeedback(): WorkflowFeedbackApi {
  return useContext(WorkflowFeedbackContext);
}
