# CareSuite Health OS Startintro — Fassung 1.3

Quelle ist die neu bereitgestellte `CareSuite-Intro-Vorschau (1).html`.
Die zugleich hochgeladene ZIP war bytegleich mit der vorherigen Fassung 1.2
(sechs Sekunden) und wurde deshalb nicht als Austauschquelle verwendet.

Die HTML-Vorschau enthält die vollständige deterministische Canvas-Szene,
den Originalroboter, den achtsekündigen Stereo-Ton und alle sechs Formate.
Szene und WAV-Ton wurden unverändert extrahiert und mit 60 fps als H.264/AAC
exportiert. Die Audio-Kodierung verwendet 256 kbit/s, Stereo und 48 kHz.
Die Schrift ist Nimbus Sans, wie im mitgelieferten ursprünglichen Renderer
und als lokale Arial-Ersatzschrift. Die Animation und ihr Timing wurden
nicht umgestaltet. Der Lichtbogen verläuft jetzt vor und hinter dem Roboter.

| Format | Auflösung | Datei |
| --- | --- | --- |
| phone-portrait | 1080 × 1920 | caresuite-start-portrait.mp4 |
| phone-landscape | 1920 × 1080 | caresuite-start-landscape.mp4 |
| tablet43-portrait | 1536 × 2048 | caresuite-start-tablet43-portrait.mp4 |
| tablet43-landscape | 2048 × 1536 | caresuite-start-tablet43-landscape.mp4 |
| tablet1610-portrait | 1200 × 1920 | caresuite-start-tablet1610-portrait.mp4 |
| tablet1610-landscape | 1920 × 1200 | caresuite-start-tablet1610-landscape.mp4 |

Alle Clips dauern genau acht Sekunden. Beide alten Sechs-Sekunden-Videos
wurden ersetzt. Die App wählt das zum Fenster passende Seitenverhältnis;
alle sechs Videos sind statisch eingebunden und vollständig offline verfügbar.
Drehen während der Wiedergabe passt die Darstellung an, ohne neu zu starten.

`manifest.json` enthält die SHA-256-Prüfsummen der neuen Videos sowie der
HTML-Quelle, der extrahierten Szene und des Original-WAV-Tons. Der Android-
Exportaudit prüft alle sechs verpackten Videos dagegen. Die vollständige
aktuelle HTML-Quelle liegt zusätzlich im Gesamtpaket unter `intro-quelle/`.
