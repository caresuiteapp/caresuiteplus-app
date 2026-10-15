import { EmployeeDetailScreen } from '@/screens/office/EmployeeDetailScreen.web';
type Props = { employeeId: string; onOpenFullRecord?: () => void; onEditMasterData?: () => void; onOpenOffboarding?: () => void; onDeleted?: () => void };
export function EmployeeDetailSummaryPanel({ onOpenFullRecord, ...props }: Props) {
  return <EmployeeDetailScreen embedded onOpenPersonnelRecord={onOpenFullRecord} {...props} />;
}
