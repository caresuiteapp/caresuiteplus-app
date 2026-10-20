import { PremiumInput } from '@/components/ui';

type MessageSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

export function MessageSearchBar({
  value,
  onChangeText,
  placeholder = 'Suchen…',
}: MessageSearchBarProps) {
  return (
    <PremiumInput
      label="Suche"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel="Nachrichten durchsuchen"
    />
  );
}
