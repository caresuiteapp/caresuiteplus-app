import { useCallback, useState } from 'react';
import { QUICK_EMOJIS } from '@/features/communication/communication.constants';

export function useMessageComposer() {
  const [text, setText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const appendEmoji = useCallback((emoji: string) => {
    setText((prev) => `${prev}${emoji}`);
  }, []);

  const reset = useCallback(() => {
    setText('');
    setIsInternalNote(false);
    setReplyToId(null);
  }, []);

  return {
    text,
    setText,
    isInternalNote,
    setIsInternalNote,
    replyToId,
    setReplyToId,
    quickEmojis: QUICK_EMOJIS,
    appendEmoji,
    reset,
    canSend: text.trim().length > 0,
  };
}
