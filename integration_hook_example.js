function demoSetSignal(){
  window.LAST_SIGNAL = {
    date: new Date().toLocaleDateString("de-DE"),
    market: "ES",
    side: "short",
    orderType: "Limit",
    entry: 6450.25,
    sl: 6456.00,
    tps: [6428.00, 6410.50],
    crv: 3.2,
    tp1Prob: 0.82
  };
  const btn = document.getElementById("ajsJournalAddBtn");
  if(btn) btn.disabled = false;
  alert("Demo-Signal gesetzt. Jetzt 'Zum Journal hinzufügen' klicken.");
}