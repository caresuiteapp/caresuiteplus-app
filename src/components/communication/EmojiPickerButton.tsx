import { PremiumButton } from '@/components/ui';
import { DEFAULT_EMOJIS } from '@/features/communication/communication.constants';

type EmojiPickerButtonProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiPickerButton({ onSelect }: EmojiPickerButtonProps) {
  return (
    <>
      {DEFAULT_EMOJIS.map((emoji) => (
        <PremiumButton key={emoji} title={emoji} size="sm" variant="ghost" onPress={() => onSelect(emoji)} />
      ))}
    </>
  );
}
