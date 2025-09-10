Minimal-Patch: Risiko-Engine & Auto-Micro-Toggle

Geändert:
- index.html
  * Neues Feld: Checkbox <input id="autoMicroToggle"> unter den Risikoparametern
  * Label-Fix: "Vortagestief (VTL)" -> "Vortagestief (VTT)"
- logic.js
  * Ticks für Risiko konservativ mit Math.ceil()
  * Wenn Risiko pro Kontrakt > Max-Risiko:
     - bei ES/NQ Micro-Alternative (MES/MNQ) prüfen
     - Wenn Checkbox Auto Micro aktiv -> Ausgabe-Markt auf Micro umstellen
     - Sonst: Signal deaktivieren (active=false) und Empfehlung in res.notes
  * Hinweise (res.notes) werden in den Copy-Text angehängt.

Keine Strategie-Logik verändert (computeSignalFutures/Crypto bleibt unverändert).
