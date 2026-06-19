import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AiContextSnapshot, AiPendingActionSummary } from './aiToolTypes';

type AiState = {
  sessionId: string | null;
  currentContext: AiContextSnapshot;
  pendingActions: AiPendingActionSummary[];
  lastGoal: string | null;
  lastStep: string | null;
  voiceEnabledHintDismissed: boolean;

  setSessionId: (id: string | null) => void;
  setCurrentContext: (context: AiContextSnapshot) => void;
  addPendingAction: (action: AiPendingActionSummary) => void;
  removePendingAction: (id: string) => void;
  setProgress: (goal: string, step: string) => void;
  dismissVoiceHint: () => void;
};

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      sessionId: null,
      currentContext: {},
      pendingActions: [],
      lastGoal: null,
      lastStep: null,
      voiceEnabledHintDismissed: false,

      setSessionId: (id) => set({ sessionId: id }),

      setCurrentContext: (context) =>
        set((state) => ({
          currentContext: {
            ...state.currentContext,
            ...context,
          },
        })),

      addPendingAction: (action) =>
        set((state) => ({
          pendingActions: [
            action,
            ...state.pendingActions.filter(
              (existing) => existing.pending_action_id !== action.pending_action_id,
            ),
          ],
        })),

      removePendingAction: (id) =>
        set((state) => ({
          pendingActions: state.pendingActions.filter(
            (action) => action.pending_action_id !== id,
          ),
        })),

      setProgress: (goal, step) =>
        set({
          lastGoal: goal,
          lastStep: step,
        }),

      dismissVoiceHint: () => set({ voiceEnabledHintDismissed: true }),
    }),
    {
      name: 'caresuite-ai-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        currentContext: state.currentContext,
        pendingActions: state.pendingActions,
        lastGoal: state.lastGoal,
        lastStep: state.lastStep,
        voiceEnabledHintDismissed: state.voiceEnabledHintDismissed,
      }),
    },
  ),
);
