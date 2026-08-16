import { StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { PremiumButton, PremiumDataTable } from "@/components/ui";
import { OfficeRecordDeleteButton } from "@/components/office/OfficeRecordDeleteButton";
import {
  buildAssignmentStatusBadges,
  StatusBadgesDropdown,
} from "@/components/assist/StatusBadgesDropdown";
import type { AssignmentListItem } from "@/types/modules/assist";
import {
  formatAssignmentTimeRange,
  formatDate,
  formatDurationMinutes,
  formatWeekday,
} from "@/lib/formatters/dateTimeFormatters";
import { isAssignmentListItemDeletable } from "@/lib/assist/assignmentCardPresentation";
import type { ServiceResult } from "@/types";

type AssignmentsListTableProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  onAssignmentPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onDelete?: (id: string) => Promise<ServiceResult<void>>;
  onDeleted?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSortColumn?: (columnKey: string) => void;
};

export function AssignmentsListTable({
  assignments,
  selectedId = null,
  onAssignmentPress,
  onOpenDetail,
  onDelete,
  onDeleted,
  sortColumnKey = null,
  sortDirection = "asc",
  onSortColumn,
}: AssignmentsListTableProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        primary: { color: "#F7FBFF", fontSize: 14, fontWeight: "700" },
        meta: { color: "#B8CEE0", fontSize: 13 },
        strongMeta: { color: "#CBE1F1", fontSize: 12, fontWeight: "700" },
        cell: { gap: 3 },
        actions: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
        },
      }),
    [],
  );

  return (
    <PremiumDataTable
      data={assignments}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onAssignmentPress ? (item) => onAssignmentPress(item.id) : undefined
      }
      columns={[
        {
          key: "date",
          label: "Termin",
          flex: 1.25,
          minWidth: 150,
          sortable: true,
          render: (item) => (
            <View style={styles.cell}>
              <Text style={styles.primary}>
                {formatWeekday(item.scheduledStart)},{" "}
                {formatDate(item.scheduledStart)}
              </Text>
              <Text style={styles.strongMeta}>
                {formatAssignmentTimeRange(
                  item.scheduledStart,
                  item.scheduledEnd,
                )}{" "}
                · {formatDurationMinutes(item.durationMinutes) || "—"}
              </Text>
            </View>
          ),
        },
        {
          key: "client",
          label: "Klient:in & Leistung",
          flex: 1.6,
          minWidth: 190,
          sortable: true,
          render: (item) => (
            <View style={styles.cell}>
              <Text style={styles.primary}>{item.clientName}</Text>
              <Text style={styles.meta}>{item.serviceName ?? item.title}</Text>
            </View>
          ),
        },
        {
          key: "employee",
          label: "Zuständigkeit & Ort",
          flex: 1.5,
          minWidth: 180,
          render: (item) => (
            <View style={styles.cell}>
              <Text style={styles.primary}>
                {item.employeeName || "Noch nicht zugewiesen"}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.location || "Kein Ort hinterlegt"}
              </Text>
            </View>
          ),
        },
        {
          key: "status",
          label: "Status",
          flex: 1.15,
          minWidth: 130,
          render: (item) => (
            <StatusBadgesDropdown badges={buildAssignmentStatusBadges(item)} />
          ),
        },
        {
          key: "actions",
          label: "Aktionen",
          flex: 1.25,
          minWidth: 150,
          render: (item) => (
            <View style={styles.actions}>
              {onOpenDetail ? (
                <PremiumButton
                  title="Details →"
                  variant="secondary"
                  size="sm"
                  onPress={() => onOpenDetail(item.id)}
                />
              ) : null}
              {onDelete && isAssignmentListItemDeletable(item) ? (
                <OfficeRecordDeleteButton
                  recordLabel="Einsatz"
                  displayName={`${item.clientName} · ${formatDate(item.scheduledStart)}`}
                  onDelete={() => onDelete(item.id)}
                  onDeleted={onDeleted ? () => onDeleted(item.id) : undefined}
                  confirmTitle="Einsatz endgültig löschen?"
                  buttonTitle="Löschen"
                  fullWidth={false}
                />
              ) : null}
            </View>
          ),
        },
      ]}
    />
  );
}
