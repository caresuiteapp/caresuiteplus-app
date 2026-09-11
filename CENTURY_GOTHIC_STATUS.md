# Century Gothic – Arbeitsstand 11.09.2026

Die Oberflächen verwendeten Systemschriften und einzelne feste Schriftzuweisungen. Der Auftrag verlangt Century Gothic in der gesamten Software.

## Umgesetzt
- Gemeinsame Schriftdefinition für Web/Desktop, Typografievarianten und neue HTML-Dokumente.
- Globale Regel für HTML und React Native Web, einschließlich ungestylter Texte, Formulare und Portals.
- Start-/Ladetexte, Kartenhinweise, Dokumentvorschauen, Platzhalter und bisherige Monospace-Anzeigen im Web verwenden dieselbe Definition.
- Symbolschriften behalten ihre eigene Font-Familie.
- Größen, Schriftvergrößerung und Gewichtungen bleiben erhalten.

## Geprüft
- 76 bestehende Tests in sechs betroffenen Suites bestanden.
- Chromium meldet CenturyGothic, CenturyGothic-Bold und CenturyGothic-Italic für die geprüften Textknoten; Feather bleibt Feather.
- Browser-Fixture mit echten RN-Web Text-/Input-Komponenten, Typografietokens, Expo Feather und WorkflowFeedbackOverlay: 1920, 1366, 768 und 390 Pixel sowie 390 Pixel bei 150 % Schriftgröße.
- Screenshots von breiter/schmaler Darstellung, vergrößerter Schrift, Ladefenster und HTML-Dokumentvorschau visuell geprüft.
- Kein horizontaler Seitenüberlauf in diesen Prüfansichten; keine JavaScript-Fehler.
- Web-Export erfolgreich. Die UI-Fixture ersetzt keine Prüfung sämtlicher angemeldeter Fachseiten.

## Für die vollständige Umstellung noch erforderlich
Century Gothic ist auf dem geprüften Windows-Rechner installiert. Im Projekt fehlen lizenzierte Web-/App-Schriftdateien. Die CSS-Schriftliste nutzt derzeit die lokale Installation; ohne diese wird Sans-Serif verwendet.

Benötigt werden Webfonts (WOFF2) sowie App-/PDF-Schriften (TTF), mit passenden Nutzungsrechten und den Schnitten Regular, Bold, Italic und Bold Italic. Danach folgen Einbettung, native Registrierung, die direkt mit jsPDF erzeugten Rechnungs-/Fahrtenbuch-PDFs und die Prüfung ohne lokale Schriftinstallation.

Individuelle Dokument-CI-Einstellungen und bereits finalisierte Dokumente werden nicht durch eine Datenmigration verändert. Kein Produktionsdeployment für diese Änderung erfolgt.

Die Windows-Installation allein erlaubt keine Weiterverteilung als Web-/App-Font: https://learn.microsoft.com/en-us/typography/fonts/font-faq
