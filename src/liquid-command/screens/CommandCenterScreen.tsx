import { useEffect, useMemo, useRef, useState } from "react";
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
  Text as NativeText,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type TextProps,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { PortalTextSizeControls } from "@/components/portal/accessibility/PortalTextSizeControls";
import { TopbarProfileAvatar } from "@/components/layout/TopbarProfileAvatar";
import { useWebFontScale } from "@/design/web/WebFontScaleProvider";

type Category = "Übersicht" | "Versorgung" | "Team" | "Verwaltung";
type CenterTab = "apps" | "widgets" | "workflows" | "backgrounds";
type WidgetDefinition = {
  id: string;
  label: string;
  description: string;
  category: Category;
  route: string;
  images: { small: ImageSourcePropType; medium: ImageSourcePropType; large: ImageSourcePropType };
};
type BackgroundDefinition = { id: string; label: string; image: ImageSourcePropType 
  thumbnail?: ImageSourcePropType;
};

const BRAND = require("../../../assets/healthos/caresuite-healthos-logo.png");
const DESKTOP_WIDGETS_STORAGE_KEY = "caresuite.healthos.desktop-widgets.v3";
const PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY = "caresuite.healthos.desktop-widgets.v2";
const LEGACY_FAVORITES_STORAGE_KEY = "caresuite.healthos.top-widgets.v1";
const SIDEBAR_STORAGE_KEY = "caresuite.healthos.sidebar-open.v2";
const BACKGROUND_STORAGE_KEY = "caresuite.healthos.desktop-background.v1";
const DESKTOP_SLOT_COUNT = 12;
const DESKTOP_COLUMN_COUNT = 4;
const NATIVE_MOTION = Platform.OS !== "web";

const BACKGROUNDS: readonly BackgroundDefinition[] = [
  { id: "alien-planet", label: "Alien Planet", image: require("../../../assets/healthos/caresuite-alien-planet-no-logo.png") },
  { id: "silberblueten", label: "Silberblüten", image: require("../../../assets/healthos/backgrounds/01-silberblueten-morgen.png") },
  { id: "kristallterrassen", label: "Kristallterrassen", image: require("../../../assets/healthos/backgrounds/02-kristallterrassen.png") },
  { id: "kristallkueste", label: "Kristallküste", image: require("../../../assets/healthos/backgrounds/03-kristallkueste.png") },
  { id: "pilzwald", label: "Pilzwald", image: require("../../../assets/healthos/backgrounds/04-pilzwald.png") },
  { id: "galaxiespiegel", label: "Galaxiespiegel", image: require("../../../assets/healthos/backgrounds/05-galaxiespiegel.png") },
  { id: "kristallhoehle", label: "Kristallhöhle", image: require("../../../assets/healthos/backgrounds/06-kristallhoehle.png") },
  { id: "ozeanfaelle", label: "Ozeanfälle", image: require("../../../assets/healthos/backgrounds/07-ozeanfaelle.png") },
  { id: "wolkenplateau", label: "Wolkenplateau", image: require("../../../assets/healthos/backgrounds/08-wolkenplateau.png") },
  { id: "steinboegen", label: "Steinbögen", image: require("../../../assets/healthos/backgrounds/09-steinboegen.png") },
  { id: "vulkanwelt", label: "Vulkanwelt", image: require("../../../assets/healthos/backgrounds/10-vulkanwelt.png") },
  { id: "ringplanet", label: "Ringplanet", image: require("../../../assets/healthos/backgrounds/11-ringplanet-duenen.png") },
  { id: "kristallboegen", label: "Kristallbögen", image: require("../../../assets/healthos/backgrounds/12-kristallboegen.png") },
  { id: "schwebende-inseln", label: "Schwebende Inseln", image: require("../../../assets/healthos/backgrounds/13-schwebende-inseln.png") },
  { id: "nachtwald", label: "Nachtwald", image: require("../../../assets/healthos/backgrounds/14-nachtwald.png") },
  { id: "eislicht", label: "Eislicht", image: require("../../../assets/healthos/backgrounds/15-eislicht.png") },
  {
    id: "premium-alpengold-spiegelsee",
    label: "Alpengold am Spiegelsee",
    image: require("../../../assets/healthos/backgrounds/premium-2026/01-alpengold-spiegelsee.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/01-alpengold-spiegelsee.jpg"),
  },
  {
    id: "premium-nordischer-fjord",
    label: "Nordischer Fjord",
    image: require("../../../assets/healthos/backgrounds/premium-2026/02-nordischer-fjord.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/02-nordischer-fjord.jpg"),
  },
  {
    id: "premium-alabasterduenen",
    label: "Alabasterdünen",
    image: require("../../../assets/healthos/backgrounds/premium-2026/03-alabasterduenen.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/03-alabasterduenen.jpg"),
  },
  {
    id: "premium-perlmuttwellen",
    label: "Perlmuttwellen",
    image: require("../../../assets/healthos/backgrounds/premium-2026/04-perlmuttwellen.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/04-perlmuttwellen.jpg"),
  },
  {
    id: "premium-schwarze-kueste",
    label: "Schwarze Küste",
    image: require("../../../assets/healthos/backgrounds/premium-2026/05-schwarze-kueste.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/05-schwarze-kueste.jpg"),
  },
  {
    id: "premium-rotfelsenschlucht",
    label: "Rotfelsenschlucht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/06-rotfelsenschlucht.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/06-rotfelsenschlucht.jpg"),
  },
  {
    id: "premium-winterwald",
    label: "Winterwald am See",
    image: require("../../../assets/healthos/backgrounds/premium-2026/07-winterwald.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/07-winterwald.jpg"),
  },
  {
    id: "premium-smaragdtal",
    label: "Smaragdtal mit Wasserfällen",
    image: require("../../../assets/healthos/backgrounds/premium-2026/08-smaragdtal-wasserfaelle.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/08-smaragdtal-wasserfaelle.jpg"),
  },
  {
    id: "premium-aquamarin-kueste",
    label: "Aquamarin-Küste",
    image: require("../../../assets/healthos/backgrounds/premium-2026/09-aquamarin-kueste.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/09-aquamarin-kueste.jpg"),
  },
  {
    id: "premium-marmor-kupfer-petrol",
    label: "Marmor · Kupfer · Petrol",
    image: require("../../../assets/healthos/backgrounds/premium-2026/10-marmor-kupfer-petrol.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/10-marmor-kupfer-petrol.jpg"),
  },
  {
    id: "premium-patagonien",
    label: "Patagonien im Morgenlicht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/11-patagonien-morgen.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/11-patagonien-morgen.jpg"),
  },
  {
    id: "premium-toskana-nebel",
    label: "Toskana im Morgennebel",
    image: require("../../../assets/healthos/backgrounds/premium-2026/12-toskana-nebel.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/12-toskana-nebel.jpg"),
  },
  {
    id: "premium-island-gletscherlagune",
    label: "Isländische Gletscherlagune",
    image: require("../../../assets/healthos/backgrounds/premium-2026/13-island-gletscherlagune.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/13-island-gletscherlagune.jpg"),
  },
  {
    id: "premium-japanischer-herbstwald",
    label: "Japanischer Herbstwald",
    image: require("../../../assets/healthos/backgrounds/premium-2026/14-japanischer-herbstwald.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/14-japanischer-herbstwald.jpg"),
  },
  {
    id: "premium-lavendelhuegel",
    label: "Lavendelhügel",
    image: require("../../../assets/healthos/backgrounds/premium-2026/15-lavendelhuegel.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/15-lavendelhuegel.jpg"),
  },
  {
    id: "premium-namib-duenen",
    label: "Namib-Dünen",
    image: require("../../../assets/healthos/backgrounds/premium-2026/16-namib-duenen.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/16-namib-duenen.jpg"),
  },
  {
    id: "premium-dolomiten-sturmlicht",
    label: "Dolomiten im Sturmlicht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/17-dolomiten-sturmlicht.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/17-dolomiten-sturmlicht.jpg"),
  },
  {
    id: "premium-schottisches-hochland",
    label: "Schottisches Hochland",
    image: require("../../../assets/healthos/backgrounds/premium-2026/18-schottisches-hochland.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/18-schottisches-hochland.jpg"),
  },
  {
    id: "premium-korallenriff",
    label: "Korallenriff im Sonnenlicht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/19-korallenriff.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/19-korallenriff.jpg"),
  },
  {
    id: "premium-regenwald",
    label: "Regenwald im Morgennebel",
    image: require("../../../assets/healthos/backgrounds/premium-2026/20-regenwald.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/20-regenwald.jpg"),
  },
  {
    id: "premium-gletscher-tuerkissee",
    label: "Gletscher am Türkissee",
    image: require("../../../assets/healthos/backgrounds/premium-2026/21-gletscher-tuerkissee.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/21-gletscher-tuerkissee.jpg"),
  },
  {
    id: "premium-kanadischer-herbstsee",
    label: "Kanadischer Herbstsee",
    image: require("../../../assets/healthos/backgrounds/premium-2026/22-kanadischer-herbstsee.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/22-kanadischer-herbstsee.jpg"),
  },
  {
    id: "premium-goldene-savanne",
    label: "Goldene Savanne",
    image: require("../../../assets/healthos/backgrounds/premium-2026/23-goldene-savanne.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/23-goldene-savanne.jpg"),
  },
  {
    id: "premium-praerie-gewitterlicht",
    label: "Prärie im Gewitterlicht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/24-praerie-gewitterlicht.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/24-praerie-gewitterlicht.jpg"),
  },
  {
    id: "premium-verborgene-cenote",
    label: "Verborgene Cenote",
    image: require("../../../assets/healthos/backgrounds/premium-2026/25-verborgene-cenote.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/25-verborgene-cenote.jpg"),
  },
  {
    id: "premium-kalksteinschlucht",
    label: "Weiße Kalksteinschlucht",
    image: require("../../../assets/healthos/backgrounds/premium-2026/26-kalksteinschlucht.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/26-kalksteinschlucht.jpg"),
  },
  {
    id: "premium-schwarzer-marmor",
    label: "Schwarzer Marmor",
    image: require("../../../assets/healthos/backgrounds/premium-2026/27-schwarzer-marmor.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/27-schwarzer-marmor.jpg"),
  },
  {
    id: "premium-papier-nebelhuegel",
    label: "Nebelhügel auf Papier",
    image: require("../../../assets/healthos/backgrounds/premium-2026/28-papier-nebelhuegel.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/28-papier-nebelhuegel.jpg"),
  },
  {
    id: "premium-kohle-rost",
    label: "Kohle und Rost",
    image: require("../../../assets/healthos/backgrounds/premium-2026/29-kohle-rost.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/29-kohle-rost.jpg"),
  },
  {
    id: "premium-achat-quarz",
    label: "Achat und Quarz",
    image: require("../../../assets/healthos/backgrounds/premium-2026/30-achat-quarz.png"),
    thumbnail: require("../../../assets/healthos/backgrounds/premium-2026-thumbs/30-achat-quarz.jpg"),
  },
] as const;

const WIDGETS: readonly WidgetDefinition[] = [
  { id: "company", label: "Unternehmen", description: "Steuerung, Kennzahlen und Unternehmensübersicht", category: "Übersicht", route: "/business/office/dashboard", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/01-unternehmen.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/01-unternehmen.png"),
    large: require("../../../assets/healthos/widgets-premium/large/01-unternehmen.png") } },
  { id: "clients", label: "Klient:innen", description: "Stammdaten, Versorgung und Kontakte im Blick", category: "Versorgung", route: "/business/office/clients", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/02-klientinnen.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/02-klientinnen.png"),
    large: require("../../../assets/healthos/widgets-premium/large/02-klientinnen.png") } },
  { id: "people", label: "Personal", description: "Teams, Rollen und Mitarbeitende verwalten", category: "Team", route: "/business/office/employees", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/03-personal.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/03-personal.png"),
    large: require("../../../assets/healthos/widgets-premium/large/03-personal.png") } },
  { id: "logbook", label: "Fahrtenbuch", description: "Fahrten, Kilometer, Fahrzeuge und Nachweise zentral verwalten", category: "Team", route: "/business/office/fahrtenbuch", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/22-fahrtenbuch.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/22-fahrtenbuch.png"),
    large: require("../../../assets/healthos/widgets-premium/large/22-fahrtenbuch.png") } },
  { id: "time", label: "Arbeitszeit", description: "Zeiten, Konten und Freigaben zentral steuern", category: "Team", route: "/business/office/time-tracking", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/04-arbeitszeit.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/04-arbeitszeit.png"),
    large: require("../../../assets/healthos/widgets-premium/large/04-arbeitszeit.png") } },
  { id: "salary", label: "Gehaltsstatistik", description: "Lohnentwicklung und Personalaufwand analysieren", category: "Team", route: "/business/office/payroll", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/05-gehaltsstatistik.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/05-gehaltsstatistik.png"),
    large: require("../../../assets/healthos/widgets-premium/large/05-gehaltsstatistik.png") } },
  { id: "billing", label: "Rechnungen", description: "Abrechnung, Forderungen und Zahlstatus bearbeiten", category: "Verwaltung", route: "/business/office/invoices", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/06-rechnungen.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/06-rechnungen.png"),
    large: require("../../../assets/healthos/widgets-premium/large/06-rechnungen.png") } },
  { id: "documents", label: "Dokumente", description: "Dokumente sicher ablegen, finden und teilen", category: "Verwaltung", route: "/business/office/documents", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/07-dokumente.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/07-dokumente.png"),
    large: require("../../../assets/healthos/widgets-premium/large/07-dokumente.png") } },
  { id: "messages", label: "Nachrichten", description: "Sichere Kommunikation mit Team und Beteiligten", category: "Team", route: "/business/messages", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/08-nachrichten.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/08-nachrichten.png"),
    large: require("../../../assets/healthos/widgets-premium/large/08-nachrichten.png") } },
  { id: "access", label: "Portale & Zugänge", description: "Zugänge, Einladungen und Portalrollen verwalten", category: "Verwaltung", route: "/business/office/portals", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/09-portale-zugaenge.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/09-portale-zugaenge.png"),
    large: require("../../../assets/healthos/widgets-premium/large/09-portale-zugaenge.png") } },
  { id: "inventory", label: "Inventar", description: "Bestände, Hilfsmittel und Geräte organisieren", category: "Verwaltung", route: "/business/office/inventory", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/10-inventar.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/10-inventar.png"),
    large: require("../../../assets/healthos/widgets-premium/large/10-inventar.png") } },
  { id: "audit", label: "Audit", description: "Prüfpfade, Änderungen und Qualität nachvollziehen", category: "Verwaltung", route: "/business/office/audit-log", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/11-audit.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/11-audit.png"),
    large: require("../../../assets/healthos/widgets-premium/large/11-audit.png") } },
  { id: "assignments", label: "Einsätze", description: "Laufende und kommende Einsätze sicher koordinieren", category: "Versorgung", route: "/assist/einsaetze", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/12-einsaetze.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/12-einsaetze.png"),
    large: require("../../../assets/healthos/widgets-premium/large/12-einsaetze.png") } },
  { id: "calendar", label: "Kalender & Einsatzplanung", description: "Kapazitäten, Termine und Dienste gemeinsam planen", category: "Versorgung", route: "/assist/kalender", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/13-kalender-einsatzplanung.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/13-kalender-einsatzplanung.png"),
    large: require("../../../assets/healthos/widgets-premium/large/13-kalender-einsatzplanung.png") } },
  { id: "live", label: "Live-Status", description: "Versorgungslage und Außendienst live verfolgen", category: "Versorgung", route: "/assist/live-status", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/14-live-status.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/14-live-status.png"),
    large: require("../../../assets/healthos/widgets-premium/large/14-live-status.png") } },
  { id: "proofs", label: "Nachweise", description: "Dokumentation und Leistungsnachweise prüfen", category: "Versorgung", route: "/assist/nachweise", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/15-nachweise.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/15-nachweise.png"),
    large: require("../../../assets/healthos/widgets-premium/large/15-nachweise.png") } },
  { id: "budgets", label: "Budgets", description: "Abrechnungsquellen und Budgets im Blick behalten", category: "Versorgung", route: "/assist/abrechnungsquellen", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/16-budgets.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/16-budgets.png"),
    large: require("../../../assets/healthos/widgets-premium/large/16-budgets.png") } },
  { id: "portals", label: "Portale", description: "Versorgungsportale und Beteiligte verbinden", category: "Verwaltung", route: "/assist/portale", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/17-portale.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/17-portale.png"),
    large: require("../../../assets/healthos/widgets-premium/large/17-portale.png") } },
  { id: "command", label: "Command Center", description: "Operative Steuerung und Lageübersicht öffnen", category: "Übersicht", route: "/command-center", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/18-command-center.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/18-command-center.png"),
    large: require("../../../assets/healthos/widgets-premium/large/18-command-center.png") } },
  { id: "office", label: "Office", description: "Zentrale Verwaltung und Stammdaten öffnen", category: "Übersicht", route: "/office", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/19-office.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/19-office.png"),
    large: require("../../../assets/healthos/widgets-premium/large/19-office.png") } },
  { id: "assist", label: "Assist", description: "Operative Versorgung und Einsatzführung öffnen", category: "Übersicht", route: "/assist", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/20-assist.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/20-assist.png"),
    large: require("../../../assets/healthos/widgets-premium/large/20-assist.png") } },
  { id: "settings", label: "Einstellungen", description: "HealthOS-Oberfläche und Konto konfigurieren", category: "Verwaltung", route: "/settings", images: {
    small: require("../../../assets/healthos/widgets-premium/compact/21-einstellungen.png"),
    medium: require("../../../assets/healthos/widgets-premium/medium/21-einstellungen.png"),
    large: require("../../../assets/healthos/widgets-premium/large/21-einstellungen.png") } },
] as const;

const DEFAULT_DESKTOP_IDS = [
  "clients", "messages", "live", "proofs",
  "office", "people", "calendar", "assignments",
  "salary", "logbook", "documents", "billing",
] as const;
const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));
const CATEGORIES = ["Alle", "Übersicht", "Versorgung", "Team", "Verwaltung"] as const;
const NAVIGATION = [
  { group: "Arbeitsplatz", items: [["Mein Desktop", "⌂", ""], ["Command Center", "◎", "command"], ["Live-Status", "●", "live"]] },
  { group: "Versorgung", items: [["Klient:innen", "◇", "clients"], ["Einsätze", "↗", "assignments"], ["Planung", "□", "calendar"], ["Nachweise", "✓", "proofs"]] },
  { group: "Organisation", items: [["Personal", "♙", "people"], ["Fahrtenbuch", "⌖", "logbook"], ["Nachrichten", "✦", "messages"], ["Rechnungen", "€", "billing"], ["Dokumente", "▤", "documents"]] },
] as const;
const WORKFLOWS = [
  { id: "client", glyph: "＋", label: "Klient:in aufnehmen", text: "Stammdaten, Einwilligungen und Versorgung in einem geführten Ablauf", route: "/business/office/clients/new" },
  { id: "assignment", glyph: "↗", label: "Einsatz planen", text: "Bedarf, Personal und Termin strukturiert zusammenführen", route: "/assist/kalender" },
  { id: "proof", glyph: "✓", label: "Nachweise prüfen", text: "Offene Leistungsnachweise priorisiert kontrollieren", route: "/assist/nachweise" },
] as const;
const ROLE_LABELS: Record<string, string> = { business_admin: "Geschäftsführung / Admin", tenant_admin: "Mandantenadministration", platform_admin: "Plattformadministration", office_admin: "Office-Administration", admin: "Administration", employee: "Mitarbeitende:r", manager: "Leitung" };

function normalizeDesktopIds(value: unknown) {
  const valid = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && WIDGET_BY_ID.has(id)) : [];
  const ids = [...new Set(valid)].slice(0, DESKTOP_SLOT_COUNT);
  for (const id of DEFAULT_DESKTOP_IDS) if (ids.length < DESKTOP_SLOT_COUNT && !ids.includes(id)) ids.push(id);
  return ids;
}

function migrateDesktopIdsToR13(value: unknown, migrationRequired: boolean) {
  const ids = normalizeDesktopIds(value);
  if (!migrationRequired || ids.includes("logbook")) return ids;
  const replaceIndex = ids.indexOf("assist");
  if (replaceIndex >= 0) ids[replaceIndex] = "logbook";
  else if (ids.length < DESKTOP_SLOT_COUNT) ids.push("logbook");
  else ids[ids.length - 1] = "logbook";
  return ids;
}

function roleLabel(key: string | null | undefined) {
  if (!key) return "CareSuite HealthOS";
  return ROLE_LABELS[key] ?? key.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function Text({ style, ...props }: TextProps) {
  const { scale } = useWebFontScale();
  const flattened = StyleSheet.flatten(style);
  const scaled = Platform.OS === "web" && scale !== 1 ? {
    fontSize: typeof flattened?.fontSize === "number" ? flattened.fontSize * scale : undefined,
    lineHeight: typeof flattened?.lineHeight === "number" ? flattened.lineHeight * scale : undefined,
  } : null;
  return <NativeText {...props} style={[style, scaled]} />;
}

export function CommandCenterScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const narrow = width < 1240;
  const owner = auth.user?.id ?? "local";
  const desktopKey = `${DESKTOP_WIDGETS_STORAGE_KEY}.${owner}`;
  const previousDesktopKey = `${PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY}.${owner}`;
  const sidebarKey = `${SIDEBAR_STORAGE_KEY}.${owner}`;
  const backgroundKey = `${BACKGROUND_STORAGE_KEY}.${owner}`;
  const legacyKey = `${LEGACY_FAVORITES_STORAGE_KEY}.${owner}`;
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  const [desktopIds, setDesktopIds] = useState<string[]>([...DEFAULT_DESKTOP_IDS]);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<CenterTab>("apps");
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Alle");
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sidebarMotion = useRef(new Animated.Value(sidebarOpen ? 1 : 0)).current;
  const gridMorph = useRef(new Animated.Value(1)).current;
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || "Profil";
  const role = roleLabel(profile?.roleKey);
  const activeBackground = BACKGROUNDS.find((item) => item.id === backgroundId) ?? BACKGROUNDS[0];

  const filteredWidgets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return WIDGETS.filter((widget) =>
      (category === "Alle" || widget.category === category) &&
      (!needle || `${widget.label} ${widget.description} ${widget.category}`.toLocaleLowerCase("de-DE").includes(needle)),
    );
  }, [category, query]);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReducedMotion(value));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    Animated.timing(sidebarMotion, { toValue: sidebarOpen ? 1 : 0, duration: reducedMotion ? 0 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [reducedMotion, sidebarMotion, sidebarOpen]);
  useEffect(() => {
    gridMorph.setValue(reducedMotion ? 1 : 0);
    Animated.timing(gridMorph, { toValue: 1, duration: reducedMotion ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_MOTION }).start();
  }, [desktopIds, gridMorph, reducedMotion, sidebarOpen]);
  useEffect(() => {
    let active = true;
    setLoadedOwner(null);
    void Promise.all([AsyncStorage.getItem(desktopKey), AsyncStorage.getItem(previousDesktopKey), AsyncStorage.getItem(legacyKey), AsyncStorage.getItem(sidebarKey), AsyncStorage.getItem(backgroundKey)]).then(([desktop, previousDesktop, legacy, sidebar, storedBackground]) => {
      if (!active) return;
      let stored: unknown = null;
      try { stored = JSON.parse(desktop ?? previousDesktop ?? legacy ?? "null"); } catch { stored = null; }
      setDesktopIds(migrateDesktopIdsToR13(stored, !desktop && Boolean(previousDesktop)));
      if (sidebar === "true" || sidebar === "false") setSidebarOpen(sidebar === "true");
      if (storedBackground && BACKGROUNDS.some((item) => item.id === storedBackground)) setBackgroundId(storedBackground);
      setLoadedOwner(owner);
    }).catch(() => active && setLoadedOwner(owner));
    return () => { active = false; };
  }, [backgroundKey, desktopKey, legacyKey, owner, previousDesktopKey, sidebarKey]);
  useEffect(() => {
    if (loadedOwner === owner) void AsyncStorage.multiSet([[desktopKey, JSON.stringify(desktopIds)], [sidebarKey, String(sidebarOpen)], [backgroundKey, backgroundId]]);
  }, [backgroundId, backgroundKey, desktopIds, desktopKey, loadedOwner, owner, sidebarKey, sidebarOpen]);

  const openWidget = (widget: WidgetDefinition) => { setCenterOpen(false); router.push(widget.route as never); };
  const openNavWidget = (id: string) => { const widget = WIDGET_BY_ID.get(id); if (widget) openWidget(widget); };
  const togglePinned = (id: string) => setDesktopIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < DESKTOP_SLOT_COUNT ? [...current, id] : current);
  const signOut = async () => { setProfileOpen(false); await auth.signOut(); };
  const rows = Array.from({ length: 3 }, (_, row) => desktopIds.slice(row * DESKTOP_COLUMN_COUNT, row * DESKTOP_COLUMN_COUNT + DESKTOP_COLUMN_COUNT));

  return (
    <ImageBackground source={activeBackground.image} resizeMode="cover" style={styles.background}>
      <View style={styles.atmosphere} />
      <View style={[styles.topbar, compact && styles.topbarCompact]}>
        <View style={styles.brandColumn}>
          <Image accessibilityLabel="CareSuite HealthOS" source={BRAND} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} />
          {!compact ? <View style={[styles.glass, styles.infoCard]}><View><Text style={styles.time}>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={styles.date}>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)}</Text></View><View style={styles.divider} /><View style={styles.weather}><Text style={styles.weatherIcon}>☀</Text><View><Text style={styles.weatherTitle}>17° <Text style={styles.weatherState}>Klar</Text></Text><Text style={styles.weatherPlace}>⌖ Standortwetter</Text></View></View></View> : null}
        </View>
        <View style={[styles.glass, styles.actions]}>
          <Pressable accessibilityLabel={sidebarOpen ? "Navigation schließen" : "Navigation öffnen"} accessibilityState={{ expanded: sidebarOpen }} onPress={() => setSidebarOpen((value) => !value)} style={[styles.iconButton, sidebarOpen && styles.iconButtonActive]}><Text style={styles.iconGlyph}>{sidebarOpen ? "‹" : "☰"}</Text></Pressable>
          {!narrow ? <PortalTextSizeControls /> : null}
          {!compact ? <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View> : null}
          <Pressable accessibilityLabel="Apps und Widgets öffnen" onPress={() => setCenterOpen(true)} style={styles.appsButton}><Text style={styles.appsGlyph}>▦</Text>{!compact ? <Text style={styles.appsText}>Apps & Widgets</Text> : null}</Pressable>
          <Pressable accessibilityLabel={`Kontomenü von ${displayName} öffnen`} onPress={() => setProfileOpen(true)} style={styles.profileTrigger}>{!narrow ? <View style={styles.profileCopy}><Text style={styles.profileName}>{displayName}</Text><Text style={styles.profileRole}>{role}</Text></View> : null}<TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" /></Pressable>
        </View>
      </View>

      <Animated.View
        style={[
          styles.sidebarReopenHost,
          compact && styles.sidebarReopenHostCompact,
          {
            pointerEvents: sidebarOpen ? "none" : "auto",
            opacity: sidebarMotion.interpolate({ inputRange: [0, 0.28, 1], outputRange: [1, 0, 0] }),
            transform: [
              { translateX: sidebarMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
              { scale: sidebarMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
            ],
          },
        ]}
      >
        <Pressable accessibilityLabel="Navigation öffnen" accessibilityState={{ expanded: false }} onPress={() => setSidebarOpen(true)} style={({ pressed }) => [styles.glass, styles.sidebarReopen, pressed && styles.sidebarReopenPressed]}>
          <Text style={styles.sidebarReopenGlyph}>☰</Text>
          <Text style={styles.sidebarReopenLabel}>MENÜ</Text>
          <Text style={styles.sidebarReopenArrow}>›</Text>
        </Pressable>
      </Animated.View>

      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <Animated.View style={[styles.glass, styles.sidebar, { pointerEvents: sidebarOpen ? "auto" : "none", width: sidebarMotion.interpolate({ inputRange: [0, 1], outputRange: [0, narrow ? 238 : 278] }), opacity: sidebarMotion, transform: [{ translateX: sidebarMotion.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] }) }] }]}>
          <View style={styles.sidebarInner}>
            <View style={styles.sidebarHeader}><View><Text style={styles.eyebrow}>CARESUITE HEALTHOS</Text><Text style={styles.sidebarTitle}>Navigation</Text></View><Pressable accessibilityLabel="Navigation schließen" onPress={() => setSidebarOpen(false)} style={styles.closeSmall}><Text style={styles.closeSmallText}>‹</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.navScroll} showsVerticalScrollIndicator={false}>
              {NAVIGATION.map((group) => <View key={group.group} style={styles.navGroup}><Text style={styles.navGroupTitle}>{group.group}</Text>{group.items.map(([label, glyph, id]) => <Pressable key={label} onPress={() => id && openNavWidget(id)} style={[styles.navItem, !id && styles.navItemActive]}><View style={styles.navIcon}><Text style={styles.navGlyph}>{glyph}</Text></View><Text style={styles.navLabel}>{label}</Text><Text style={styles.navArrow}>›</Text></Pressable>)}</View>)}
            </ScrollView>
            <Pressable onPress={() => setCenterOpen(true)} style={styles.sidebarCenter}><Text style={styles.sidebarCenterPlus}>＋</Text><View><Text style={styles.sidebarCenterTitle}>Apps hinzufügen</Text><Text style={styles.sidebarCenterCopy}>Center öffnen</Text></View></Pressable>
            <Pressable accessibilityLabel="Desktop-Hintergrund ändern" onPress={() => { setCenterTab("backgrounds"); setCenterOpen(true); }} style={styles.sidebarBackground}><Text style={styles.sidebarBackgroundGlyph}>▧</Text><View><Text style={styles.sidebarCenterTitle}>Hintergrund ändern</Text><Text style={styles.sidebarCenterCopy}>{BACKGROUNDS.length} Designs</Text></View></Pressable>
          </View>
        </Animated.View>

        <Animated.View
          {...(Platform.OS === "web" ? ({ dataSet: { healthosWorkspaceRevision: "r11-app-center", healthosResponsiveArtworkRevision: "r9", healthosVisualDensityRevision: "r11-calm" } } as object) : {})}
          style={[styles.glass, styles.desktopPanel, { opacity: gridMorph, transform: [{ translateY: gridMorph.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: gridMorph.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }]}
        >
          <View style={styles.topLine} />
          <View style={styles.desktopHeader}><View style={styles.desktopHeading}><Text style={styles.eyebrow}>PERSÖNLICHER ARBEITSPLATZ</Text><Text style={styles.desktopTitle}>Mein Desktop</Text><Text numberOfLines={1} style={styles.desktopSubtitle}>Die wichtigsten Bereiche – ruhig, klar und direkt erreichbar</Text></View><View style={styles.desktopActions}><View style={styles.countPill}><View style={styles.liveDot} /><Text style={styles.countText}>{desktopIds.length}/{DESKTOP_SLOT_COUNT} aktiv</Text></View><Pressable accessibilityState={{ selected: editMode }} onPress={() => setEditMode((value) => !value)} style={[styles.editButton, editMode && styles.editButtonActive]}><Text style={styles.editText}>{editMode ? "✓  Fertig" : "✎  Bearbeiten"}</Text></Pressable></View></View>
          <View style={styles.grid}>
            {rows.map((row, rowIndex) => <View key={rowIndex} style={styles.gridRow}>{Array.from({ length: 4 }, (_, column) => { const widget = WIDGET_BY_ID.get(row[column] ?? ""); return <View key={column} style={styles.cell}>{widget ? <Pressable accessibilityLabel={`${widget.label} öffnen`} onPress={() => !editMode && openWidget(widget)} style={({ pressed }) => [styles.widgetCard, pressed && !editMode && styles.widgetPressed, editMode && styles.widgetEditing]}><View style={styles.imageStage}><Image source={widget.images.medium} resizeMode="contain" style={styles.widgetImage} /><View style={styles.categoryPill}><Text style={styles.categoryText}>{widget.category}</Text></View>{editMode ? <Pressable accessibilityLabel={`${widget.label} entfernen`} onPress={(event) => { event.stopPropagation(); togglePinned(widget.id); }} style={styles.removeButton}><Text style={styles.removeText}>×</Text></Pressable> : null}</View><View style={styles.labelBar}><Text numberOfLines={1} style={styles.widgetLabel}>{widget.label}</Text><Text style={styles.arrow}>↗</Text></View></Pressable> : <Pressable accessibilityLabel="App oder Widget hinzufügen" onPress={() => setCenterOpen(true)} style={styles.emptyCard}><Text style={styles.emptyPlus}>＋</Text><Text style={styles.emptyTitle}>Hinzufügen</Text><Text style={styles.emptyCopy}>App oder Widget auswählen</Text></Pressable>}</View>; })}</View>)}
          </View>
        </Animated.View>
      </View>

      <Modal transparent animationType="fade" visible={centerOpen} onRequestClose={() => setCenterOpen(false)}>
        <Pressable onPress={() => setCenterOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.centerPanel]}>
          <View style={styles.centerHeader}><View style={styles.centerHeading}><Text style={styles.eyebrow}>CARESUITE HEALTHOS CENTER</Text><Text style={styles.centerTitle}>Apps & Widgets</Text><Text style={styles.centerSubtitle}>Module entdecken, Workflows starten und den Desktop persönlich zusammenstellen.</Text></View><Pressable accessibilityLabel="Center schließen" onPress={() => setCenterOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
          <View style={styles.centerToolbar}><View style={styles.tabs}>{(["apps", "widgets", "workflows", "backgrounds"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === centerTab }} onPress={() => setCenterTab(tab)} style={[styles.tab, tab === centerTab && styles.tabActive]}><Text style={[styles.tabText, tab === centerTab && styles.tabTextActive]}>{tab === "apps" ? "Apps" : tab === "widgets" ? "Widgets" : tab === "workflows" ? "Workflows" : "Hintergründe"}</Text></Pressable>)}</View>{centerTab === "apps" || centerTab === "widgets" ? <View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text><TextInput accessibilityLabel="Apps und Widgets durchsuchen" placeholder="Suchen …" placeholderTextColor="#8FA9C2" value={query} onChangeText={setQuery} style={styles.searchInput} /></View> : null}</View>
          {centerTab === "apps" || centerTab === "widgets" ? <View style={styles.chips}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, item === category && styles.chipActive]}><Text style={[styles.chipText, item === category && styles.chipTextActive]}>{item}</Text></Pressable>)}</View> : null}
          <ScrollView style={styles.centerScroll} contentContainerStyle={styles.centerContent}>
            {centerTab === "workflows" ? <View style={styles.workflowGrid}>{WORKFLOWS.map((workflow) => <Pressable key={workflow.id} onPress={() => { setCenterOpen(false); router.push(workflow.route as never); }} style={({ pressed }) => [styles.workflowCard, pressed && styles.widgetPressed]}><View style={styles.workflowIcon}><Text style={styles.workflowGlyph}>{workflow.glyph}</Text></View><Text style={styles.workflowTitle}>{workflow.label}</Text><Text style={styles.workflowCopy}>{workflow.text}</Text><View style={styles.workflowFooter}><Text style={styles.workflowLink}>Workflow starten</Text><Text style={styles.arrow}>↗</Text></View></Pressable>)}</View> : centerTab === "backgrounds" ? <View style={styles.backgroundGrid}>{BACKGROUNDS.map((background) => { const selected = background.id === backgroundId; return <Pressable key={background.id} accessibilityLabel={`${background.label} als Desktop-Hintergrund verwenden`} accessibilityState={{ selected }} onPress={() => setBackgroundId(background.id)} style={({ pressed }) => [styles.backgroundCard, selected && styles.backgroundCardSelected, pressed && styles.widgetPressed]}><Image source={background.thumbnail ?? background.image} resizeMode="cover" style={styles.backgroundPreview} /><View style={styles.backgroundFooter}><View><Text style={styles.backgroundTitle}>{background.label}</Text><Text style={styles.backgroundCopy}>{selected ? "Aktiver Hintergrund" : "Auswählen"}</Text></View><View style={[styles.backgroundCheck, selected && styles.backgroundCheckSelected]}><Text style={styles.backgroundCheckText}>{selected ? "✓" : ""}</Text></View></View></Pressable>; })}</View> : <View style={styles.centerGrid}>{filteredWidgets.map((widget) => { const pinned = desktopIds.includes(widget.id); const full = desktopIds.length >= DESKTOP_SLOT_COUNT; return <View key={widget.id} style={styles.centerCell}><Pressable onPress={() => openWidget(widget)} style={({ pressed }) => [styles.centerCard, pressed && styles.widgetPressed]}><View style={styles.centerImageStage}><Image source={centerTab === "widgets" ? widget.images.small : widget.images.medium} resizeMode="contain" style={styles.centerImage} /><Text style={styles.centerCategory}>{widget.category}</Text></View><View style={styles.centerBody}><Text style={styles.centerCardTitle}>{widget.label}</Text><Text numberOfLines={2} style={styles.centerCardCopy}>{widget.description}</Text><View style={styles.centerFooter}><Pressable disabled={!pinned && full} onPress={(event) => { event.stopPropagation(); togglePinned(widget.id); }} style={[styles.pinButton, pinned && styles.pinActive, !pinned && full && styles.pinDisabled]}><Text style={styles.pinText}>{pinned ? "✓ Auf Desktop" : full ? "Desktop voll" : "+ Zum Desktop"}</Text></Pressable><Text style={styles.openText}>Öffnen ↗</Text></View></View></Pressable></View>; })}</View>}
          </ScrollView>
        </Pressable></Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <Pressable onPress={() => setProfileOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.profilePanel]}><View style={styles.profileHeader}><TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" /><View style={styles.profileIdentity}><Text style={styles.profilePanelName}>{displayName}</Text><Text style={styles.profilePanelRole}>{role}</Text></View><Pressable onPress={() => setProfileOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><View style={styles.profileDivider} /><Pressable onPress={() => { setProfileOpen(false); router.push("/settings/profile" as never); }} style={styles.profileRow}><View><Text style={styles.profileRowTitle}>Profil & Sicherheit</Text><Text style={styles.profileRowCopy}>Persönliche Angaben, Profilbild und Zugang</Text></View><Text style={styles.arrow}>›</Text></Pressable><View style={styles.profileDivider} /><Pressable accessibilityLabel="Sicher abmelden" onPress={() => void signOut()} style={styles.logout}><Text style={styles.logoutText}>↪  Sicher abmelden</Text></Pressable></Pressable></Pressable>
      </Modal>
    </ImageBackground>
  );
}

const glassWeb = Platform.OS === "web" ? ({ backdropFilter: "blur(26px) saturate(1.18)", boxShadow: "0 12px 26px rgba(43,184,255,0.2)" } as const) : null;
const glassNativeShadow = Platform.OS !== "web" ? ({ shadowColor: "#2BB8FF", shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } } as const) : null;
const transitionWeb = Platform.OS === "web" ? ({ transition: "transform 300ms cubic-bezier(.2,.8,.2,1), border-color 240ms ease" } as const) : null;
const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%", backgroundColor: "#03132B", overflow: "hidden" },
  atmosphere: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,10,27,0.2)" },
  glass: { backgroundColor: "rgba(2,15,35,0.76)", borderWidth: 1, borderColor: "rgba(139,211,255,0.3)", ...glassNativeShadow, ...glassWeb },
  topbar: { position: "absolute", zIndex: 20, top: 22, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 20 },
  topbarCompact: { top: 11, left: 11, right: 11, gap: 7 },
  brandColumn: { alignItems: "flex-start", gap: 8 },
  logo: { width: 430, height: 54 }, logoCompact: { width: 205, height: 34 },
  infoCard: { minWidth: 430, minHeight: 78, borderRadius: 25, paddingHorizontal: 19, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  time: { color: "#FFF", fontSize: 31, lineHeight: 34, fontWeight: "900", letterSpacing: -1.2 }, date: { color: "#D8EAFF", fontSize: 11, fontWeight: "700" },
  divider: { width: 1, height: 43, backgroundColor: "rgba(149,210,255,0.24)", marginHorizontal: 18 },
  weather: { flexDirection: "row", alignItems: "center", gap: 9 }, weatherIcon: { color: "#8FE4FF", fontSize: 27 }, weatherTitle: { color: "#FFF", fontSize: 20, fontWeight: "900" }, weatherState: { fontSize: 12 }, weatherPlace: { color: "#BCD4EC", fontSize: 10, marginTop: 2 },
  actions: { minHeight: 72, borderRadius: 24, padding: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: "rgba(146,205,255,0.25)", backgroundColor: "rgba(8,29,59,0.64)", alignItems: "center", justifyContent: "center" }, iconButtonActive: { borderColor: "rgba(102,224,255,0.72)", backgroundColor: "rgba(13,91,130,0.76)" }, iconGlyph: { color: "#FFF", fontSize: 20 },
  livePill: { height: 46, borderRadius: 15, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(70,171,255,0.42)", flexDirection: "row", alignItems: "center", gap: 7 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#58D8C1", ...(Platform.OS === "web" ? ({ boxShadow: "0 0 8px rgba(88,216,193,0.9)" } as const) : ({ shadowColor: "#58D8C1", shadowOpacity: 0.9, shadowRadius: 8 } as const)) }, liveText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  appsButton: { height: 46, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(104,222,255,0.58)", backgroundColor: "rgba(9,75,111,0.78)", flexDirection: "row", alignItems: "center", gap: 8 }, appsGlyph: { color: "#83E8FF", fontSize: 21 }, appsText: { color: "#F3FCFF", fontSize: 12, fontWeight: "900" },
  profileTrigger: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, profileCopy: { maxWidth: 180, alignItems: "flex-end" }, profileName: { color: "#FFF", fontSize: 13, fontWeight: "900" }, profileRole: { color: "#BFD8EE", fontSize: 10, marginTop: 2, fontWeight: "700" },
  workspace: { position: "absolute", zIndex: 5, top: 174, left: 28, right: 28, bottom: 24, flexDirection: "row", justifyContent: "center", gap: 16 }, workspaceCompact: { top: 72, left: 7, right: 7, bottom: 7, gap: 7 },
  sidebarReopenHost: { position: "absolute", zIndex: 24, left: 10, top: "46%" }, sidebarReopenHostCompact: { left: 4, top: "44%" },
  sidebarReopen: { width: 58, minHeight: 126, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 9, borderColor: "rgba(103,224,255,0.62)", backgroundColor: "rgba(3,28,58,0.9)", ...transitionWeb }, sidebarReopenPressed: { transform: [{ scale: 0.96 }], backgroundColor: "rgba(10,75,105,0.94)" },
  sidebarReopenGlyph: { color: "#8BE8FF", fontSize: 21, fontWeight: "900" }, sidebarReopenLabel: { color: "#F2FBFF", fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.2 }, sidebarReopenArrow: { color: "#8BE8FF", fontSize: 28, lineHeight: 28, fontWeight: "500" },
  sidebar: { height: "100%", borderRadius: 28, overflow: "hidden" }, sidebarInner: { minWidth: 220, height: "100%", padding: 15 }, sidebarHeader: { minHeight: 61, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(139,211,255,0.16)" },
  eyebrow: { color: "#72DEFF", fontSize: 8, lineHeight: 12, fontWeight: "900", letterSpacing: 1.6 }, sidebarTitle: { color: "#FFF", fontSize: 22, fontWeight: "900" }, closeSmall: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", alignItems: "center", justifyContent: "center" }, closeSmallText: { color: "#CDEFFF", fontSize: 25 },
  navScroll: { paddingTop: 13, paddingBottom: 12 }, navGroup: { marginBottom: 14 }, navGroupTitle: { color: "rgba(174,208,232,0.64)", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 8, marginBottom: 5 },
  navItem: { minHeight: 43, borderRadius: 14, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, borderWidth: 1, borderColor: "transparent" }, navItemActive: { backgroundColor: "rgba(18,101,145,0.55)", borderColor: "rgba(104,222,255,0.38)" }, navIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: "rgba(103,181,226,0.1)", alignItems: "center", justifyContent: "center" }, navGlyph: { color: "#93E7FF", fontSize: 14 }, navLabel: { flex: 1, color: "#D5E8F3", fontSize: 11, fontWeight: "800" }, navArrow: { color: "rgba(137,216,245,0.56)", fontSize: 19 },
  sidebarCenter: { minHeight: 56, borderRadius: 17, borderWidth: 1, borderColor: "rgba(100,222,255,0.38)", backgroundColor: "rgba(10,74,108,0.56)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarCenterPlus: { color: "#78E5FF", fontSize: 23 }, sidebarCenterTitle: { color: "#FFF", fontSize: 11, fontWeight: "900" }, sidebarCenterCopy: { color: "#A9CBE0", fontSize: 9 },
  sidebarBackground: { minHeight: 48, marginTop: 7, borderRadius: 16, borderWidth: 1, borderColor: "rgba(152,190,255,0.28)", backgroundColor: "rgba(26,47,91,0.62)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarBackgroundGlyph: { color: "#A8CFFF", fontSize: 21 },
  desktopPanel: { flex: 1, maxWidth: 1540, minWidth: 0, borderRadius: 30, paddingHorizontal: 17, paddingTop: 14, paddingBottom: 13, overflow: "hidden" }, topLine: { position: "absolute", top: 0, left: 54, right: 54, height: 1, backgroundColor: "rgba(204,244,255,0.62)" },
  desktopHeader: { minHeight: 74, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, paddingBottom: 9 }, desktopHeading: { flex: 1, minWidth: 0 }, desktopTitle: { color: "#F7FCFF", fontSize: 35, lineHeight: 40, fontWeight: "900", letterSpacing: -0.6 }, desktopSubtitle: { color: "rgba(210,234,248,0.76)", fontSize: 10, fontWeight: "700" }, desktopActions: { flexDirection: "row", gap: 7 }, countPill: { height: 34, borderRadius: 13, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(105,207,242,0.22)", flexDirection: "row", alignItems: "center", gap: 6 }, countText: { color: "#CEE6F3", fontSize: 9, fontWeight: "900" }, editButton: { height: 34, borderRadius: 13, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", backgroundColor: "rgba(7,36,67,0.7)", justifyContent: "center" }, editButtonActive: { borderColor: "rgba(103,230,197,0.62)", backgroundColor: "rgba(24,107,91,0.68)" }, editText: { color: "#EAF8FF", fontSize: 10, fontWeight: "900" },
  grid: { flex: 1, justifyContent: "center" }, gridRow: { flex: 1, maxHeight: 194, flexDirection: "row" }, cell: { width: "25%", minWidth: 0, padding: 5 },
  widgetCard: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: "rgba(131,203,245,0.22)", backgroundColor: "rgba(1,12,29,0.78)", overflow: "hidden", ...transitionWeb }, widgetHovered: { transform: [{ translateY: -3 }, { scale: 1.012 }], borderColor: "rgba(102,221,255,0.62)", ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 20px rgba(66,206,255,0.38)" } as const) : ({ shadowColor: "#42CEFF", shadowOpacity: 0.38, shadowRadius: 20 } as const)) }, widgetPressed: { transform: [{ scale: 0.988 }] }, widgetEditing: { borderColor: "rgba(96,225,194,0.46)", backgroundColor: "rgba(4,35,45,0.82)" },
  imageStage: { flex: 1, margin: 6, marginBottom: 3, borderRadius: 13, backgroundColor: "rgba(4,23,47,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" }, widgetImage: { width: "100%", height: "100%", opacity: 0.92 }, categoryPill: { position: "absolute", top: 7, left: 7, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "rgba(1,14,31,0.78)" }, categoryText: { color: "#B9DCEB", fontSize: 7, fontWeight: "900", textTransform: "uppercase" }, removeButton: { position: "absolute", top: 7, right: 7, width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,159,176,0.52)", backgroundColor: "rgba(91,15,33,0.9)", alignItems: "center", justifyContent: "center" }, removeText: { color: "#FFD4DC", fontSize: 20 },
  labelBar: { minHeight: 32, marginHorizontal: 6, marginBottom: 6, borderRadius: 11, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(141,220,255,0.15)", backgroundColor: "rgba(1,12,28,0.8)", flexDirection: "row", alignItems: "center", gap: 5 }, widgetLabel: { flex: 1, color: "#F3FBFF", fontSize: 10, fontWeight: "900" }, arrow: { color: "#77DFFF", fontSize: 13, fontWeight: "900" },
  emptyCard: { flex: 1, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(126,208,244,0.25)", backgroundColor: "rgba(4,23,44,0.34)", alignItems: "center", justifyContent: "center" }, emptyHovered: { borderColor: "rgba(105,226,255,0.65)", backgroundColor: "rgba(8,54,78,0.5)" }, emptyPlus: { color: "#78E4FF", fontSize: 24 }, emptyTitle: { color: "#E9F8FF", fontSize: 10, fontWeight: "900" }, emptyCopy: { color: "#91B5CA", fontSize: 8, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,5,16,0.8)", alignItems: "center", justifyContent: "center", padding: 18 }, centerPanel: { width: "100%", maxWidth: 1240, height: "86%", maxHeight: 830, borderRadius: 30, padding: 20, overflow: "hidden" }, centerHeader: { minHeight: 74, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 12 }, centerHeading: { flex: 1 }, centerTitle: { color: "#FFF", fontSize: 31, fontWeight: "900" }, centerSubtitle: { color: "#AFC9DC", fontSize: 11, marginTop: 3 }, closeButton: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: "rgba(145,211,245,0.2)", backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }, closeText: { color: "#FFF", fontSize: 27 },
  centerToolbar: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(128,205,242,0.13)", paddingVertical: 7 }, tabs: { flexDirection: "row", gap: 5 }, tab: { height: 34, borderRadius: 12, paddingHorizontal: 15, justifyContent: "center" }, tabActive: { backgroundColor: "rgba(22,117,163,0.64)", borderWidth: 1, borderColor: "rgba(98,220,255,0.42)" }, tabText: { color: "#9DBACD", fontSize: 11, fontWeight: "900" }, tabTextActive: { color: "#FFF" }, search: { width: 280, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "rgba(126,205,255,0.25)", backgroundColor: "rgba(1,11,28,0.7)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 }, searchGlyph: { color: "#80DFFF", fontSize: 17 }, searchInput: { flex: 1, height: "100%", color: "#FFF", fontSize: 11 },
  chips: { minHeight: 46, flexDirection: "row", gap: 7, paddingVertical: 8 }, chip: { height: 30, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(126,205,255,0.16)", justifyContent: "center" }, chipActive: { borderColor: "rgba(104,224,255,0.48)", backgroundColor: "rgba(14,87,123,0.72)" }, chipText: { color: "#9FBDD0", fontSize: 9, fontWeight: "900" }, chipTextActive: { color: "#FFF" }, centerScroll: { flex: 1 }, centerContent: { paddingTop: 8, paddingBottom: 4 }, centerGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }, centerCell: { width: "33.3333%", minWidth: 240, padding: 5 },
  centerCard: { minHeight: 204, borderRadius: 18, borderWidth: 1, borderColor: "rgba(126,205,255,0.18)", backgroundColor: "rgba(3,20,43,0.74)", overflow: "hidden", ...transitionWeb }, centerCardHovered: { transform: [{ translateY: -2 }], borderColor: "rgba(101,224,255,0.54)", ...(Platform.OS === "web" ? ({ boxShadow: "0 7px 16px rgba(65,206,255,0.24)" } as const) : ({ shadowColor: "#41CEFF", shadowOpacity: 0.24, shadowRadius: 16 } as const)) }, centerImageStage: { height: 103, margin: 7, marginBottom: 0, borderRadius: 13, backgroundColor: "rgba(2,15,34,0.72)", alignItems: "center", justifyContent: "center", overflow: "hidden" }, centerImage: { width: "100%", height: "100%" }, centerCategory: { position: "absolute", top: 7, left: 7, color: "#9CDDF2", fontSize: 7, fontWeight: "900", textTransform: "uppercase", backgroundColor: "rgba(1,12,29,0.82)", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9 }, centerBody: { padding: 10 }, centerCardTitle: { color: "#FFF", fontSize: 13, fontWeight: "900" }, centerCardCopy: { color: "#9CBACD", fontSize: 9, lineHeight: 13, minHeight: 26, marginTop: 3 }, centerFooter: { minHeight: 31, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pinButton: { height: 29, borderRadius: 11, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(104,218,255,0.32)", backgroundColor: "rgba(9,61,91,0.64)", justifyContent: "center" }, pinActive: { borderColor: "rgba(94,226,191,0.48)", backgroundColor: "rgba(24,107,91,0.64)" }, pinDisabled: { opacity: 0.42 }, pinText: { color: "#BEEBFA", fontSize: 8, fontWeight: "900" }, openText: { color: "#7EDFFF", fontSize: 8, fontWeight: "900" },
  workflowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, workflowCard: { width: "31.8%", minWidth: 250, minHeight: 225, borderRadius: 20, borderWidth: 1, borderColor: "rgba(126,205,255,0.2)", backgroundColor: "rgba(4,23,48,0.78)", padding: 18, ...transitionWeb }, workflowIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "rgba(67,199,237,0.14)", alignItems: "center", justifyContent: "center" }, workflowGlyph: { color: "#83E9FF", fontSize: 24 }, workflowTitle: { color: "#FFF", fontSize: 17, fontWeight: "900", marginTop: 16 }, workflowCopy: { color: "#A3C0D2", fontSize: 11, lineHeight: 17, marginTop: 6, flex: 1 }, workflowFooter: { marginTop: 17, borderTopWidth: 1, borderTopColor: "rgba(121,202,240,0.14)", paddingTop: 11, flexDirection: "row", justifyContent: "space-between" }, workflowLink: { color: "#AEEBFA", fontSize: 10, fontWeight: "900" },
  backgroundGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }, backgroundCard: { width: "25%", minWidth: 210, padding: 5, borderRadius: 19, borderWidth: 1, borderColor: "transparent", ...transitionWeb }, backgroundCardSelected: { borderColor: "rgba(104,225,255,0.7)", backgroundColor: "rgba(11,73,103,0.52)" }, backgroundPreview: { width: "100%", aspectRatio: 1.65, borderRadius: 14, backgroundColor: "rgba(2,13,30,0.8)" }, backgroundFooter: { minHeight: 52, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backgroundTitle: { color: "#F4FBFF", fontSize: 11, fontWeight: "900" }, backgroundCopy: { color: "#9DBDD0", fontSize: 8, marginTop: 2 }, backgroundCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "rgba(130,207,244,0.24)", alignItems: "center", justifyContent: "center" }, backgroundCheckSelected: { borderColor: "rgba(93,229,195,0.64)", backgroundColor: "rgba(23,111,91,0.78)" }, backgroundCheckText: { color: "#D9FFF4", fontSize: 14, fontWeight: "900" },
  profilePanel: { width: "100%", maxWidth: 520, borderRadius: 27, padding: 20 }, profileHeader: { flexDirection: "row", alignItems: "center", gap: 13 }, profileIdentity: { flex: 1 }, profilePanelName: { color: "#FFF", fontSize: 18, fontWeight: "900" }, profilePanelRole: { color: "#9DDFFF", fontSize: 11, fontWeight: "800", marginTop: 2 }, profileDivider: { height: 1, backgroundColor: "rgba(138,211,255,0.2)", marginVertical: 13 }, profileRow: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: "rgba(122,202,255,0.18)", backgroundColor: "rgba(6,27,57,0.72)", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, profileRowTitle: { color: "#FFF", fontSize: 12, fontWeight: "900" }, profileRowCopy: { color: "#AAC4DE", fontSize: 9, marginTop: 2 }, logout: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,120,143,0.46)", backgroundColor: "rgba(145,25,48,0.26)", alignItems: "center", justifyContent: "center" }, logoutText: { color: "#FFDCE2", fontSize: 12, fontWeight: "900" },
});
