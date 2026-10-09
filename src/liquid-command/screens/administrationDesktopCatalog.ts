import type { ImageSourcePropType } from 'react-native';
import { DESKTOP_CATEGORIES, type DesktopCategory } from '../navigation/desktopAppCatalogModel';
import type { WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
type Category = DesktopCategory;
type CenterTab = "apps" | "widgets" | "workflows" | "backgrounds";
export type WidgetDefinition = {
  id: string;
  label: string;
  description: string;
  category: Category;
  route: string;
  workspaceService?: WorkspaceService | "overview";
  images?: { small: ImageSourcePropType; medium: ImageSourcePropType; large: ImageSourcePropType };
};
export type BackgroundDefinition = { id: string; label: string; image: ImageSourcePropType
  thumbnail?: ImageSourcePropType;
};

export const BRAND = require("../../../assets/healthos/caresuite-healthos-logo.png");
export const DESKTOP_WIDGETS_STORAGE_KEY = "caresuite.healthos.desktop-widgets.v3";
export const PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY = "caresuite.healthos.desktop-widgets.v2";
export const LEGACY_FAVORITES_STORAGE_KEY = "caresuite.healthos.top-widgets.v1";
export const SIDEBAR_STORAGE_KEY = "caresuite.healthos.sidebar-open.v2";
export const BACKGROUND_STORAGE_KEY = "caresuite.healthos.desktop-background.v1";
export const DESKTOP_SLOT_COUNT = 12;

export const BACKGROUNDS: readonly BackgroundDefinition[] = [
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

export const WIDGETS: readonly WidgetDefinition[] = [
  { id: "google-workspace", label: "Google Workspace", description: "Verbindung, freigegebene Dienste und Ihr Google-Arbeitsplatz", category: "Workspace", route: "/business/connect/google-workspace", workspaceService: "overview" },
  { id: "google-gmail", label: "Gmail", description: "Aktuelle E-Mails aus dem verbundenen Google-Postfach", category: "Workspace", route: "/business/connect/google-workspace?service=gmail", workspaceService: "gmail" },
  { id: "google-calendar", label: "Google-Kalender", description: "Kommende Termine und Videokonferenzen", category: "Workspace", route: "/business/connect/google-workspace?service=calendar", workspaceService: "calendar" },
  { id: "google-drive", label: "Google Drive", description: "Zuletzt bearbeitete Dateien und Dokumente", category: "Workspace", route: "/business/connect/google-workspace?service=drive", workspaceService: "drive" },
  { id: "google-tasks", label: "Google Tasks", description: "Offene Aufgaben aus Ihrer Google-Standardliste", category: "Workspace", route: "/business/connect/google-workspace?service=tasks", workspaceService: "tasks" },
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

export const DEFAULT_DESKTOP_IDS = [
  "clients", "messages", "live", "proofs",
  "office", "people", "calendar", "assignments",
  "salary", "logbook", "documents", "billing",
] as const;
export const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));
export const CATEGORIES = DESKTOP_CATEGORIES;
export const WORKFLOWS = [
  { id: "client", glyph: "＋", label: "Klient:in aufnehmen", text: "Stammdaten, Einwilligungen und Versorgung in einem geführten Ablauf", route: "/business/office/clients/new" },
  { id: "assignment", glyph: "↗", label: "Einsatz planen", text: "Bedarf, Personal und Termin strukturiert zusammenführen", route: "/assist/kalender" },
  { id: "proof", glyph: "✓", label: "Nachweise prüfen", text: "Offene Leistungsnachweise priorisiert kontrollieren", route: "/assist/nachweise" },
] as const;
