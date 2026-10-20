import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SurfaceContrastProvider } from "@/design/tokens/surfaceContrast";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type AssignmentStudioStep<Key extends string> = {
  key: Key;
  label: string;
  icon: IconName;
  optional?: boolean;
};

type AssignmentStudioScaffoldProps<Key extends string> = {
  steps: readonly AssignmentStudioStep<Key>[];
  activeStep: Key;
  onStepChange: (key: Key) => void;
  title: string;
  description: string;
  summary: readonly {
    label: string;
    value: string;
    icon: IconName;
    tone?: "info" | "success" | "warning";
  }[];
  children: ReactNode;
  footer?: ReactNode;
};

const palette = {
  ink: "#F7FBFF",
  secondary: "#A9BED4",
  muted: "#7290AA",
  accent: "#2FA8FF",
  cyan: "#73D8FF",
  success: "#34D3A4",
  warning: "#FFBF69",
  panel: "rgba(5, 22, 43, 0.92)",
  panelSoft: "rgba(10, 37, 66, 0.72)",
  selected: "rgba(47, 168, 255, 0.17)",
  border: "rgba(127, 207, 255, 0.22)",
  borderStrong: "rgba(92, 190, 255, 0.52)",
};

export function AssignmentStudioScaffold<Key extends string>({
  steps,
  activeStep,
  onStepChange,
  title,
  description,
  summary,
  children,
  footer,
}: AssignmentStudioScaffoldProps<Key>) {
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === activeStep),
  );

  return (
    <SurfaceContrastProvider tone="dark">
      <View style={styles.root}>
        <View style={styles.intro}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>EINSATZSTUDIO</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <View style={styles.progressBlock}>
            <Text style={styles.progressLabel}>
              Bereich {activeIndex + 1} von {steps.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((activeIndex + 1) / steps.length) * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={compact ? styles.mobileLayout : styles.desktopLayout}>
          <ScrollView
            horizontal={compact}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={compact ? styles.mobileNavScroll : styles.sidebar}
            contentContainerStyle={
              compact ? styles.mobileNav : styles.sidebarContent
            }
          >
            {steps.map((step, index) => {
              const selected = step.key === activeStep;
              return (
                <Pressable
                  key={step.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => onStepChange(step.key)}
                  style={({ pressed }) => [
                    compact ? styles.mobileNavItem : styles.navItem,
                    selected && styles.navItemSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[styles.navIcon, selected && styles.navIconSelected]}
                  >
                    <Ionicons
                      name={step.icon}
                      size={17}
                      color={selected ? palette.ink : palette.secondary}
                    />
                  </View>
                  <View style={styles.navCopy}>
                    <Text
                      style={[
                        styles.navLabel,
                        selected && styles.navLabelSelected,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {!compact ? (
                      <Text style={styles.navMeta}>
                        {step.optional ? "Optional" : `Schritt ${index + 1}`}
                      </Text>
                    ) : null}
                  </View>
                  {!compact && selected ? (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={palette.cyan}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.workspace}>
            <View style={styles.formSurface}>{children}</View>
            <View style={styles.summaryRail}>
              <Text style={styles.summaryEyebrow}>LIVE-ZUSAMMENFASSUNG</Text>
              {summary.map((item) => {
                const color =
                  item.tone === "success"
                    ? palette.success
                    : item.tone === "warning"
                      ? palette.warning
                      : palette.cyan;
                return (
                  <View key={item.label} style={styles.summaryItem}>
                    <View
                      style={[
                        styles.summaryIcon,
                        {
                          borderColor: `${color}66`,
                          backgroundColor: `${color}18`,
                        },
                      ]}
                    >
                      <Ionicons name={item.icon} size={16} color={color} />
                    </View>
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>{item.label}</Text>
                      <Text style={styles.summaryValue} numberOfLines={2}>
                        {item.value || "Noch offen"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SurfaceContrastProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    minWidth: 0,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#071A31",
  },
  intro: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 2,
  },
  introCopy: { flex: 1, minWidth: 260, gap: 4 },
  eyebrow: {
    color: palette.cyan,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.35,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.45,
  },
  description: {
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 680,
  },
  progressBlock: { width: 190, gap: 7 },
  progressLabel: {
    color: palette.secondary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(130, 184, 226, 0.16)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
  desktopLayout: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  mobileLayout: { gap: 12 },
  sidebar: {
    width: 228,
    flexGrow: 0,
    flexShrink: 0,
    padding: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.panelSoft,
  },
  sidebarContent: { gap: 4 },
  mobileNavScroll: { maxWidth: "100%" },
  mobileNav: { flexDirection: "row", overflow: "hidden", gap: 6 },
  navItem: {
    minHeight: 54,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  mobileNavItem: {
    width: 132,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  navItemSelected: {
    backgroundColor: palette.selected,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  pressed: { opacity: 0.75 },
  navIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(130, 184, 226, 0.09)",
  },
  navIconSelected: { backgroundColor: "rgba(47, 168, 255, 0.25)" },
  navCopy: { flex: 1, minWidth: 0 },
  navLabel: { color: palette.secondary, fontSize: 12, fontWeight: "700" },
  navLabelSelected: { color: palette.ink },
  navMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  workspace: { flex: 1, minWidth: 0, gap: 12 },
  formSurface: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.panel,
    padding: 16,
    minHeight: 300,
  },
  summaryRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "stretch",
  },
  summaryEyebrow: {
    width: "100%",
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  summaryItem: {
    flex: 1,
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 13,
    backgroundColor: "rgba(8, 30, 56, 0.72)",
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  summaryValue: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 2,
  },
});
