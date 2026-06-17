import { PremiumAvatar } from '@/components/ui';
import { getEmployeeInitials } from '@/lib/office/employeeAvatarDisplay';
import { colors } from '@/theme';

type EmployeeListAvatarProps = {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

export { getEmployeeInitials };

export function EmployeeListAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = 'md',
}: EmployeeListAvatarProps) {
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <PremiumAvatar
      name={fullName || '?'}
      imageUri={avatarUrl?.trim() || undefined}
      size={size}
      accentColor={colors.orange}
    />
  );
}
