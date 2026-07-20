# CareSuite HealthOS — verbindliches UI-Design-Konzept V33

Status: verbindlicher Systemstandard  
Geltungsbereich: alle Produkte, Module, Portale, Rollen, Seiten, Dialoge und Endgeräte

## 1. Ein System, keine Varianten

CareSuite HealthOS besitzt genau eine visuelle Identität: **System Liquid Glass**.
Es gibt weder ein helles Alternativdesign noch Modulfarben, Portal-Skins oder auswählbare
Themes. Historische Bezeichnungen wie `Aurora`, `CareLight`, `Galaxy` oder
`LightLiquidGlass` dürfen intern aus Kompatibilitätsgründen bestehen bleiben, müssen aber
immer auf die zentralen System-Tokens zeigen.

Diese Regel gilt ohne Ausnahme für:

- Zentrale, Office, Assist, Pflege, Stationär, Beratung und Akademie
- Plattform, Administration, Einstellungen, Authentifizierung und Onboarding
- Klient:innen-, Mitarbeitenden- und Angehörigenportal
- Desktop, Tablet, Smartphone, Web und native App
- Listen, Details, Dashboards, Formulare, Modale, PDF-Vorschauen und Systemzustände

## 2. Verbindliche Farbwelt

Es existieren genau drei Markenfarben:

| Token | Wert | Verwendung |
|---|---:|---|
| Deep Navy | `#061126` | Grundfläche, Tiefe, Navigation |
| Electric Blue | `#1478FF` | Primäre Aktionen, Fokus, aktive Zustände, Datenakzent |
| Clear White | `#F8FBFF` | Text, Symbole, Lichtkante |

Transparenzen sowie hellere oder dunklere Abstufungen dieser drei Farben sind zulässig.
Rot, Gelb und Grün sind ausschließlich semantischen Datenzuständen wie Fehler,
Warnung und Erfolg vorbehalten. Sie dürfen niemals Modul- oder Dekorationsfarben sein.

## 3. Flächen und Tiefe

- Der Seitenhintergrund ist tiefes Navy mit einer ruhigen, blauen Lichtatmosphäre.
- Inhalte liegen auf halbtransparenten Glasschichten mit Blur, feiner weißer Kontur und
  einem dezenten inneren Lichtreflex.
- Karten verwenden eine klare Hierarchie aus Seite, Panel, Karte und interaktivem Element.
- Schatten bleiben weich und dunkel; Glow wird nur für Fokus, aktive Navigation und
  primäre Aktionen eingesetzt.
- Inhalte müssen trotz Transparenz mindestens WCAG-AA-Kontrast erreichen.
- Dekoration darf niemals Lesbarkeit, Auswahl oder Bedienbarkeit beeinträchtigen.

## 4. Raster und Responsive Verhalten

- Desktop: feste Navigation, flexibler Inhaltsbereich, optionaler Kontextbereich.
- Tablet: Navigation wird verdichtet; Karten wechseln kontrolliert von zwei Spalten in
  eine priorisierte Hauptspalte.
- Smartphone: Inhalte werden fachlich neu priorisiert und vertikal angeordnet. Wichtige
  Aktionen bleiben sticky erreichbar; Tabellen werden zu lesbaren Datenkarten.
- Kein Layout darf lediglich verkleinert oder horizontal abgeschnitten werden.
- Einheitliche Abstände: 4/8/12/16/24/32/48 Pixel. Keine zufälligen Einzelwerte.
- Rundungen: 12 Pixel für Controls, 16 Pixel für Karten, 22–28 Pixel für große Panels.

## 5. Navigation

- Icons führen, Texte erklären. Beides bleibt eindeutig und barrierefrei beschriftet.
- Aktive Einträge verwenden Electric Blue, eine klare Kontrastkante und einen sanften Glow.
- Alle Module verwenden dieselbe Navigation, denselben aktiven Zustand und dieselbe Farbe.
- Doppelte Navigationsziele, tote Einträge und parallel sichtbare Navigationssysteme sind
  unzulässig.
- Auf Mobilgeräten bleibt die primäre Navigation mit maximal fünf Zielen erreichbar;
  weitere Ziele liegen in einer strukturierten Navigationsebene.

## 6. Typografie

- Sachliche Systemschrift mit klarer Gewichtung und hoher x-Höhe.
- Seitentitel 28–32 px, Abschnittstitel 20–24 px, Kartentitel 16–18 px, Fließtext 14–16 px.
- Primärtext ist klares Weiß, Sekundärtext 74 %, Metadaten 52 % Deckkraft.
- Fachbegriffe, Zahlen, Status und Einheiten werden systemweit gleich geschrieben.
- Text darf nicht durch Glow, Verlauf oder transparente Hintergründe an Kontrast verlieren.

## 7. Komponenten

### Buttons

- Primär: Electric Blue, weißer Text, leichte Leuchtwirkung.
- Sekundär: transparente Glasfläche mit sichtbarer Kontur.
- Destruktiv: semantisches Rot nur bei tatsächlich destruktiver Aktion.
- Hover, Fokus, Aktiv und Deaktiviert müssen eindeutig unterscheidbar sein.
- Mindestens 44 × 44 px Touch-Ziel.

### Formulare

- Strukturierte Auswahl vor Freitext. Freitext bleibt Notizen, Begründungen und Nachrichten
  vorbehalten.
- Labels bleiben dauerhaft sichtbar; Placeholder ersetzt kein Label.
- Fokus: Electric-Blue-Kontur plus dezenter Glow.
- Fehler erscheinen am Feld und in verständlicher Sprache; Eingaben bleiben erhalten.
- Datum, Betrag, Einheit und Status verwenden kontrollierte Systemkomponenten.

### Tabellen und Listen

- Kopf, Zeilen, Auswahl, Hover und Aktionen folgen denselben System-Tokens.
- Zeilenaktionen sind sichtbar oder eindeutig über ein Aktionsmenü erreichbar.
- Auf kleinen Displays werden Tabellen in semantische Datenkarten überführt.
- Sortierung, Filter und Suche besitzen einen sichtbaren aktiven Zustand.

### Modale und Panels

- Zentrierte oder kontextgebundene Glasschicht vor dunklem Blur-Scrim.
- Titel, Schließen, Inhalt und Aktionen folgen immer derselben Reihenfolge.
- Fokus bleibt im Dialog; Escape/Zurück schließt nur, wenn kein Datenverlust entsteht.
- Keine Vollbild-Weißflächen und keine abweichenden Verlaufs-Header.

### Diagramme und Status

- Electric Blue ist der primäre Datenakzent; Weiß und Navy erzeugen Abstufungen.
- Semantische Farben werden ausschließlich für fachliche Zustände verwendet.
- Jeder Wert besitzt eine Textalternative; Farbe allein transportiert keine Bedeutung.

## 8. Systemzustände

Jede Datenansicht besitzt konsistente Zustände für Laden, leer, Fehler, eingeschränkte
Berechtigung und Erfolg. Eine leere weiße Seite ist niemals ein zulässiger Zustand.
Fehlerzustände nennen Ursache, Auswirkung und eine funktionierende nächste Aktion.

## 9. Bewegung und Leistung

- Bewegung unterstützt Orientierung und Feedback, niemals Dekoration allein.
- Standarddauer 140–220 ms; Panels maximal 320 ms.
- `prefers-reduced-motion` deaktiviert nicht notwendige Animationen.
- Blur und Glow werden auf schwächeren Geräten reduziert, nicht durch ein anderes Design ersetzt.

## 10. Barrierefreiheit

- WCAG 2.2 AA ist Mindeststandard.
- Vollständige Tastaturbedienung, sichtbarer Fokus, sinnvolle Fokusreihenfolge.
- Screenreader-Namen für Icons und reine Symbolaktionen.
- 200 % Textvergrößerung ohne Informations- oder Funktionsverlust.
- Keine Zustandsinformation ausschließlich über Farbe, Position oder Animation.

## 11. Technische Durchsetzung

- Farben und Effekte kommen ausschließlich aus `systemLiquidGlass.ts` und semantischen Tokens.
- Gemeinsame Shells, Karten, Buttons, Eingaben, Tabellen und Modale sind Pflicht.
- Neue hart codierte Markenfarben in Seiten oder Modulen sind unzulässig.
- Der Theme-Schalter wird nicht ausgeliefert. Gespeicherte Altpräferenzen werden auf das
  Systemdesign migriert.
- Pull Requests müssen den Systemdesign-Audit und die UI-Regressionstests bestehen.

## 12. Definition of Done für jede Seite

Eine Seite ist erst fertig, wenn sie:

1. die zentrale Shell und die drei Markenfarben verwendet,
2. auf Desktop, Tablet und Smartphone ohne Abschneiden funktioniert,
3. Laden, leer, Fehler und Berechtigung sichtbar behandelt,
4. per Tastatur und Screenreader bedienbar ist,
5. keine doppelte oder tote Aktion enthält,
6. bei 200 % Zoom lesbar bleibt,
7. keine eigene Modul-, Portal- oder Sonderdesignwelt einführt.

