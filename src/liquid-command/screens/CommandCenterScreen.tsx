import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { PortalTextSizeControls } from "@/components/portal/accessibility/PortalTextSizeControls";
import { TopbarProfileAvatar } from "@/components/layout/TopbarProfileAvatar";

type WidgetDefinition = {
  id: string;
  label: string;
  route: string;
  images: {
    small: ImageSourcePropType;
    medium: ImageSourcePropType;
    large: ImageSourcePropType;
  };
};
type BackgroundDefinition = {
  id: string;
  label: string;
  image: ImageSourcePropType;
};
type WeatherLocation = {
  mode: "auto" | "manual" | "fallback";
  label: string;
  latitude: number;
  longitude: number;
};
type LocationSearchResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};
type WidgetFolder = { id: string; name: string; widgetIds: string[] };
type DockEntry =
  | { kind: "widget"; id: string; widget: WidgetDefinition }
  | { kind: "folder"; id: string; folder: WidgetFolder };
type WidgetDragPayload =
  | {
      kind: "widget";
      widgetId: string;
      source: "dock" | "favorite" | "folder";
      slotIndex?: number;
      folderId?: string;
    }
  | {
      kind: "folder";
      folderId: string;
      source: "dock" | "favorite";
      slotIndex?: number;
    };
type PointerEventLike = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
  button?: number;
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  nativeEvent?: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pageX?: number;
    pageY?: number;
  };
};
type DragVisual = { payload: WidgetDragPayload; x: number; y: number };
type FavoriteSize = "small" | "medium" | "large";

const DEFAULT_BACKGROUND = require("../../../assets/healthos/caresuite-alien-planet-no-logo.png");
const BRAND = require("../../../assets/healthos/caresuite-healthos-logo.png");
const LOCATION_STORAGE_KEY = "caresuite.healthos.weather-location.v1";
const DOCK_ORDER_STORAGE_KEY = "caresuite.healthos.widget-order.v1";
const FAVORITES_STORAGE_KEY = "caresuite.healthos.top-widgets.v1";
const FAVORITE_SIZES_STORAGE_KEY = "caresuite.healthos.top-widget-sizes.v1";
const FOLDERS_STORAGE_KEY = "caresuite.healthos.widget-folders.v1";
const BACKGROUND_STORAGE_KEY = "caresuite.healthos.background.v1";
const FAVORITE_SLOT_COUNT = 10;
const MAX_FOLDER_WIDGETS = 4;
const DOCK_NATIVE_DRIVER = Platform.OS !== "web";

const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "company",
    label: "Unternehmen",
    route: "/business/office/dashboard",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/01-unternehmen.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/01-unternehmen.png"),
      large: require("../../../assets/healthos/widgets-premium/large/01-unternehmen.png"),
    },
  },
  {
    id: "clients",
    label: "Klient:innen",
    route: "/business/office/clients",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/02-klientinnen.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/02-klientinnen.png"),
      large: require("../../../assets/healthos/widgets-premium/large/02-klientinnen.png"),
    },
  },
  {
    id: "people",
    label: "Personal",
    route: "/business/office/employees",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/03-personal.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/03-personal.png"),
      large: require("../../../assets/healthos/widgets-premium/large/03-personal.png"),
    },
  },
  {
    id: "time",
    label: "Arbeitszeit",
    route: "/business/office/time-tracking",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/04-arbeitszeit.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/04-arbeitszeit.png"),
      large: require("../../../assets/healthos/widgets-premium/large/04-arbeitszeit.png"),
    },
  },
  {
    id: "salary",
    label: "Gehaltsstatistik",
    route: "/business/office/payroll",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/05-gehaltsstatistik.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/05-gehaltsstatistik.png"),
      large: require("../../../assets/healthos/widgets-premium/large/05-gehaltsstatistik.png"),
    },
  },
  {
    id: "billing",
    label: "Rechnungen",
    route: "/business/office/invoices",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/06-rechnungen.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/06-rechnungen.png"),
      large: require("../../../assets/healthos/widgets-premium/large/06-rechnungen.png"),
    },
  },
  {
    id: "documents",
    label: "Dokumente",
    route: "/business/office/documents",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/07-dokumente.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/07-dokumente.png"),
      large: require("../../../assets/healthos/widgets-premium/large/07-dokumente.png"),
    },
  },
  {
    id: "messages",
    label: "Nachrichten",
    route: "/business/messages",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/08-nachrichten.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/08-nachrichten.png"),
      large: require("../../../assets/healthos/widgets-premium/large/08-nachrichten.png"),
    },
  },
  {
    id: "access",
    label: "Portale & Zugänge",
    route: "/business/office/portals",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/09-portale-zugaenge.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/09-portale-zugaenge.png"),
      large: require("../../../assets/healthos/widgets-premium/large/09-portale-zugaenge.png"),
    },
  },
  {
    id: "inventory",
    label: "Inventar",
    route: "/business/office/inventory",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/10-inventar.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/10-inventar.png"),
      large: require("../../../assets/healthos/widgets-premium/large/10-inventar.png"),
    },
  },
  {
    id: "audit",
    label: "Audit",
    route: "/business/office/audit-log",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/11-audit.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/11-audit.png"),
      large: require("../../../assets/healthos/widgets-premium/large/11-audit.png"),
    },
  },
  {
    id: "assignments",
    label: "Einsätze",
    route: "/assist/einsaetze",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/12-einsaetze.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/12-einsaetze.png"),
      large: require("../../../assets/healthos/widgets-premium/large/12-einsaetze.png"),
    },
  },
  {
    id: "calendar",
    label: "Kalender & Einsatzplanung",
    route: "/assist/kalender",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/13-kalender-einsatzplanung.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/13-kalender-einsatzplanung.png"),
      large: require("../../../assets/healthos/widgets-premium/large/13-kalender-einsatzplanung.png"),
    },
  },
  {
    id: "live",
    label: "Live-Status",
    route: "/assist/live-status",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/14-live-status.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/14-live-status.png"),
      large: require("../../../assets/healthos/widgets-premium/large/14-live-status.png"),
    },
  },
  {
    id: "proofs",
    label: "Nachweise",
    route: "/assist/nachweise",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/15-nachweise.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/15-nachweise.png"),
      large: require("../../../assets/healthos/widgets-premium/large/15-nachweise.png"),
    },
  },
  {
    id: "budgets",
    label: "Budgets",
    route: "/assist/abrechnungsquellen",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/16-budgets.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/16-budgets.png"),
      large: require("../../../assets/healthos/widgets-premium/large/16-budgets.png"),
    },
  },
  {
    id: "portals",
    label: "Portale",
    route: "/assist/portale",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/17-portale.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/17-portale.png"),
      large: require("../../../assets/healthos/widgets-premium/large/17-portale.png"),
    },
  },
  {
    id: "command",
    label: "Command Center",
    route: "/command-center",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/18-command-center.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/18-command-center.png"),
      large: require("../../../assets/healthos/widgets-premium/large/18-command-center.png"),
    },
  },
  {
    id: "office",
    label: "Office",
    route: "/office",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/19-office.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/19-office.png"),
      large: require("../../../assets/healthos/widgets-premium/large/19-office.png"),
    },
  },
  {
    id: "assist",
    label: "Assist",
    route: "/assist",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/20-assist.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/20-assist.png"),
      large: require("../../../assets/healthos/widgets-premium/large/20-assist.png"),
    },
  },
  {
    id: "settings",
    label: "Einstellungen",
    route: "/settings",
    images: {
      small: require("../../../assets/healthos/widgets-premium/compact/21-einstellungen.png"),
      medium: require("../../../assets/healthos/widgets-premium/medium/21-einstellungen.png"),
      large: require("../../../assets/healthos/widgets-premium/large/21-einstellungen.png"),
    },
  },
] as const;

const BACKGROUNDS: readonly BackgroundDefinition[] = [
  {
    id: "healthos-original",
    label: "HealthOS Original",
    image: DEFAULT_BACKGROUND,
  },
  {
    id: "silver-bloom-dawn",
    label: "Silberblüten-Morgen",
    image: require("../../../assets/healthos/backgrounds/01-silberblueten-morgen.png"),
  },
  {
    id: "crystal-terraces",
    label: "Kristallterrassen",
    image: require("../../../assets/healthos/backgrounds/02-kristallterrassen.png"),
  },
  {
    id: "crystal-coast",
    label: "Kristallküste",
    image: require("../../../assets/healthos/backgrounds/03-kristallkueste.png"),
  },
  {
    id: "luminous-mushroom-forest",
    label: "Leuchtender Pilzwald",
    image: require("../../../assets/healthos/backgrounds/04-pilzwald.png"),
  },
  {
    id: "galaxy-mirror",
    label: "Galaxiespiegel",
    image: require("../../../assets/healthos/backgrounds/05-galaxiespiegel.png"),
  },
  {
    id: "crystal-cave",
    label: "Kristallhöhle",
    image: require("../../../assets/healthos/backgrounds/06-kristallhoehle.png"),
  },
  {
    id: "ocean-falls",
    label: "Ozeanfälle",
    image: require("../../../assets/healthos/backgrounds/07-ozeanfaelle.png"),
  },
  {
    id: "cloud-plateau",
    label: "Wolkenplateau",
    image: require("../../../assets/healthos/backgrounds/08-wolkenplateau.png"),
  },
  {
    id: "stone-arches",
    label: "Steinbögen",
    image: require("../../../assets/healthos/backgrounds/09-steinboegen.png"),
  },
  {
    id: "volcanic-world",
    label: "Vulkanwelt",
    image: require("../../../assets/healthos/backgrounds/10-vulkanwelt.png"),
  },
  {
    id: "ringed-dunes",
    label: "Ringplanet-Dünen",
    image: require("../../../assets/healthos/backgrounds/11-ringplanet-duenen.png"),
  },
  {
    id: "crystal-arches",
    label: "Kristallbögen",
    image: require("../../../assets/healthos/backgrounds/12-kristallboegen.png"),
  },
  {
    id: "floating-islands",
    label: "Schwebende Inseln",
    image: require("../../../assets/healthos/backgrounds/13-schwebende-inseln.png"),
  },
  {
    id: "night-forest",
    label: "Nachtwald",
    image: require("../../../assets/healthos/backgrounds/14-nachtwald.png"),
  },
  {
    id: "ice-light",
    label: "Eislicht",
    image: require("../../../assets/healthos/backgrounds/15-eislicht.png"),
  },
] as const;
const BACKGROUND_BY_ID = new Map(
  BACKGROUNDS.map((background) => [background.id, background]),
);

const DEFAULT_WIDGET_ORDER = WIDGETS.map((widget) => widget.id);
const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));
const WEB_GRAB_STYLE =
  Platform.OS === "web"
    ? ({ cursor: "grab", userSelect: "none" } as unknown as ViewStyle)
    : undefined;
const WIDE_FAVORITE_WIDGETS = new Set([
  "company",
  "time",
  "salary",
  "billing",
  "documents",
  "access",
  "assignments",
  "calendar",
  "proofs",
  "budgets",
  "command",
  "office",
  "assist",
  "settings",
]);
function folderEntryId(folderId: string) {
  return `folder:${folderId}`;
}

function normalizeFolders(value: unknown) {
  if (!Array.isArray(value)) return [] as WidgetFolder[];
  const usedWidgets = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<WidgetFolder>;
    const widgetIds = Array.isArray(candidate.widgetIds)
      ? candidate.widgetIds
          .filter(
            (id): id is string =>
              typeof id === "string" &&
              WIDGET_BY_ID.has(id) &&
              !usedWidgets.has(id),
          )
          .slice(0, MAX_FOLDER_WIDGETS)
      : [];
    widgetIds.forEach((id) => usedWidgets.add(id));
    const id =
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : `restored-${index}`;
    const name =
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name.trim().slice(0, 28)
        : `Ordner ${index + 1}`;
    return [{ id, name, widgetIds }];
  });
}

function normalizeWidgetOrder(value: unknown, folders: WidgetFolder[] = []) {
  const folderIds = new Set(folders.map((folder) => folderEntryId(folder.id)));
  const groupedWidgets = new Set(folders.flatMap((folder) => folder.widgetIds));
  const validEntry = (id: unknown): id is string =>
    typeof id === "string" &&
    ((WIDGET_BY_ID.has(id) && !groupedWidgets.has(id)) || folderIds.has(id));
  const supplied = Array.isArray(value) ? value.filter(validEntry) : [];
  const missingWidgets = DEFAULT_WIDGET_ORDER.filter(
    (id) => !groupedWidgets.has(id),
  );
  return [...new Set([...supplied, ...missingWidgets, ...folderIds])];
}

function normalizeFavoriteSlots(value: unknown, folders: WidgetFolder[] = []) {
  const slots = Array<unknown>(FAVORITE_SLOT_COUNT).fill(null);
  if (Array.isArray(value))
    value.slice(0, FAVORITE_SLOT_COUNT).forEach((item, index) => {
      slots[index] = item;
    });
  const seen = new Set<string>();
  const validFolderEntries = new Set(
    folders.map((folder) => folderEntryId(folder.id)),
  );
  return slots.map((item) => {
    if (
      typeof item !== "string" ||
      (!WIDGET_BY_ID.has(item) && !validFolderEntries.has(item)) ||
      seen.has(item)
    )
      return null;
    seen.add(item);
    return item;
  });
}

function normalizeFavoriteSizes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {} as Record<string, FavoriteSize>;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([entryId, size]) =>
        (WIDGET_BY_ID.has(entryId) || entryId.startsWith("folder:")) &&
        (size === "small" || size === "medium" || size === "large"),
    ),
  ) as Record<string, FavoriteSize>;
}

function defaultFavoriteSize(
  widget: WidgetDefinition | null,
  folder: WidgetFolder | null = null,
): FavoriteSize {
  if (folder || !widget) return "small";
  return WIDE_FAVORITE_WIDGETS.has(widget.id) ? "medium" : "small";
}

const WEATHER_LABELS: Record<number, string> = {
  0: "Klar",
  1: "Heiter",
  2: "Wolkig",
  3: "Bedeckt",
  45: "Nebel",
  48: "Nebel",
  51: "Niesel",
  53: "Niesel",
  55: "Niesel",
  61: "Regen",
  63: "Regen",
  65: "Regen",
  71: "Schnee",
  73: "Schnee",
  75: "Schnee",
  80: "Schauer",
  81: "Schauer",
  82: "Schauer",
  95: "Gewitter",
  96: "Gewitter",
  99: "Gewitter",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function weatherGlyph(code: number) {
  if (code === 0) return "☀";
  if ([1, 2, 3, 45, 48].includes(code)) return "☁";
  if (code >= 71 && code <= 75) return "❄";
  if (code >= 95) return "⚡";
  return "☂";
}

function locationLabel(address: Location.LocationGeocodedAddress | undefined) {
  return (
    address?.city ||
    address?.district ||
    address?.subregion ||
    address?.region ||
    "Aktueller Standort"
  );
}

const ROLE_LABELS: Record<string, string> = {
  business_admin: "Geschäftsführung / Admin",
  tenant_admin: "Mandantenadministration",
  platform_admin: "Plattformadministration",
  office_admin: "Office-Administration",
  admin: "Administration",
  employee: "Mitarbeitende:r",
  manager: "Leitung",
};

function displayRole(roleKey: string | null | undefined) {
  if (!roleKey) return "CareSuite HealthOS";
  return (
    ROLE_LABELS[roleKey] ??
    roleKey
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function DockWidget({
  widget,
  index,
  compact,
  reducedMotion,
  dragging,
  dropTarget,
  onOpen,
  onPointerDown,
}: {
  widget: WidgetDefinition;
  index: number;
  compact: boolean;
  reducedMotion: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onPointerDown: (event: PointerEventLike) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const interaction = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      float.setValue(0);
      return;
    }
    const enter = Animated.timing(entrance, {
      toValue: 1,
      delay: 80 + index * 85,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: DOCK_NATIVE_DRIVER,
    });
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2500 + index * 170,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: DOCK_NATIVE_DRIVER,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2500 + index * 170,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: DOCK_NATIVE_DRIVER,
        }),
      ]),
    );
    enter.start();
    floating.start();
    return () => {
      enter.stop();
      floating.stop();
    };
  }, [entrance, float, index, reducedMotion]);

  useEffect(() => {
    Animated.spring(interaction, {
      toValue: hovered ? 1 : 0,
      friction: hovered ? 7 : 9,
      tension: hovered ? 90 : 72,
      useNativeDriver: DOCK_NATIVE_DRIVER,
    }).start();
  }, [hovered, interaction]);

  const translateY = Animated.add(
    entrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
    Animated.add(
      float.interpolate({ inputRange: [0, 1], outputRange: [1, -3] }),
      interaction.interpolate({
        inputRange: [0, 1],
        outputRange: [0, compact ? -7 : -18],
      }),
    ),
  );

  return (
    <Animated.View
      {...(Platform.OS === "web"
        ? ({
            onPointerDown,
            dataSet: { healthosDrop: `dock:${widget.id}` },
          } as object)
        : {})}
      style={[
        styles.widgetMotion,
        {
          opacity: entrance,
          zIndex: hovered ? 20 : 1,
          transform: [
            { translateY },
            {
              scale: interaction.interpolate({
                inputRange: [0, 1],
                outputRange: [1, compact ? 1.035 : 1.105],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${widget.label} öffnen`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.widget,
          WEB_GRAB_STYLE,
          hovered && styles.widgetHovered,
          dropTarget && styles.widgetDropTarget,
          dragging && styles.widgetDragging,
          pressed && styles.widgetPressed,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.widgetGlow, { opacity: interaction }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.widgetTooltip,
            {
              opacity: interaction,
              transform: [
                {
                  translateY: interaction.interpolate({
                    inputRange: [0, 1],
                    outputRange: [7, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text numberOfLines={1} style={styles.widgetTooltipText}>
            {widget.label}
          </Text>
          <View style={styles.tooltipArrow} />
        </Animated.View>
        <Image
          resizeMode="contain"
          source={widget.images.small}
          style={styles.widgetImage}
        />
      </Pressable>
    </Animated.View>
  );
}

function DockFolder({
  folder,
  index,
  reducedMotion,
  dragging,
  dropTarget,
  onOpen,
  onPointerDown,
}: {
  folder: WidgetFolder;
  index: number;
  reducedMotion: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onPointerDown: (event: PointerEventLike) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const interaction = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      delay: reducedMotion ? 0 : 60 + index * 45,
      duration: reducedMotion ? 0 : 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: DOCK_NATIVE_DRIVER,
    }).start();
  }, [entrance, index, reducedMotion]);
  useEffect(() => {
    Animated.spring(interaction, {
      toValue: hovered ? 1 : 0,
      friction: 8,
      tension: 86,
      useNativeDriver: DOCK_NATIVE_DRIVER,
    }).start();
  }, [hovered, interaction]);

  return (
    <Animated.View
      {...(Platform.OS === "web"
        ? ({
            onPointerDown,
            dataSet: { healthosDrop: `folder:${folder.id}` },
          } as object)
        : {})}
      style={[
        styles.widgetMotion,
        {
          opacity: entrance,
          zIndex: hovered ? 20 : 1,
          transform: [
            {
              scale: interaction.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.06],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ordner ${folder.name} öffnen`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.widget,
          styles.folderTile,
          WEB_GRAB_STYLE,
          hovered && styles.widgetHovered,
          dropTarget && styles.folderDropTarget,
          dragging && styles.widgetDragging,
          pressed && styles.widgetPressed,
        ]}
      >
        <View pointerEvents="none" style={styles.folderPreview}>
          {Array.from({ length: MAX_FOLDER_WIDGETS }, (_, previewIndex) => {
            const previewWidget = WIDGET_BY_ID.get(
              folder.widgetIds[previewIndex] ?? "",
            );
            return (
              <View key={previewIndex} style={styles.folderPreviewCell}>
                {previewWidget ? (
                  <Image
                    resizeMode="contain"
                    source={previewWidget.images.small}
                    style={styles.folderPreviewImage}
                  />
                ) : (
                  <Text style={styles.folderPreviewPlus}>＋</Text>
                )}
              </View>
            );
          })}
        </View>
        <Text numberOfLines={1} style={styles.folderName}>
          {folder.name}
        </Text>
        <View
          pointerEvents="none"
          style={[styles.widgetTooltip, { opacity: hovered ? 1 : 0 }]}
        >
          <Text numberOfLines={1} style={styles.widgetTooltipText}>
            {folder.name} · {folder.widgetIds.length}/{MAX_FOLDER_WIDGETS}
          </Text>
          <View style={styles.tooltipArrow} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function FavoriteWidgetSlot({
  slotIndex,
  widget,
  folder,
  compact,
  size,
  dragging,
  dragOver,
  onOpen,
  onRemove,
  onRequestSize,
  onPointerDown,
}: {
  slotIndex: number;
  widget: WidgetDefinition | null;
  folder: WidgetFolder | null;
  compact: boolean;
  size: FavoriteSize;
  dragging: boolean;
  dragOver: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onRequestSize?: () => void;
  onPointerDown: (event: PointerEventLike) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const occupied = Boolean(widget || folder);
  const label = widget?.label ?? folder?.name ?? "";

  return (
    <View
      {...(Platform.OS === "web"
        ? ({
            onPointerDown: occupied ? onPointerDown : undefined,
            dataSet: { healthosDrop: `favorite:${slotIndex}` },
          } as object)
        : {})}
      style={[
        styles.favoriteSlot,
        size === "small"
          ? styles.favoriteSlotSmall
          : size === "medium"
            ? styles.favoriteSlotMedium
            : styles.favoriteSlotLarge,
        compact &&
          (size === "small"
            ? styles.favoriteSlotSmallCompact
            : size === "medium"
              ? styles.favoriteSlotMediumCompact
              : styles.favoriteSlotLargeCompact),
        occupied && styles.favoriteSlotFilled,
        occupied && WEB_GRAB_STYLE,
        dragOver && styles.favoriteSlotDropTarget,
        dragging && styles.favoriteSlotDragging,
      ]}
    >
      <Pressable
        accessibilityRole={occupied ? "button" : undefined}
        accessibilityLabel={
          occupied
            ? `${label} aus persönlichem Dock öffnen`
            : `Freier persönlicher Platz ${slotIndex + 1}`
        }
        delayLongPress={650}
        onLongPress={occupied ? onRequestSize : undefined}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={occupied ? onOpen : undefined}
        style={({ pressed }) => [
          styles.favoritePressable,
          pressed && occupied && styles.widgetPressed,
        ]}
      >
        {occupied ? (
          <>
            {widget ? (
              <Image
                resizeMode="contain"
                source={widget.images[size]}
                style={styles.favoriteImage}
              />
            ) : (
              <View pointerEvents="none" style={styles.favoriteFolderPreview}>
                {Array.from(
                  { length: MAX_FOLDER_WIDGETS },
                  (_, previewIndex) => {
                    const previewWidget = WIDGET_BY_ID.get(
                      folder?.widgetIds[previewIndex] ?? "",
                    );
                    return (
                      <View
                        key={previewIndex}
                        style={styles.favoriteFolderCell}
                      >
                        {previewWidget ? (
                          <Image
                            resizeMode="cover"
                            source={previewWidget.images.small}
                            style={styles.favoriteFolderImage}
                          />
                        ) : (
                          <Text style={styles.folderPreviewPlus}>＋</Text>
                        )}
                      </View>
                    );
                  },
                )}
                <Text numberOfLines={1} style={styles.favoriteFolderName}>
                  {folder?.name}
                </Text>
              </View>
            )}
            <View
              pointerEvents="none"
              style={[
                styles.favoriteTooltip,
                hovered && styles.favoriteTooltipVisible,
              ]}
            >
              <Text numberOfLines={1} style={styles.favoriteTooltipText}>
                {label}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`${label} aus persönlichem Dock entfernen`}
              onPressIn={(event) => event.stopPropagation()}
              onPress={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              style={styles.favoriteRemove}
            >
              <Text style={styles.favoriteRemoveText}>×</Text>
            </Pressable>
          </>
        ) : (
          <View pointerEvents="none" style={styles.favoriteEmpty}>
            <Text style={styles.favoriteEmptyPlus}>＋</Text>
            <Text style={styles.favoriteEmptyText}>{slotIndex + 1}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function CommandCenterScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { width, height } = useWindowDimensions();
  const compact = width < 780;
  const pageSize = compact ? 3 : width < 1180 ? 5 : 10;
  const preferenceOwner = auth.user?.id ?? "local";
  const dockOrderStorageKey = `${DOCK_ORDER_STORAGE_KEY}.${preferenceOwner}`;
  const favoritesStorageKey = `${FAVORITES_STORAGE_KEY}.${preferenceOwner}`;
  const favoriteSizesStorageKey = `${FAVORITE_SIZES_STORAGE_KEY}.${preferenceOwner}`;
  const foldersStorageKey = `${FOLDERS_STORAGE_KEY}.${preferenceOwner}`;
  const backgroundStorageKey = `${BACKGROUND_STORAGE_KEY}.${preferenceOwner}`;
  const [page, setPage] = useState(0);
  const [widgetOrder, setWidgetOrder] =
    useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [favoriteSlots, setFavoriteSlots] = useState<(string | null)[]>(() =>
    Array(FAVORITE_SLOT_COUNT).fill(null),
  );
  const [favoriteSizes, setFavoriteSizes] = useState<
    Record<string, FavoriteSize>
  >({});
  const [sizePickerEntryId, setSizePickerEntryId] = useState<string | null>(
    null,
  );
  const [folders, setFolders] = useState<WidgetFolder[]>([]);
  const [folderCreateOpen, setFolderCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderMessage, setFolderMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(
    BACKGROUNDS[0].id,
  );
  const [backgroundLoadedFor, setBackgroundLoadedFor] = useState<string | null>(
    null,
  );
  const [preferencesOwnerLoaded, setPreferencesOwnerLoaded] = useState<
    string | null
  >(null);
  const [dragPayload, setDragPayload] = useState<WidgetDragPayload | null>(
    null,
  );
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);
  const [now, setNow] = useState(new Date());
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState(0);
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>({
    mode: "fallback",
    label: "Berlin",
    latitude: 52.52,
    longitude: 13.405,
  });
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    LocationSearchResult[]
  >([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const pageMotion = useRef(new Animated.Value(1)).current;
  const dragPayloadRef = useRef<WidgetDragPayload | null>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const lastPageSwitchRef = useRef({ target: "", at: 0 });
  const suppressOpenUntil = useRef(0);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );
  const activeBackground =
    BACKGROUND_BY_ID.get(selectedBackgroundId) ?? BACKGROUNDS[0];
  const dockEntries = useMemo(
    () =>
      widgetOrder.reduce<DockEntry[]>((entries, entryId) => {
        if (entryId.startsWith("folder:")) {
          const folder = folderById.get(entryId.slice(7));
          if (folder) entries.push({ kind: "folder", id: entryId, folder });
          return entries;
        }
        const widget = WIDGET_BY_ID.get(entryId);
        if (widget) entries.push({ kind: "widget", id: entryId, widget });
        return entries;
      }, []),
    [folderById, widgetOrder],
  );
  const orderedWidgets = useMemo(
    () =>
      WIDGETS.slice().sort(
        (a, b) => widgetOrder.indexOf(a.id) - widgetOrder.indexOf(b.id),
      ),
    [widgetOrder],
  );
  const pageCount = Math.max(1, Math.ceil(dockEntries.length / pageSize));
  const dockHeight = height < 720 ? 112 : compact ? 124 : 136;
  const dockBottom = height < 720 ? 6 : compact ? 8 : 18;
  const dockTop = height - dockBottom - dockHeight;
  const favoritesWidth = Math.min(
    width - (compact ? 18 : 90),
    compact ? 760 : 1500,
  );
  const favoritesHeight = compact
    ? 190
    : Math.min(310, Math.max(250, height * 0.29));
  const favoritesMinimumTop = compact ? 112 : 218;
  const favoritesMaximumTop = Math.max(
    favoritesMinimumTop,
    dockTop - favoritesHeight - 18,
  );
  const favoritesTop = Math.min(
    favoritesMaximumTop,
    Math.max(
      favoritesMinimumTop,
      favoritesMinimumTop + (favoritesMaximumTop - favoritesMinimumTop) * 0.48,
    ),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setPreferencesOwnerLoaded(null);
    void Promise.all([
      AsyncStorage.getItem(dockOrderStorageKey),
      AsyncStorage.getItem(favoritesStorageKey),
      AsyncStorage.getItem(favoriteSizesStorageKey),
      AsyncStorage.getItem(foldersStorageKey),
    ])
      .then(
        ([storedOrder, storedFavorites, storedFavoriteSizes, storedFolders]) => {

        if (!active) return;
        let restoredFolders: WidgetFolder[] = [];
        try {
          restoredFolders = normalizeFolders(
            storedFolders ? JSON.parse(storedFolders) : null,
          );
        } catch {
          restoredFolders = [];
        }
        setFolders(restoredFolders);
        try {
          setWidgetOrder(
            normalizeWidgetOrder(
              storedOrder ? JSON.parse(storedOrder) : null,
              restoredFolders,
            ),
          );
        } catch {
          setWidgetOrder(normalizeWidgetOrder(null, restoredFolders));
        }
        try {
          setFavoriteSlots(
            normalizeFavoriteSlots(
              storedFavorites ? JSON.parse(storedFavorites) : null,
              restoredFolders,
            ),
          );
        } catch {
          setFavoriteSlots(Array(FAVORITE_SLOT_COUNT).fill(null));
        }
        try {
          setFavoriteSizes(
            normalizeFavoriteSizes(
              storedFavoriteSizes ? JSON.parse(storedFavoriteSizes) : null,
            ),
          );
        } catch {
          setFavoriteSizes({});
        }
        setPreferencesOwnerLoaded(preferenceOwner);
        },
      )
      .catch(() => {
        if (active) setPreferencesOwnerLoaded(preferenceOwner);
      });
    return () => {
      active = false;
    };
  }, [
    dockOrderStorageKey,
    favoritesStorageKey,
    favoriteSizesStorageKey,
    foldersStorageKey,
    preferenceOwner,
  ]);
  useEffect(() => {
    if (preferencesOwnerLoaded === preferenceOwner)
      void AsyncStorage.setItem(
        dockOrderStorageKey,
        JSON.stringify(widgetOrder),
      );
  }, [
    dockOrderStorageKey,
    preferenceOwner,
    preferencesOwnerLoaded,
    widgetOrder,
  ]);
  useEffect(() => {
    if (preferencesOwnerLoaded === preferenceOwner)
      void AsyncStorage.setItem(
        favoritesStorageKey,
        JSON.stringify(favoriteSlots),
      );
  }, [
    favoriteSlots,
    favoritesStorageKey,
    preferenceOwner,
    preferencesOwnerLoaded,
  ]);
  useEffect(() => {
    if (preferencesOwnerLoaded === preferenceOwner)
      void AsyncStorage.setItem(
        favoriteSizesStorageKey,
        JSON.stringify(favoriteSizes),
      );
  }, [
    favoriteSizes,
    favoriteSizesStorageKey,
    preferenceOwner,
    preferencesOwnerLoaded,
  ]);
  useEffect(() => {
    if (preferencesOwnerLoaded === preferenceOwner)
      void AsyncStorage.setItem(foldersStorageKey, JSON.stringify(folders));
  }, [folders, foldersStorageKey, preferenceOwner, preferencesOwnerLoaded]);
  useEffect(() => {
    let active = true;
    setBackgroundLoadedFor(null);
    void AsyncStorage.getItem(backgroundStorageKey)
      .then((storedId) => {
        if (!active) return;
        setSelectedBackgroundId(
          storedId && BACKGROUND_BY_ID.has(storedId)
            ? storedId
            : BACKGROUNDS[0].id,
        );
        setBackgroundLoadedFor(preferenceOwner);
      })
      .catch(() => {
        if (active) setBackgroundLoadedFor(preferenceOwner);
      });
    return () => {
      active = false;
    };
  }, [backgroundStorageKey, preferenceOwner]);
  useEffect(() => {
    if (backgroundLoadedFor === preferenceOwner)
      void AsyncStorage.setItem(backgroundStorageKey, selectedBackgroundId);
  }, [
    backgroundLoadedFor,
    backgroundStorageKey,
    preferenceOwner,
    selectedBackgroundId,
  ]);
  useEffect(() => () => pointerCleanupRef.current?.(), []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => mounted && setReducedMotion(enabled),
    );
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    pageMotion.setValue(reducedMotion ? 1 : 0);
    Animated.timing(pageMotion, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: DOCK_NATIVE_DRIVER,
    }).start();
  }, [page, pageMotion, reducedMotion]);

  const detectAutomaticLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error("Standortfreigabe fehlt");
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const detected: WeatherLocation = {
        mode: "auto",
        label: locationLabel(addresses[0]),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setWeatherLocation(detected);
      await AsyncStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(detected),
      );
    } catch {
      setWeatherLocation((current) =>
        current.mode === "manual"
          ? current
          : {
              mode: "fallback",
              label: "Berlin",
              latitude: 52.52,
              longitude: 13.405,
            },
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LOCATION_STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as WeatherLocation;
          if (
            parsed.mode === "manual" &&
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude)
          ) {
            setWeatherLocation(parsed);
            return;
          }
        } catch {
          /* Invalid preference is replaced automatically. */
        }
      }
      void detectAutomaticLocation();
    });
    return () => {
      active = false;
    };
  }, [detectAutomaticLocation]);

  const loadWeather = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${weatherLocation.latitude}&longitude=${weatherLocation.longitude}&current=temperature_2m,weather_code&timezone=auto`,
      );
      if (!response.ok) throw new Error("Wetterdienst nicht erreichbar");
      const data = await response.json();
      setTemperature(Math.round(Number(data?.current?.temperature_2m)));
      setWeatherCode(Number(data?.current?.weather_code ?? 0));
    } catch {
      setTemperature(null);
    }
  }, [weatherLocation.latitude, weatherLocation.longitude]);

  useEffect(() => {
    void loadWeather();
    const timer = setInterval(() => void loadWeather(), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadWeather]);
  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const visibleDockEntries = useMemo(
    () => dockEntries.slice(page * pageSize, page * pageSize + pageSize),
    [dockEntries, page, pageSize],
  );
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    return normalized
      ? orderedWidgets.filter((widget) =>
          widget.label.toLocaleLowerCase("de-DE").includes(normalized),
        )
      : orderedWidgets;
  }, [orderedWidgets, query]);
  const profile = auth.profile;
  const displayName =
    profile?.displayName || auth.user?.displayName || "Profil";
  const role = displayRole(profile?.roleKey);
  const signOut = async () => {
    setProfileOpen(false);
    await auth.signOut();
  };
  const openWidget = (widget: WidgetDefinition) => {
    if (Date.now() < suppressOpenUntil.current) return;
    if (widget.id === "settings") {
      setSearchOpen(false);
      setQuery("");
      setSettingsOpen(true);
      return;
    }
    setSearchOpen(false);
    setQuery("");
    router.push(widget.route as never);
  };
  const openDockFolder = (folderId: string) => {
    if (Date.now() < suppressOpenUntil.current) return;
    setOpenFolderId(folderId);
  };

  const reorderDockEntry = (sourceEntryId: string, targetEntryId: string) => {
    if (sourceEntryId === targetEntryId) return;
    setWidgetOrder((current) => {
      const sourceIndex = current.indexOf(sourceEntryId);
      const targetIndex = current.indexOf(targetEntryId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceEntryId);
      return next;
    });
  };
  const copyEntryToFavorite = (entryId: string, targetSlot: number) => {
    setFavoriteSlots((current) => {
      const next = [...current];
      const existingSlot = next.indexOf(entryId);
      if (existingSlot === targetSlot) return current;
      if (existingSlot >= 0) {
        const targetEntry = next[targetSlot];
        next[targetSlot] = entryId;
        next[existingSlot] = targetEntry;
      } else {
        next[targetSlot] = entryId;
      }
      return next;
    });
  };
  const copyWidgetToFavorite = (widgetId: string, targetSlot: number) =>
    copyEntryToFavorite(widgetId, targetSlot);
  const moveWidgetIntoFolder = (widgetId: string, folderId: string) => {
    const targetFolder = folders.find((folder) => folder.id === folderId);
    if (!targetFolder || targetFolder.widgetIds.includes(widgetId)) return;
    if (targetFolder.widgetIds.length >= MAX_FOLDER_WIDGETS) {
      setFolderMessage(
        `Der Ordner „${targetFolder.name}“ ist voll. Maximal vier Widgets sind möglich.`,
      );
      return;
    }
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? { ...folder, widgetIds: [...folder.widgetIds, widgetId] }
          : folder,
      ),
    );
    setWidgetOrder((current) =>
      current.filter((entryId) => entryId !== widgetId),
    );
    setFolderMessage(
      `${WIDGET_BY_ID.get(widgetId)?.label ?? "Widget"} wurde in „${targetFolder.name}“ verschoben.`,
    );
  };
  const releaseWidgetFromFolder = (
    widgetId: string,
    folderId: string,
    targetEntryId?: string,
  ) => {
    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              widgetIds: folder.widgetIds.filter((id) => id !== widgetId),
            }
          : folder,
      ),
    );
    setWidgetOrder((current) => {
      const next = current.filter((entryId) => entryId !== widgetId);
      const targetIndex = targetEntryId ? next.indexOf(targetEntryId) : -1;
      next.splice(targetIndex >= 0 ? targetIndex : next.length, 0, widgetId);
      return next;
    });
  };
  const applyPointerDrop = (
    payload: WidgetDragPayload,
    target: string | null,
  ) => {
    if (!target) return;
    if (target.startsWith("favorite:")) {
      if (payload.kind === "widget")
        copyWidgetToFavorite(payload.widgetId, Number(target.slice(9)));
      else
        copyEntryToFavorite(
          folderEntryId(payload.folderId),
          Number(target.slice(9)),
        );
      return;
    }
    if (target.startsWith("folder:")) {
      const targetFolderId = target.slice(7);
      if (payload.kind === "widget" && payload.source === "dock")
        moveWidgetIntoFolder(payload.widgetId, targetFolderId);
      else if (payload.kind === "folder" && payload.source === "dock")
        reorderDockEntry(
          folderEntryId(payload.folderId),
          folderEntryId(targetFolderId),
        );
      return;
    }
    if (!target.startsWith("dock:")) return;
    const targetEntryId = target.slice(5);
    if (payload.kind === "folder" && payload.source === "dock")
      reorderDockEntry(folderEntryId(payload.folderId), targetEntryId);
    else if (payload.kind === "widget" && payload.source === "dock")
      reorderDockEntry(payload.widgetId, targetEntryId);
    else if (
      payload.kind === "widget" &&
      payload.source === "folder" &&
      payload.folderId
    )
      releaseWidgetFromFolder(
        payload.widgetId,
        payload.folderId,
        targetEntryId,
      );
  };
  const resolvePointerTarget = (x: number, y: number) => {
    if (Platform.OS !== "web" || typeof document === "undefined") return null;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    return (
      hit?.closest<HTMLElement>("[data-healthos-drop]")?.dataset.healthosDrop ??
      null
    );
  };
  const beginPointerDrag = (
    payload: WidgetDragPayload,
    event: PointerEventLike,
  ) => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    )
      return;
    const native = event.nativeEvent ?? event;
    if ((native.button ?? event.button ?? 0) !== 0) return;
    const startX = native.clientX ?? native.pageX ?? 0;
    const startY = native.clientY ?? native.pageY ?? 0;
    let active = false;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      pointerCleanupRef.current = null;
    };
    const onMove = (pointerEvent: PointerEvent) => {
      const distance = Math.hypot(
        pointerEvent.clientX - startX,
        pointerEvent.clientY - startY,
      );
      if (!active && distance < 6) return;
      if (!active) {
        active = true;
        dragPayloadRef.current = payload;
        setDragPayload(payload);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      pointerEvent.preventDefault();
      const nextTarget = resolvePointerTarget(
        pointerEvent.clientX,
        pointerEvent.clientY,
      );
      setDragTarget(nextTarget);
      setDragVisual({
        payload,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      });
      if (
        (nextTarget === "page:prev" || nextTarget === "page:next") &&
        Date.now() - lastPageSwitchRef.current.at > 650
      ) {
        const direction = nextTarget === "page:prev" ? -1 : 1;
        setPage((current) =>
          Math.max(0, Math.min(pageCount - 1, current + direction)),
        );
        lastPageSwitchRef.current = { target: nextTarget, at: Date.now() };
      }
    };
    const onUp = (pointerEvent: PointerEvent) => {
      if (active) {
        applyPointerDrop(
          payload,
          resolvePointerTarget(pointerEvent.clientX, pointerEvent.clientY),
        );
        suppressOpenUntil.current = Date.now() + 450;
      }
      cleanup();
      dragPayloadRef.current = null;
      setDragPayload(null);
      setDragTarget(null);
      setDragVisual(null);
    };
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const removeFavorite = (slotIndex: number) =>
    setFavoriteSlots((current) =>
      current.map((widgetId, index) => (index === slotIndex ? null : widgetId)),
    );
  const createFolder = () => {
    const name = folderName.trim() || `Ordner ${folders.length + 1}`;
    const id = `folder-${Date.now().toString(36)}`;
    setFolders((current) => [
      ...current,
      { id, name: name.slice(0, 28), widgetIds: [] },
    ]);
    setWidgetOrder((current) => [...current, folderEntryId(id)]);
    setFolderName("");
    setFolderCreateOpen(false);
    setFolderMessage(`Ordner „${name.slice(0, 28)}“ wurde angelegt.`);
  };
  const dissolveFolder = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    setWidgetOrder((current) => {
      const folderIndex = current.indexOf(folderEntryId(folderId));
      const next = current.filter(
        (entryId) =>
          entryId !== folderEntryId(folderId) &&
          !folder.widgetIds.includes(entryId),
      );
      next.splice(
        folderIndex >= 0 ? folderIndex : next.length,
        0,
        ...folder.widgetIds,
      );
      return next;
    });
    setFolders((current) => current.filter((item) => item.id !== folderId));
    setFavoriteSlots((current) =>
      current.map((entryId) =>
        entryId === folderEntryId(folderId) ? null : entryId,
      ),
    );
    setOpenFolderId(null);
    setFolderMessage(`Ordner „${folder.name}“ wurde aufgelöst.`);
  };

  const searchLocations = async () => {
    const value = locationQuery.trim();
    if (value.length < 2) return;
    setLocationSearching(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=8&language=de&format=json`,
      );
      const data = await response.json();
      setLocationResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setLocationResults([]);
    } finally {
      setLocationSearching(false);
    }
  };
  const chooseManualLocation = async (result: LocationSearchResult) => {
    const selected: WeatherLocation = {
      mode: "manual",
      label: [result.name, result.admin1].filter(Boolean).join(", "),
      latitude: result.latitude,
      longitude: result.longitude,
    };
    setWeatherLocation(selected);
    await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(selected));
    setLocationOpen(false);
    setLocationQuery("");
    setLocationResults([]);
  };
  const openFolder = openFolderId
    ? (folderById.get(openFolderId) ?? null)
    : null;

  return (
    <ImageBackground
      source={activeBackground.image}
      resizeMode="cover"
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.atmosphere} />
      <View style={[styles.topLayer, compact && styles.topLayerCompact]}>
        <View
          style={[
            styles.identityColumn,
            compact && styles.identityColumnCompact,
          ]}
        >
          <Image
            accessibilityLabel="CareSuite HealthOS"
            resizeMode="contain"
            source={BRAND}
            style={[styles.logo, compact && styles.logoCompact]}
          />
          <View
            style={[
              styles.glass,
              styles.timeWeather,
              compact && styles.timeWeatherCompact,
            ]}
          >
            <View style={styles.timeBlock}>
              <Text style={[styles.time, compact && styles.timeCompact]}>
                {now.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text numberOfLines={1} style={styles.date}>
                {formatDate(now)}
              </Text>
            </View>
            <View style={styles.glassDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wetterstandort ändern"
              onPress={() => setLocationOpen(true)}
              style={({ pressed }) => [
                styles.weatherBlock,
                pressed && styles.controlPressed,
              ]}
            >
              <Text style={styles.weatherIcon}>
                {weatherGlyph(weatherCode)}
              </Text>
              <View style={styles.weatherCopy}>
                <Text style={styles.weatherLine}>
                  {temperature === null ? "—°" : `${temperature}°`}{" "}
                  <Text style={styles.weatherState}>
                    {WEATHER_LABELS[weatherCode] ?? "Aktuell"}
                  </Text>
                </Text>
                <Text numberOfLines={1} style={styles.place}>
                  ⌖ {weatherLocation.label} · ändern
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
        <View
          style={[
            styles.glass,
            styles.actions,
            compact && styles.actionsCompact,
          ]}
        >
          <Pressable
            accessibilityLabel="Widget suchen"
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.actionGlyph}>⌕</Text>
          </Pressable>
          {!compact ? <PortalTextSizeControls /> : null}
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
          <Pressable
            accessibilityLabel="Einstellungen öffnen"
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.actionGlyph}>☷</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Kontomenü von ${displayName} öffnen`}
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [
              styles.profileTrigger,
              pressed && styles.controlPressed,
            ]}
          >
            {!compact ? (
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.profileName}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={styles.profileRole}>
                  {role}
                </Text>
              </View>
            ) : null}
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={profile?.avatarUrl?.trim() || undefined}
              avatarVersion={profile?.updatedAt ?? profile?.avatarUrl}
              accentColor="#56C7FF"
              size="lg"
            />
            {!compact ? <Text style={styles.profileChevron}>⌄</Text> : null}
          </Pressable>
        </View>
      </View>
      <View
        style={[
          styles.favoritesRegion,
          {
            top: favoritesTop,
            left: (width - favoritesWidth) / 2,
            width: favoritesWidth,
            height: favoritesHeight,
          },
        ]}
      >
        <View
          style={[
            styles.favoritesPanel,
            compact && styles.favoritesPanelCompact,
          ]}
        >
          <View style={styles.favoritesHeader}>
            <Text style={styles.favoritesTitle}>PERSÖNLICHES DOCK</Text>
            <Text numberOfLines={1} style={styles.favoritesHint}>
              Widget lange anklicken: Größe wählen · bis zu 10 Favoriten
            </Text>
          </View>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.favoritesGrid}
            contentContainerStyle={styles.favoriteFlowGrid}
          >
            {favoriteSlots.map((widgetId, slotIndex) => {
              const widget =
                widgetId && !widgetId.startsWith("folder:")
                  ? (WIDGET_BY_ID.get(widgetId) ?? null)
                  : null;
              const favoriteFolder = widgetId?.startsWith("folder:")
                ? (folderById.get(widgetId.slice(7)) ?? null)
                : null;
              const size = widgetId
                ? (favoriteSizes[widgetId] ??
                  defaultFavoriteSize(widget, favoriteFolder))
                : "small";
              const draggingFavorite = Boolean(
                (widget &&
                  dragPayload?.kind === "widget" &&
                  dragPayload.widgetId === widget.id) ||
                  (favoriteFolder &&
                    dragPayload?.kind === "folder" &&
                    dragPayload.folderId === favoriteFolder.id),
              );
              return (
                <FavoriteWidgetSlot
                  key={slotIndex}
                  slotIndex={slotIndex}
                  widget={widget}
                  folder={favoriteFolder}
                  compact={compact}
                  size={size}
                  dragging={draggingFavorite}
                  dragOver={dragTarget === `favorite:${slotIndex}`}
                  onOpen={() =>
                    widget
                      ? openWidget(widget)
                      : favoriteFolder
                        ? openDockFolder(favoriteFolder.id)
                        : undefined
                  }
                  onRemove={() => removeFavorite(slotIndex)}
                  onRequestSize={
                    widget
                      ? () => {
                          suppressOpenUntil.current = Date.now() + 900;
                          setSizePickerEntryId(widget.id);
                        }
                      : undefined
                  }
                  onPointerDown={(event) =>
                    widget
                      ? beginPointerDrag(
                          {
                            kind: "widget",
                            widgetId: widget.id,
                            source: "favorite",
                            slotIndex,
                          },
                          event,
                        )
                      : favoriteFolder
                        ? beginPointerDrag(
                            {
                              kind: "folder",
                              folderId: favoriteFolder.id,
                              source: "favorite",
                              slotIndex,
                            },
                            event,
                          )
                        : undefined
                  }
                />
              );
            })}
          </ScrollView>
        </View>
      </View>
      <View
        style={[
          styles.dockRegion,
          compact && styles.dockRegionCompact,
          height < 720 && styles.dockRegionShort,
        ]}
      >
        <Pressable
          accessibilityLabel="Vorherige Widget-Seite"
          disabled={page === 0}
          onPress={() => setPage((value) => Math.max(0, value - 1))}
          {...(Platform.OS === "web"
            ? ({ dataSet: { healthosDrop: "page:prev" } } as object)
            : {})}
          style={({ pressed }) => [
            styles.arrow,
            page === 0 && styles.arrowDisabled,
            pressed && styles.arrowPressed,
          ]}
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <View
          style={[styles.glass, styles.dock, compact && styles.dockCompact]}
        >
          <View pointerEvents="none" style={styles.dockHighlight} />
          <Pressable
            accessibilityLabel="Neuen Widget-Ordner anlegen"
            onPress={() => setFolderCreateOpen(true)}
            style={({ pressed }) => [
              styles.folderCreateButton,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.folderCreateIcon}>＋</Text>
            <Text style={styles.folderCreateText}>Ordner</Text>
          </Pressable>
          <Animated.View
            style={[
              styles.widgetRow,
              {
                opacity: pageMotion,
                transform: [
                  {
                    translateX: pageMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {visibleDockEntries.map((entry, index) =>
              entry.kind === "widget" ? (
                <DockWidget
                  key={entry.id}
                  widget={entry.widget}
                  index={index}
                  compact={compact}
                  reducedMotion={reducedMotion}
                  dragging={
                    dragPayload?.kind === "widget" &&
                    dragPayload.source === "dock" &&
                    dragPayload.widgetId === entry.widget.id
                  }
                  dropTarget={dragTarget === `dock:${entry.id}`}
                  onOpen={() => openWidget(entry.widget)}
                  onPointerDown={(event) =>
                    beginPointerDrag(
                      {
                        kind: "widget",
                        widgetId: entry.widget.id,
                        source: "dock",
                      },
                      event,
                    )
                  }
                />
              ) : (
                <DockFolder
                  key={entry.id}
                  folder={entry.folder}
                  index={index}
                  reducedMotion={reducedMotion}
                  dragging={
                    dragPayload?.kind === "folder" &&
                    dragPayload.folderId === entry.folder.id
                  }
                  dropTarget={dragTarget === `folder:${entry.folder.id}`}
                  onOpen={() => openDockFolder(entry.folder.id)}
                  onPointerDown={(event) =>
                    beginPointerDrag(
                      {
                        kind: "folder",
                        folderId: entry.folder.id,
                        source: "dock",
                      },
                      event,
                    )
                  }
                />
              ),
            )}
          </Animated.View>
          <View style={styles.pageDots}>
            {Array.from({ length: pageCount }, (_, index) => (
              <Pressable
                key={index}
                accessibilityLabel={`Widget-Seite ${index + 1}`}
                onPress={() => setPage(index)}
                style={[styles.pageDot, index === page && styles.pageDotActive]}
              />
            ))}
          </View>
        </View>
        <Pressable
          accessibilityLabel="Nächste Widget-Seite"
          disabled={page >= pageCount - 1}
          onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          {...(Platform.OS === "web"
            ? ({ dataSet: { healthosDrop: "page:next" } } as object)
            : {})}
          style={({ pressed }) => [
            styles.arrow,
            page >= pageCount - 1 && styles.arrowDisabled,
            pressed && styles.arrowPressed,
          ]}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      {folderMessage ? (
        <Pressable
          onPress={() => setFolderMessage("")}
          style={[styles.glass, styles.folderToast]}
        >
          <Text numberOfLines={2} style={styles.folderToastText}>
            {folderMessage}
          </Text>
        </Pressable>
      ) : null}
      {dragVisual ? (
        <View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            { left: dragVisual.x - 56, top: dragVisual.y - 42 },
          ]}
        >
          {dragVisual.payload.kind === "widget" ? (
            <Image
              resizeMode="contain"
              source={WIDGET_BY_ID.get(dragVisual.payload.widgetId)?.images.medium}
              style={styles.dragGhostImage}
            />
          ) : (
            <View style={styles.dragGhostFolder}>
              <Text style={styles.dragGhostFolderIcon}>▦</Text>
            </View>
          )}
        </View>
      ) : null}
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(sizePickerEntryId)}
        onRequestClose={() => setSizePickerEntryId(null)}
      >
        <Pressable
          onPress={() => setSizePickerEntryId(null)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.sizePickerPanel]}
          >
            <View style={styles.searchHeader}>
              <View style={styles.sizePickerHeading}>
                <Text style={styles.searchTitle}>Widgetgröße auswählen</Text>
                <Text style={styles.locationSubtitle}>
                  Die gewählte Größe bleibt für dieses Widget gespeichert.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Größenwahl schließen"
                onPress={() => setSizePickerEntryId(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {sizePickerEntryId && WIDGET_BY_ID.get(sizePickerEntryId) ? (
              <View style={styles.sizePickerOptions}>
                {(["small", "medium", "large"] as FavoriteSize[]).map(
                  (option) => {
                    const pickerWidget = WIDGET_BY_ID.get(sizePickerEntryId);
                    if (!pickerWidget) return null;
                    const selected =
                      (favoriteSizes[sizePickerEntryId] ??
                        defaultFavoriteSize(pickerWidget)) === option;
                    const label =
                      option === "small"
                        ? "Klein"
                        : option === "medium"
                          ? "Mittel"
                          : "Groß";
                    const ratio =
                      option === "small" ? "1:1" : option === "medium" ? "2:1" : "3:1";
                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          setFavoriteSizes((current) => ({
                            ...current,
                            [sizePickerEntryId]: option,
                          }));
                          setSizePickerEntryId(null);
                          setFolderMessage(
                            `${pickerWidget.label}: Größe ${label} (${ratio}) gespeichert.`,
                          );
                        }}
                        style={({ pressed }) => [
                          styles.sizePickerOption,
                          selected && styles.sizePickerOptionSelected,
                          pressed && styles.controlPressed,
                        ]}
                      >
                        <View style={styles.sizePickerPreview}>
                          <Image
                            resizeMode="contain"
                            source={pickerWidget.images[option]}
                            style={styles.sizePickerPreviewImage}
                          />
                        </View>
                        <Text style={styles.sizePickerOptionTitle}>{label}</Text>
                        <Text style={styles.sizePickerOptionRatio}>{ratio}</Text>
                        <View
                          style={[
                            styles.sizePickerCheck,
                            selected && styles.sizePickerCheckSelected,
                          ]}
                        >
                          <Text style={styles.sizePickerCheckText}>
                            {selected ? "✓" : ""}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={folderCreateOpen}
        onRequestClose={() => setFolderCreateOpen(false)}
      >
        <Pressable
          onPress={() => setFolderCreateOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.folderCreatePanel]}
          >
            <View style={styles.searchHeader}>
              <View>
                <Text style={styles.searchTitle}>Widget-Ordner anlegen</Text>
                <Text style={styles.locationSubtitle}>
                  Anschließend bis zu vier Widgets auf den Ordner ziehen.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Ordnerdialog schließen"
                onPress={() => setFolderCreateOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              maxLength={28}
              placeholder="Name des Ordners …"
              placeholderTextColor="#90A5BF"
              value={folderName}
              onChangeText={setFolderName}
              onSubmitEditing={createFolder}
              style={styles.searchInput}
            />
            <Pressable
              onPress={createFolder}
              style={styles.folderConfirmButton}
            >
              <Text style={styles.folderConfirmButtonText}>Ordner anlegen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(openFolder)}
        onRequestClose={() => setOpenFolderId(null)}
      >
        <Pressable
          onPress={() => setOpenFolderId(null)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.folderPanel]}
          >
            {openFolder ? (
              <>
                <View style={styles.searchHeader}>
                  <View>
                    <Text style={styles.searchTitle}>{openFolder.name}</Text>
                    <Text style={styles.locationSubtitle}>
                      {openFolder.widgetIds.length}/{MAX_FOLDER_WIDGETS} Widgets
                      · Vorschau und Schnellzugriff
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Ordner schließen"
                    onPress={() => setOpenFolderId(null)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeText}>×</Text>
                  </Pressable>
                </View>
                <View style={styles.folderContents}>
                  {Array.from({ length: MAX_FOLDER_WIDGETS }, (_, index) => {
                    const widget = WIDGET_BY_ID.get(
                      openFolder.widgetIds[index] ?? "",
                    );
                    return widget ? (
                      <View key={widget.id} style={styles.folderContentCard}>
                        <Pressable
                          onPress={() => openWidget(widget)}
                          style={styles.folderContentOpen}
                        >
                          <Image
                            resizeMode="contain"
                            source={widget.images.large}
                            style={styles.folderContentImage}
                          />
                          <Text
                            numberOfLines={1}
                            style={styles.folderContentLabel}
                          >
                            {widget.label}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`${widget.label} aus Ordner lösen`}
                          onPress={() =>
                            releaseWidgetFromFolder(widget.id, openFolder.id)
                          }
                          style={styles.folderReleaseButton}
                        >
                          <Text style={styles.folderReleaseButtonText}>↗</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        key={index}
                        style={[
                          styles.folderContentCard,
                          styles.folderContentEmpty,
                        ]}
                      >
                        <Text style={styles.favoriteEmptyPlus}>＋</Text>
                        <Text style={styles.favoriteEmptyText}>
                          Freier Platz
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => dissolveFolder(openFolder.id)}
                  style={styles.folderDissolveButton}
                >
                  <Text style={styles.folderDissolveText}>Ordner auflösen</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={searchOpen}
        onRequestClose={() => setSearchOpen(false)}
      >
        <Pressable
          onPress={() => setSearchOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.searchPanel]}
          >
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Widgets durchsuchen</Text>
              <Pressable
                accessibilityLabel="Suche schließen"
                onPress={() => setSearchOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              placeholder="Funktion suchen …"
              placeholderTextColor="#90A5BF"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            <ScrollView
              contentContainerStyle={styles.searchResults}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((widget) => (
                <Pressable
                  key={widget.id}
                  onPress={() => openWidget(widget)}
                  style={styles.searchResult}
                >
                  <Image
                    source={widget.images.medium}
                    resizeMode="contain"
                    style={styles.searchThumb}
                  />
                  <Text style={styles.searchResultText}>{widget.label}</Text>
                  <Text style={styles.searchChevron}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={locationOpen}
        onRequestClose={() => setLocationOpen(false)}
      >
        <Pressable
          onPress={() => setLocationOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.locationPanel]}
          >
            <View style={styles.searchHeader}>
              <View>
                <Text style={styles.searchTitle}>Wetterstandort</Text>
                <Text style={styles.locationSubtitle}>
                  Automatisch ermitteln oder Ort manuell festlegen
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Standortdialog schließen"
                onPress={() => setLocationOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setLocationOpen(false);
                void detectAutomaticLocation();
              }}
              style={styles.autoLocationButton}
            >
              <Text style={styles.autoLocationIcon}>⌖</Text>
              <View style={styles.autoLocationCopy}>
                <Text style={styles.autoLocationTitle}>
                  Aktuellen Standort verwenden
                </Text>
                <Text style={styles.autoLocationDetail}>
                  GPS-/Browserfreigabe und automatische Ortsnamenermittlung
                </Text>
              </View>
              <Text style={styles.searchChevron}>›</Text>
            </Pressable>
            <View style={styles.locationSearchRow}>
              <TextInput
                placeholder="Ort oder Postleitzahl eingeben …"
                placeholderTextColor="#90A5BF"
                value={locationQuery}
                onChangeText={setLocationQuery}
                onSubmitEditing={() => void searchLocations()}
                style={[styles.searchInput, styles.locationInput]}
              />
              <Pressable
                onPress={() => void searchLocations()}
                style={styles.locationSearchButton}
              >
                <Text style={styles.locationSearchButtonText}>
                  {locationSearching ? "…" : "Suchen"}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.searchResults}
              keyboardShouldPersistTaps="handled"
            >
              {locationResults.map((result) => (
                <Pressable
                  key={`${result.id}-${result.latitude}-${result.longitude}`}
                  onPress={() => void chooseManualLocation(result)}
                  style={styles.locationResult}
                >
                  <Text style={styles.locationResultTitle}>{result.name}</Text>
                  <Text style={styles.locationResultDetail}>
                    {[result.admin1, result.country]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={settingsOpen}
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable
          onPress={() => setSettingsOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.settingsPanel]}
          >
            <View style={styles.searchHeader}>
              <View style={styles.settingsHeading}>
                <Text style={styles.settingsEyebrow}>CARESUITE HEALTHOS</Text>
                <Text style={styles.searchTitle}>Einstellungen</Text>
                <Text style={styles.locationSubtitle}>
                  Darstellung und persönlicher Hintergrund
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Einstellungen schließen"
                onPress={() => setSettingsOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.settingsCurrent}>
              <ImageBackground
                source={activeBackground.image}
                resizeMode="cover"
                style={styles.settingsCurrentImage}
                imageStyle={styles.settingsCurrentImageRadius}
              >
                <View style={styles.settingsCurrentShade}>
                  <Text style={styles.settingsCurrentBadge}>AKTIV</Text>
                  <Text style={styles.settingsCurrentTitle}>
                    {activeBackground.label}
                  </Text>
                </View>
              </ImageBackground>
              <View style={styles.settingsCurrentCopy}>
                <Text style={styles.settingsSectionTitle}>
                  HealthOS-Hintergrund
                </Text>
                <Text style={styles.settingsDescription}>
                  Wähle ein Motiv für deine zentrale Oberfläche. Die Auswahl
                  wird deinem Benutzerkonto zugeordnet und beim nächsten Start
                  automatisch wiederhergestellt.
                </Text>
                <Pressable
                  onPress={() => setSelectedBackgroundId(BACKGROUNDS[0].id)}
                  style={({ pressed }) => [
                    styles.settingsReset,
                    pressed && styles.controlPressed,
                  ]}
                >
                  <Text style={styles.settingsResetText}>
                    Original wiederherstellen
                  </Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              style={styles.backgroundScroll}
              contentContainerStyle={styles.backgroundGallery}
              showsVerticalScrollIndicator
            >
              {BACKGROUNDS.map((background) => {
                const selected = background.id === selectedBackgroundId;
                return (
                  <Pressable
                    key={background.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${background.label} als Hintergrund verwenden`}
                    onPress={() => setSelectedBackgroundId(background.id)}
                    style={({ pressed }) => [
                      styles.backgroundOption,
                      selected && styles.backgroundOptionSelected,
                      pressed && styles.controlPressed,
                    ]}
                  >
                    <Image
                      source={background.image}
                      resizeMode="cover"
                      style={styles.backgroundThumbnail}
                    />
                    <View style={styles.backgroundOptionFooter}>
                      <Text
                        numberOfLines={1}
                        style={styles.backgroundOptionLabel}
                      >
                        {background.label}
                      </Text>
                      <View
                        style={[
                          styles.backgroundCheck,
                          selected && styles.backgroundCheckSelected,
                        ]}
                      >
                        <Text style={styles.backgroundCheckText}>
                          {selected ? "✓" : ""}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={profileOpen}
        onRequestClose={() => setProfileOpen(false)}
      >
        <Pressable
          onPress={() => setProfileOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.glass, styles.profilePanel]}
          >
            <View style={styles.profilePanelHeader}>
              <TopbarProfileAvatar
                name={displayName}
                avatarUrl={profile?.avatarUrl?.trim() || undefined}
                avatarVersion={profile?.updatedAt ?? profile?.avatarUrl}
                accentColor="#56C7FF"
                size="lg"
              />
              <View style={styles.profilePanelIdentity}>
                <Text numberOfLines={1} style={styles.profilePanelName}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={styles.profilePanelRole}>
                  {role}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Kontomenü schließen"
                onPress={() => setProfileOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.profilePanelDivider} />
            <Pressable
              onPress={() => {
                setProfileOpen(false);
                router.push("/settings/profile" as never);
              }}
              style={({ pressed }) => [
                styles.profilePanelRow,
                pressed && styles.controlPressed,
              ]}
            >
              <View>
                <Text style={styles.profilePanelRowTitle}>
                  Profil & Sicherheit
                </Text>
                <Text style={styles.profilePanelRowDetail}>
                  Persönliche Angaben, Profilbild und Zugang
                </Text>
              </View>
              <Text style={styles.profilePanelRowArrow}>›</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setProfileOpen(false);
                setSettingsOpen(true);
              }}
              style={({ pressed }) => [
                styles.profilePanelRow,
                pressed && styles.controlPressed,
              ]}
            >
              <View>
                <Text style={styles.profilePanelRowTitle}>
                  Darstellung & Hintergrund
                </Text>
                <Text style={styles.profilePanelRowDetail}>
                  HealthOS-Oberfläche persönlich anpassen
                </Text>
              </View>
              <Text style={styles.profilePanelRowArrow}>›</Text>
            </Pressable>
            <View style={styles.profilePanelDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sicher abmelden"
              onPress={() => void signOut()}
              style={({ pressed }) => [
                styles.profileLogout,
                pressed && styles.controlPressed,
              ]}
            >
              <Text style={styles.profileLogoutIcon}>↪</Text>
              <Text style={styles.profileLogoutText}>Sicher abmelden</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: "100%",
    backgroundColor: "#03132B",
    overflow: "hidden",
  },
  backgroundImage: { width: "100%", height: "100%" },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,12,31,0.05)",
  },
  topLayer: {
    position: "absolute",
    top: 28,
    left: 32,
    right: 32,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
  },
  topLayerCompact: { top: 16, left: 14, right: 14, gap: 10 },
  identityColumn: { width: 440, alignItems: "flex-start", gap: 10 },
  identityColumnCompact: { width: "auto", flex: 1 },
  logo: { width: 430, height: 54 },
  logoCompact: { width: 210, height: 30 },
  glass: {
    backgroundColor: "rgba(2,15,35,0.72)",
    borderWidth: 1,
    borderColor: "rgba(139,211,255,0.36)",
    shadowColor: "#2BB8FF",
    shadowOpacity: 0.23,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    ...(Platform.OS === "web"
      ? ({ backdropFilter: "blur(24px) saturate(1.2)" } as const)
      : null),
  },
  timeWeather: {
    minWidth: 430,
    minHeight: 86,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  timeWeatherCompact: {
    minWidth: 0,
    alignSelf: "stretch",
    minHeight: 70,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  timeBlock: { flex: 1, minWidth: 0 },
  time: {
    color: "#FFF",
    fontSize: 36,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  timeCompact: { fontSize: 25, lineHeight: 28 },
  date: { color: "#D8EAFF", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  glassDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(149,210,255,0.24)",
    marginHorizontal: 18,
  },
  weatherBlock: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weatherCopy: { flex: 1, minWidth: 0 },
  weatherIcon: { color: "#8FE4FF", fontSize: 30 },
  weatherLine: {
    color: "#FFF",
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
  },
  weatherState: { fontSize: 13, fontWeight: "800" },
  place: { color: "#BCD4EC", fontSize: 11, marginTop: 3 },
  actions: {
    minHeight: 88,
    borderRadius: 28,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionsCompact: { minHeight: 60, padding: 7, borderRadius: 22, gap: 6 },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(146,205,255,0.28)",
    backgroundColor: "rgba(8,29,59,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionGlyph: { color: "#FFF", fontSize: 23, fontWeight: "700" },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  livePill: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "rgba(70,171,255,0.5)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#58D8C1",
    shadowColor: "#58D8C1",
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  liveText: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  profileTrigger: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 3,
    borderRadius: 20,
  },
  profileCopy: { maxWidth: 185, alignItems: "flex-end", marginLeft: 4 },
  profileName: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  profileRole: {
    color: "#BFD8EE",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "700",
  },
  profileChevron: {
    color: "#9FDFFF",
    fontSize: 15,
    marginLeft: -5,
    marginRight: 2,
  },
  favoritesRegion: { position: "absolute", zIndex: 4 },
  favoritesPanel: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 5,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  favoritesPanelCompact: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 3,
  },
  favoritesHighlight: { display: "none" },
  favoritesHeader: {
    height: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    gap: 12,
  },
  favoritesTitle: {
    color: "#A2EAFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    textShadowColor: "rgba(0,8,24,0.95)",
    textShadowRadius: 7,
  },
  favoritesHint: {
    flex: 1,
    color: "rgba(224,242,255,0.82)",
    fontSize: 10,
    textAlign: "right",
    textShadowColor: "rgba(0,8,24,0.95)",
    textShadowRadius: 7,
  },
  favoritesGrid: { flex: 1, minHeight: 0 },
  favoriteFlowGrid: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 3,
    paddingBottom: 10,
  },
  favoriteSlot: {
    minWidth: 0,
    borderRadius: 19,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(139,211,255,0.36)",
    backgroundColor: "rgba(2,12,29,0.38)",
    alignItems: "stretch",
    justifyContent: "center",
    overflow: "visible",
    shadowColor: "#07162D",
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === "web"
      ? ({ backdropFilter: "blur(13px) saturate(1.15)" } as const)
      : null),
  },
  favoriteSlotSmall: { width: 112, height: 112, flexShrink: 0 },
  favoriteSlotMedium: { width: 260, height: 112, flexShrink: 0 },
  favoriteSlotLarge: { width: 420, height: 112, flexShrink: 0 },
  favoriteSlotSmallCompact: {
    width: 72,
    height: 72,
    flexShrink: 0,
    borderRadius: 13,
  },
  favoriteSlotMediumCompact: {
    width: 160,
    height: 72,
    flexShrink: 0,
    borderRadius: 13,
  },
  favoriteSlotLargeCompact: {
    width: 250,
    height: 72,
    flexShrink: 0,
    borderRadius: 13,
  },
  favoriteSlotFilled: {
    borderStyle: "solid",
    borderColor: "rgba(130,214,255,0.42)",
    backgroundColor: "rgba(3,12,27,0.76)",
  },
  favoriteSlotDropTarget: {
    borderStyle: "solid",
    borderColor: "#6FE0FF",
    backgroundColor: "rgba(34,151,210,0.3)",
    shadowColor: "#5DDCFF",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    transform: [{ scale: 1.035 }],
  },
  favoriteSlotDragging: { opacity: 0.42, borderColor: "#72DEFF" },
  favoriteImage: { width: "100%", height: "100%", borderRadius: 18 },
  favoriteFolderPreview: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "stretch",
    justifyContent: "center",
    gap: 5,
    padding: 6,
  },
  favoriteFolderCell: {
    width: "48%",
    height: "46%",
    borderRadius: 7,
    backgroundColor: "rgba(102,193,238,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  favoriteFolderImage: { width: "100%", height: "100%" },
  favoriteFolderName: {
    position: "absolute",
    left: 7,
    right: 7,
    bottom: 5,
    color: "#EAF8FF",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,8,24,0.95)",
    textShadowRadius: 6,
  },
  favoriteEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  favoriteEmptyPlus: {
    color: "rgba(129,214,255,0.52)",
    fontSize: 21,
    lineHeight: 23,
  },
  favoriteEmptyText: {
    color: "rgba(186,220,245,0.58)",
    fontSize: 10,
    fontWeight: "800",
  },
  favoriteRemove: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "rgba(1,10,24,0.94)",
    borderWidth: 1,
    borderColor: "rgba(139,211,255,0.44)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9,
  },
  favoriteRemoveText: {
    color: "#DDF5FF",
    fontSize: 15,
    lineHeight: 16,
    marginTop: -1,
  },
  favoriteTooltip: {
    position: "absolute",
    top: -29,
    left: 3,
    right: 3,
    minHeight: 25,
    borderRadius: 8,
    paddingHorizontal: 6,
    backgroundColor: "rgba(2,16,36,0.96)",
    borderWidth: 1,
    borderColor: "rgba(113,211,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    zIndex: 15,
  },
  favoriteTooltipVisible: { opacity: 1 },
  favoriteTooltipText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  favoritePressable: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    overflow: "visible",
  },
  dockRegion: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 18,
    height: 136,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  dockRegionCompact: { left: 8, right: 8, bottom: 8, height: 124, gap: 5 },
  dockRegionShort: { bottom: 6, height: 112 },
  dock: {
    flex: 1,
    height: "100%",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    overflow: "visible",
  },
  dockCompact: { paddingHorizontal: 7, paddingTop: 13, borderRadius: 22 },
  dockHighlight: {
    position: "absolute",
    top: 0,
    left: 50,
    right: 50,
    height: 1,
    backgroundColor: "rgba(190,231,255,0.52)",
  },
  folderCreateButton: {
    position: "absolute",
    top: 4,
    right: 13,
    zIndex: 35,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(116,210,255,0.34)",
    backgroundColor: "rgba(4,25,51,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  folderCreateIcon: {
    color: "#81E0FF",
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "800",
  },
  folderCreateText: { color: "#DDF5FF", fontSize: 9, fontWeight: "800" },
  widgetRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  widgetMotion: { flex: 1, minWidth: 0, maxWidth: 150, height: "100%" },
  widget: {
    flex: 1,
    minWidth: 0,
    borderRadius: 17,
    padding: 2,
    backgroundColor: "rgba(2,11,27,0.58)",
    borderWidth: 1,
    borderColor: "rgba(133,205,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  widgetHovered: {
    borderColor: "rgba(111,218,255,0.72)",
    backgroundColor: "rgba(6,28,58,0.9)",
    shadowColor: "#4FD7FF",
    shadowOpacity: 0.62,
    shadowRadius: 19,
    shadowOffset: { width: 0, height: 8 },
  },
  widgetDropTarget: {
    borderColor: "#74E2FF",
    backgroundColor: "rgba(32,147,205,0.34)",
    transform: [{ scale: 1.035 }],
  },
  widgetDragging: { opacity: 0.4, borderColor: "#72DEFF" },
  widgetPressed: { opacity: 0.84 },
  widgetImage: { width: "100%", height: "100%" },
  widgetGlow: {
    position: "absolute",
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderRadius: 20,
    backgroundColor: "rgba(76,207,255,0.11)",
    shadowColor: "#54D9FF",
    shadowOpacity: 0.7,
    shadowRadius: 19,
  },
  widgetTooltip: {
    position: "absolute",
    top: -36,
    left: -5,
    right: -5,
    minHeight: 29,
    zIndex: 40,
    borderRadius: 10,
    backgroundColor: "rgba(2,16,36,0.97)",
    borderWidth: 1,
    borderColor: "rgba(113,211,255,0.55)",
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4ACDFF",
    shadowOpacity: 0.42,
    shadowRadius: 12,
  },
  widgetTooltipText: {
    color: "#FFF",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  tooltipArrow: {
    position: "absolute",
    bottom: -4,
    width: 8,
    height: 8,
    backgroundColor: "rgba(2,16,36,0.96)",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(113,211,255,0.55)",
    transform: [{ rotate: "45deg" }],
  },
  folderTile: { padding: 6 },
  folderDropTarget: {
    borderColor: "#64E3B8",
    backgroundColor: "rgba(21,127,107,0.38)",
    shadowColor: "#64E3B8",
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  folderPreview: {
    flex: 1,
    width: "88%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    gap: 3,
  },
  folderPreviewCell: {
    width: "45%",
    height: "43%",
    borderRadius: 5,
    backgroundColor: "rgba(115,191,238,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  folderPreviewImage: { width: "100%", height: "100%" },
  folderPreviewPlus: { color: "rgba(132,215,255,0.46)", fontSize: 12 },
  folderName: {
    color: "#EAF7FF",
    fontSize: 9,
    fontWeight: "800",
    maxWidth: "96%",
    marginTop: 2,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(142,210,255,0.42)",
    backgroundColor: "rgba(3,18,39,0.78)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3AC7FF",
    shadowOpacity: 0.22,
    shadowRadius: 13,
  },
  arrowDisabled: { opacity: 0.28 },
  arrowPressed: { transform: [{ scale: 0.92 }], borderColor: "#7DDCFF" },
  arrowText: {
    color: "#FFF",
    fontSize: 35,
    lineHeight: 38,
    fontWeight: "300",
    marginTop: -3,
  },
  pageDots: {
    height: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(186,219,245,0.32)",
  },
  pageDotActive: {
    width: 18,
    backgroundColor: "#68D4FF",
    shadowColor: "#68D4FF",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,5,16,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  sizePickerPanel: {
    width: "100%",
    maxWidth: 920,
    borderRadius: 30,
    padding: 20,
  },
  sizePickerHeading: { flex: 1, minWidth: 0 },
  sizePickerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 12,
  },
  sizePickerOption: {
    width: "31%",
    minWidth: 210,
    minHeight: 190,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(126,205,255,0.28)",
    backgroundColor: "rgba(3,18,40,0.76)",
    padding: 10,
    alignItems: "center",
  },
  sizePickerOptionSelected: {
    borderColor: "#74E3FF",
    backgroundColor: "rgba(15,71,108,0.9)",
    shadowColor: "#57D7FF",
    shadowOpacity: 0.58,
    shadowRadius: 18,
  },
  sizePickerPreview: {
    width: "100%",
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  sizePickerPreviewImage: { width: "100%", height: "100%" },
  sizePickerOptionTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },
  sizePickerOptionRatio: {
    color: "#9DDFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  sizePickerCheck: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129,208,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  sizePickerCheckSelected: {
    backgroundColor: "#6EE1FF",
    borderColor: "#B4F2FF",
  },
  sizePickerCheckText: {
    color: "#05172C",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "900",
  },
  searchPanel: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "82%",
    borderRadius: 30,
    padding: 20,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  searchTitle: { color: "#FFF", fontSize: 23, fontWeight: "900" },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#FFF", fontSize: 29, lineHeight: 31 },
  searchInput: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(126,205,255,0.35)",
    backgroundColor: "rgba(1,9,24,0.7)",
    color: "#FFF",
    fontSize: 16,
    paddingHorizontal: 17,
    marginBottom: 12,
  },
  searchResults: { gap: 8, paddingBottom: 4 },
  searchResult: {
    minHeight: 65,
    borderRadius: 17,
    backgroundColor: "rgba(9,30,61,0.75)",
    borderWidth: 1,
    borderColor: "rgba(116,190,242,0.18)",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchThumb: { width: 86, height: 48 },
  searchResultText: { flex: 1, color: "#FFF", fontSize: 15, fontWeight: "800" },
  searchChevron: { color: "#88DFFF", fontSize: 28 },
  folderToast: {
    position: "absolute",
    left: "50%",
    bottom: 164,
    width: 420,
    minHeight: 42,
    marginLeft: -210,
    zIndex: 80,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  folderToastText: {
    color: "#EAF8FF",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  dragGhost: {
    position: "absolute",
    zIndex: 9999,
    width: 112,
    height: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#77E2FF",
    backgroundColor: "rgba(2,14,32,0.9)",
    shadowColor: "#4FD7FF",
    shadowOpacity: 0.85,
    shadowRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scale: 1.06 }],
  },
  dragGhostImage: { width: "96%", height: "96%" },
  dragGhostFolder: {
    width: 62,
    height: 55,
    borderRadius: 13,
    backgroundColor: "rgba(74,196,244,0.18)",
    borderWidth: 1,
    borderColor: "rgba(116,222,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragGhostFolderIcon: { color: "#8BE8FF", fontSize: 28 },
  folderCreatePanel: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 28,
    padding: 20,
  },
  folderConfirmButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#087DEA",
    alignItems: "center",
    justifyContent: "center",
  },
  folderConfirmButtonText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  folderPanel: { width: "100%", maxWidth: 760, borderRadius: 30, padding: 20 },
  folderContents: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 16,
  },
  folderContentCard: {
    flex: 1,
    minWidth: 0,
    height: 150,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(121,207,255,0.28)",
    backgroundColor: "rgba(4,20,44,0.72)",
    overflow: "hidden",
  },
  folderContentEmpty: {
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  folderContentOpen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  folderContentImage: { width: "100%", height: 102 },
  folderContentLabel: {
    color: "#F2FAFF",
    fontSize: 11,
    fontWeight: "900",
    maxWidth: "95%",
  },
  folderReleaseButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 27,
    height: 27,
    zIndex: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(124,216,255,0.4)",
    backgroundColor: "rgba(1,11,27,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  folderReleaseButtonText: {
    color: "#8AE4FF",
    fontSize: 15,
    fontWeight: "900",
  },
  folderDissolveButton: {
    alignSelf: "flex-end",
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,121,145,0.38)",
    backgroundColor: "rgba(126,20,45,0.2)",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  folderDissolveText: { color: "#FFB8C5", fontSize: 12, fontWeight: "900" },
  locationPanel: {
    width: "100%",
    maxWidth: 690,
    maxHeight: "78%",
    borderRadius: 30,
    padding: 20,
  },
  locationSubtitle: { color: "#AFC7DF", fontSize: 13, marginTop: 4 },
  autoLocationButton: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(106,205,255,0.34)",
    backgroundColor: "rgba(8,35,69,0.72)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 13,
  },
  autoLocationIcon: { color: "#76DAFF", fontSize: 29 },
  autoLocationCopy: { flex: 1 },
  autoLocationTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  autoLocationDetail: {
    color: "#AFC7DF",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  locationSearchRow: { flexDirection: "row", alignItems: "stretch", gap: 9 },
  locationInput: { flex: 1, marginBottom: 0 },
  locationSearchButton: {
    minWidth: 96,
    borderRadius: 17,
    backgroundColor: "#0B79E8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  locationSearchButtonText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  locationResult: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(114,196,247,0.2)",
    backgroundColor: "rgba(8,29,58,0.68)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: "center",
  },
  locationResultTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  locationResultDetail: { color: "#AFC7DF", fontSize: 12, marginTop: 3 },
  settingsPanel: {
    width: "100%",
    maxWidth: 1180,
    maxHeight: "90%",
    borderRadius: 32,
    padding: 20,
    overflow: "hidden",
  },
  settingsHeading: { flex: 1 },
  settingsEyebrow: {
    color: "#77DFFF",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  settingsCurrent: {
    minHeight: 164,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(121,207,255,0.26)",
    backgroundColor: "rgba(4,20,44,0.72)",
    padding: 10,
    flexDirection: "row",
    gap: 16,
    marginBottom: 15,
  },
  settingsCurrentImage: {
    width: 270,
    minHeight: 142,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  settingsCurrentImageRadius: { borderRadius: 16 },
  settingsCurrentShade: {
    padding: 12,
    paddingTop: 32,
    backgroundColor: "rgba(1,10,25,0.38)",
  },
  settingsCurrentBadge: {
    alignSelf: "flex-start",
    color: "#06162A",
    fontSize: 9,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 1.2,
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: "#75E5FF",
    marginBottom: 5,
  },
  settingsCurrentTitle: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  settingsCurrentCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  settingsSectionTitle: { color: "#FFF", fontSize: 19, fontWeight: "900" },
  settingsDescription: {
    color: "#B8D0E8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 620,
  },
  settingsReset: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120,210,255,0.34)",
    backgroundColor: "rgba(13,50,86,0.72)",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  settingsResetText: { color: "#DDF7FF", fontSize: 11, fontWeight: "900" },
  backgroundScroll: { flexGrow: 0, maxHeight: 430 },
  backgroundGallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 8,
  },
  backgroundOption: {
    width: "23.8%",
    minWidth: 190,
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(121,198,247,0.2)",
    backgroundColor: "rgba(4,20,44,0.7)",
    padding: 6,
    overflow: "hidden",
  },
  backgroundOptionSelected: {
    borderColor: "#70DEFF",
    backgroundColor: "rgba(17,73,111,0.88)",
    shadowColor: "#4FD7FF",
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  backgroundThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 13,
    backgroundColor: "#07162B",
  },
  backgroundOptionFooter: {
    minHeight: 34,
    paddingHorizontal: 5,
    paddingTop: 7,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backgroundOptionLabel: {
    flex: 1,
    minWidth: 0,
    color: "#F2FAFF",
    fontSize: 11,
    fontWeight: "800",
  },
  backgroundCheck: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(129,208,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundCheckSelected: {
    backgroundColor: "#68DFFF",
    borderColor: "#A7EEFF",
  },
  backgroundCheckText: {
    color: "#05172C",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
  },
  profilePanel: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 30,
    padding: 20,
    overflow: "hidden",
  },
  profilePanelHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  profilePanelIdentity: { flex: 1, minWidth: 0 },
  profilePanelName: {
    color: "#FFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  profilePanelRole: {
    color: "#9DDFFF",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  profilePanelDivider: {
    height: 1,
    backgroundColor: "rgba(138,211,255,0.22)",
    marginVertical: 14,
  },
  profilePanelRow: {
    minHeight: 68,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(122,202,255,0.2)",
    backgroundColor: "rgba(6,27,57,0.72)",
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profilePanelRowTitle: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  profilePanelRowDetail: {
    color: "#AAC4DE",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  profilePanelRowArrow: { color: "#8CE5FF", fontSize: 27, fontWeight: "300" },
  profileLogout: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,120,143,0.5)",
    backgroundColor: "rgba(145,25,48,0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  profileLogoutIcon: { color: "#FFB4C1", fontSize: 20, fontWeight: "900" },
  profileLogoutText: { color: "#FFDCE2", fontSize: 14, fontWeight: "900" },
});
