# CareSuite Health OS Startintro

Unveränderte Videos mit Ton aus dem vom Auftraggeber bereitgestellten
`CareSuite-Intro-v1-Komplettpaket(1).zip`, enthaltene Fassung laut README: 1.2.
Die separat bereitgestellte Hochformat-MP4 ist bytegleich mit der Paketfassung.

| Datei | Format | Dauer | Ton | SHA-256 |
| --- | --- | --- | --- | --- |
| caresuite-start-portrait.mp4 | 1080 × 1920, H.264, 60 fps | 6 Sekunden | AAC, 48 kHz, Stereo | b48361a59c798bed6be4970cf37fd5ef62bde94604ba28af3cb2de44a0b25c7e |
| caresuite-start-landscape.mp4 | 1920 × 1080, H.264, 60 fps | 6 Sekunden | AAC, 48 kHz, Stereo | d4703d90c721faf92ded9a3823608210b56457a100dcdabed7f9ce0e68773f42 |

Die nativen App-Einstiege binden beide Dateien über statische `require`-Aufrufe
ein. Sie werden mit der App ausgeliefert; beim Start ist kein Download nötig.
Das Exportaudit prüft die tatsächlich verpackten Dateien bytegenau gegen
diese Quelldateien. Die Videos benötigen keine Mikrofonberechtigung.
