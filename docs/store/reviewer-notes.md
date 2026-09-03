# Google Play – Reviewer Notes 0.3.2

**App:** CareSuite HealthOS

**Paket-ID:** `app.caresuitehealthos`

**Edition:** Portal-only

**Stand:** 2026-09-02

## App-Zugriff

CareSuite HealthOS ist eine geschlossene B2B-Portal-App. Konten werden durch einen Pflegedienst oder Versorgungsträger bereitgestellt. Es gibt in dieser Store-Edition keine öffentliche Registrierung und keine Business-/Office-/Admin-Oberfläche.

Vor Einreichung müssen in der Play Console funktionierende, nicht ablaufende Reviewer-Zugangsdaten hinterlegt werden:

| Rolle | Zugang | Review-Zweck |
|---|---|---|
| Mitarbeitendenportal | `[REVIEW-EMAIL]` / `[REVIEW-PASSWORT]` | Einsatzliste, Mobilität, Fahrt, Dokumentation, Medien, Signatur |
| Klient:innenportal | `[REVIEW-CODE]` | Dokumente und nachzuholende Unterschrift |

## Empfohlener Review-Ablauf

1. App starten und „Mitarbeitende“ wählen.
2. Mit dem bereitgestellten Review-Konto anmelden.
3. Einen freigegebenen Demo-Einsatz öffnen.
4. Mobilität wählen. Bei PKW wird das Fahrtenbuch aktiviert; andere Mobilitätsarten bleiben ohne PKW-Fahrtenbuch nutzbar.
5. „Fahrt starten“ wählen und die Standorterklärung sowie Android-Berechtigungen bestätigen.
6. Die dauerhafte Android-Mitteilung zur aktiven GPS-Aufzeichnung prüfen.
7. Dokumentation öffnen und ein Demo-Foto, -Video oder Dokument hinzufügen.
8. Einsatzabschluss mit direkter Demo-Unterschrift prüfen oder „Unterschrift im Klient:innenportal nachholen“ verwenden.
9. Fahrt/Tag vollständig beenden; danach darf keine dienstliche Hintergrundaufzeichnung weiterlaufen.
10. Mit dem Klient:innen-Review-Code anmelden und die bereitgestellte offene Unterschrift prüfen.

## Warum Hintergrundstandort benötigt wird

Ein Mitarbeitender kann einen dienstlichen Einsatztag mit Anfahrt, mehreren Zwischenfahrten zu Klient:innen oder Terminen sowie Heim-/Weiterfahrt durchführen. Diese Route muss für Fahrtenbuch und Leistungsnachweis auch bei gesperrtem Display vollständig bleiben. Die Aufzeichnung ist nutzerinitiiert, zeigt eine laufende Systemmitteilung und endet, sobald kein aktiver Fahrt-/Einsatzkontext mehr besteht.

## Medienberechtigungen

Kamera, Galerie, Dateien und Mikrofon werden nur beim Aufruf der jeweiligen Dokumentationsfunktion angefragt. Eine verweigerte Berechtigung führt zu einer verständlichen Hilfestellung; alternative Datei-/Galerieauswahl bleibt, soweit technisch verfügbar, möglich.

## Push-Mitteilungen

Die Systemabfrage erscheint erst nach einer bewussten Nutzeraktion. Push-Mitteilungen informieren über dienstliche Einsatzänderungen und Mitteilungen. Auf dem Sperrbildschirm wird nur ein neutraler Hinweis angezeigt; geschützte Inhalte erscheinen erst nach Öffnen und Entsperren der App.

## Datenschutz und Support

- Datenschutz: https://caresuiteplus.de/datenschutz
- Hilfe: https://caresuiteplus.de/hilfe
- Review-Kontakt: support@caresuiteplus.de
