# Journal Modul (A++ Webtool)

**Dateien hinzugefügt**: `journal.css`, `journal.js` und Journal-Block in `index.html` (Section mit id `ajs-journal-section`).

## Einbaupunkte
- In `index.html` wurden minimal folgende Tags ergänzt:
  - `<link rel="stylesheet" href="./journal.css">` im `<head>`
  - `<script src="./journal.js"></script>` direkt vor `</body>`
  - Unter **Handelssignal** wurde ein Button **„Zum Journal hinzufügen“** mit id `ajsJournalAddBtn` eingefügt (standardmäßig disabled).
  - Am Ende des Hauptinhalts wurde eine **Journal**-Section eingefügt (Tabelle, Filter, Statistiken, CSV).
- Keine bestehende Logik/Styles überschrieben.

## Hook
Sobald deine App ein Signal generiert, setze:
```js
window.LAST_SIGNAL = { date, market, side, orderType, entry, sl, tps:[tp1,tp2?,tp3?], crv, tp1Prob };
document.getElementById('ajsJournalAddBtn')?.removeAttribute('disabled');
```
Danach kann der Nutzer über den Button **„Zum Journal hinzufügen“** den Eintrag anlegen (Frage nach `contracts` & `note`).

## Datenhaltung
- Speicherung im `localStorage` (`ajsJournalV1`) pro Browser/Nutzer.
- Felder pro Eintrag: `date, market, side, orderType, entry, sl, tps[], crv, tp1Prob, contracts, status (OPEN|TP1|TP2|TP3|SL|MANUAL), pnlTicks, pnlUSD, note`.

## Tick-Logik
- Tick-Schritt: ES/MES/NQ/MNQ = 0.25; Krypto = 0.01.
- Tickwerte: ES=12.5, MES=1.25, NQ=5, MNQ=0.5, Krypto=1 (Platzhalter).

## Tests
Falls kein Hook sichtbar ist, kannst du auf einer separaten Test-Seite (nicht produktiv) `window.LAST_SIGNAL` manuell setzen, um den Button zu aktivieren.
