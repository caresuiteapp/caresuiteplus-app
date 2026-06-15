import { useCallback, useState } from 'react';
import {
  cancelVoiceRecording,
  getVoiceRecordingState,
  startVoiceRecordingPrepared,
  stopVoiceRecordingPrepared,
} from '@/features/communication/communication.voice';

export function useVoiceMessage() {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback(() => {
    const result = startVoiceRecordingPrepared();
    if (result.ok) setIsRecording(true);
    return result;
  }, []);

  const stop = useCallback(() => {
    const result = stopVoiceRecordingPrepared();
    setIsRecording(false);
    if (result.ok) setDurationSeconds(result.data.durationSeconds);
    return result;
  }, []);

  const cancel = useCallback(() => {
    cancelVoiceRecording();
    setIsRecording(false);
    setDurationSeconds(0);
  }, []);

  return {
    isRecording,
    durationSeconds,
    state: getVoiceRecordingState(),
    start,
    stop,
    cancel,
    isPreparedOnly: true,
  };
}
