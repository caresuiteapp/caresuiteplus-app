// Generated native presentation from src/components/office/EmployeeDetailSummaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { EmployeeDetailScreen } from "../../screens/office/EmployeeDetailScreen.native.tsx";
type Props = {
    employeeId: string;
    onOpenFullRecord?: () => void;
    onEditMasterData?: () => void;
    onOpenOffboarding?: () => void;
    onDeleted?: () => void;
};
export function EmployeeDetailSummaryPanel({ onOpenFullRecord, ...props }: Props) {
    return <EmployeeDetailScreen embedded onOpenPersonnelRecord={onOpenFullRecord} {...props}/>;
}
