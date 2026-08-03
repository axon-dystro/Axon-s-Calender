# Changelog

## 1.1.0 – 2026-08-03 · erste öffentliche Ausgabe

### Neu

- öffentlicher Modulname **Axon´s Calender**
- Primär- und Sekundärfarbe des vollständigen Glasdesigns im Kalender-Designer einstellbar
- Live-Vorschau der ausgewählten Designfarben
- neutraler Erststart ohne Illidor-Namen oder Illidor-Mond
- Illidor bleibt als freiwillig auswählbares Preset erhalten
- Feedback-, Support- und Unterstützen-Buttons führen zu Axons Portfolio

### Datensicherheit

- bestehende gespeicherte Kalender werden beim Update nicht verändert
- eine ältere Dev-Welt, die nur das damalige Illidor-Standardpreset verwendet hat, wird vor dem Wechsel des Installationsstandards automatisch gesichert
- technische Modul-ID bleibt zur Datenkompatibilität `illidor-calendar`

## 1.0.1 – 2026-08-03

### Neu

- Spieler können Notizen wahlweise privat speichern oder mit allen Spielern teilen
- geteilte Spielernotizen bleiben ihrem Ersteller zugeordnet und können vom GM moderiert werden
- Sichtbarkeitswechsel zwischen privat und geteilt ohne doppelten oder verlorenen Eintrag

### Verbessert

- Kristall-Uhr kann ausgeklappt am Griff und eingeklappt direkt am Kristall frei positioniert werden
- kein automatisches Einrasten an Bildschirmkanten mehr
- die visuelle Bildschirmmitte der Uhr bleibt beim Ein- und Ausklappen erhalten
- Tagesphase, Uhrzeit und Datum sind im HUD sauber zentriert; die Datumszeile wird nicht mehr unten abgeschnitten

## 1.0.0 – 2026-08-03

### Neu

- Umbenennung zu **Axons Kalender** bei migrationssicherer technischer Modul-ID
- vollständig generischer Kalenderkern statt fest verdrahteter Illidor-Werte
- visueller GM-Designer für Kalendername, Zeitrechnung und aktuellen Zeitpunkt
- frei konfigurierbare Wochentage und drei Arten des Wochenresets
- frei konfigurierbare Jahreszeiten, Monate, Monatslängen und Sondertage
- frei konfigurierbare Uhr mit eigenen Stunden und Minuten
- frei konfigurierbare Tagesphasen mit Startzeit, Symbol, Farbe und Dunkelheit
- mehrere konfigurierbare Monde mit Zyklus und Versatz
- Illidor als eingebautes Preset sowie neutrales Start-Preset
- Monats-, Jahres- und Agendaansicht
- neu gestaltete, gläserne Kristall-Oberfläche ohne Bild- oder Fremdassets
- verschiebbare, einklappbare und an Bildschirmkanten einrastende Kristall-Uhr
- dynamische GM-Zeitsteuerung für beliebig viele Tagesphasen
- Minuten-, Stunden-, Tages- und Rückwärtssteuerung
- optionale Foundry-Weltzeit-Synchronisierung
- optionale Szenenhelligkeit nach Tagesphase
- JSON-Import und -Export ohne Ereignisse oder private Daten
- automatische Migration von Version 0.1
- reduzierte Animationen und modulare Funktionsschalter

### Bewusst später

- Klima, Wetterzonen und automatische Wettereffekte

## 0.1.0 – 2026-07-28

- erster Illidor-spezifischer Prototyp für Foundry VTT 14
