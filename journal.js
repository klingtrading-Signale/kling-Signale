
// ajs- Journal Module (localStorage only)
(function(){
  const LS_KEY = "ajsJournalV1";
  const $ = (id)=>document.getElementById(id);

  const TICK_STEP = {
    ES:0.25, MES:0.25, NQ:0.25, MNQ:0.25,
    BTC:0.01, DOGE:0.01, SOL:0.01, SHIB:0.01, XRP:0.01
  };
  const TICK_VALUE = { ES:12.5, MES:1.25, NQ:5, MNQ:0.5, BTC:1, DOGE:1, SOL:1, SHIB:1, XRP:1 };

  function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||"[]"); }catch(e){ return [];} }
  function save(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  function fmtNum(n){ return (n===null||n===undefined||Number.isNaN(n))?"":String(n); }
  function toTicks(market, priceDiff){
    const step = TICK_STEP[market] || 0.01;
    return Math.round(priceDiff / step);
  }
  function pnlUSD(market, ticks, contracts){
    const tv = TICK_VALUE[market] || 1;
    return ticks * tv * (contracts||1);
  }

  function computePnL(entry, exit, side, market, contracts){
    if(entry===null || exit===null) return {ticks:null, usd:null};
    const diff = (side==="long") ? (exit - entry) : (entry - exit);
    const ticks = toTicks(market, diff);
    const usd = pnlUSD(market, ticks, contracts);
    return {ticks, usd};
  }

  function render(){
    const rows = load();
    const fM = $("ajs-filter-market")?.value || "ALL";
    const fS = $("ajs-filter-status")?.value || "ALL";

    const tbody = $("ajs-journal-table").querySelector("tbody");
    tbody.innerHTML = "";

    const filtered = rows.filter(r => (fM==="ALL"||r.market===fM) && (fS==="ALL"||r.status===fS));

    filtered.forEach((r, idx)=>{
      const tr = document.createElement("tr");
      const tpsStr = (r.tps||[]).filter(x=>x!==null && x!==undefined && x!=="").join(", ");
      tr.innerHTML = `
        <td>${fmtNum(r.date)}</td>
        <td>${fmtNum(r.market)}</td>
        <td>${fmtNum(r.side)}</td>
        <td>${fmtNum(r.orderType)}</td>
        <td>${fmtNum(r.entry)}</td>
        <td>${fmtNum(r.sl)}</td>
        <td>${tpsStr}</td>
        <td>${fmtNum(r.crv)}</td>
        <td>${fmtNum(r.tp1Prob)}</td>
        <td>${fmtNum(r.contracts)}</td>
        <td><span class="ajs-pill">${fmtNum(r.status)}</span></td>
        <td>${fmtNum(r.pnlTicks)}</td>
        <td>${fmtNum(r.pnlUSD)}</td>
        <td>${(r.note||"")}</td>
        <td class="ajs-actions">
          <button data-act="TP1" data-i="${idx}">TP1</button>
          <button data-act="TP2" data-i="${idx}">TP2</button>
          <button data-act="TP3" data-i="${idx}">TP3</button>
          <button data-act="SL" data-i="${idx}">SL</button>
          <button data-act="MANUAL" data-i="${idx}">Manuell</button>
          <button data-act="DEL" data-i="${idx}">Löschen</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderStats(rows);
  }

  function renderStats(allRows){
    const closedStatuses = new Set(["TP1","TP2","TP3","SL","MANUAL"]);
    const closed = allRows.filter(r=>closedStatuses.has(r.status));
    const wins = closed.filter(r => ["TP1","TP2","TP3"].includes(r.status));
    const sumTicks = closed.reduce((a,b)=>a + (Number(b.pnlTicks)||0), 0);
    const sumUSD = closed.reduce((a,b)=>a + (Number(b.pnlUSD)||0), 0);

    const statsEl = $("ajs-stats");
    const hitRate = closed.length ? Math.round((wins.length/closed.length)*100) : 0;
    const text = [
      `Trefferquote: ${hitRate}%`,
      `Summe Ticks: ${sumTicks}`,
      `Summe USD: ${sumUSD.toFixed(2)}`,
      `Anzahl Trades: ${allRows.length}`,
      `Anzahl geschlossen: ${closed.length}`
    ].join(" · ");
    statsEl.textContent = text;
  }

  function updateStatus(index, newStatus){
    const data = load();
    const r = data[index];
    if(!r) return;

    let exitPrice = null;
    if(newStatus==="TP1"||newStatus==="TP2"||newStatus==="TP3"){
      const tpIdx = ({TP1:0,TP2:1,TP3:2})[newStatus];
      exitPrice = (r.tps && r.tps[tpIdx] != null) ? Number(r.tps[tpIdx]) : null;
      if(exitPrice==null){
        const manual = prompt(`${newStatus}: Kein TP gespeichert. Exit-Preis eingeben:`);
        exitPrice = manual ? Number(manual) : null;
      }
    } else if(newStatus==="SL"){
      exitPrice = Number(r.sl);
    } else if(newStatus==="MANUAL"){
      const manual = prompt("Manueller Exit: Exit-Preis eingeben:");
      exitPrice = manual ? Number(manual) : null;
    }

    const {ticks, usd} = computePnL(Number(r.entry), exitPrice, r.side, r.market, Number(r.contracts||1));
    r.status = newStatus;
    r.pnlTicks = (ticks!=null)?ticks:null;
    r.pnlUSD = (usd!=null)?Number(usd.toFixed(2)):null;

    save(data);
    render();
  }

  function removeRow(index){
    const data = load();
    data.splice(index,1);
    save(data);
    render();
  }

  function addFromLastSignal(){
    if(!window.LAST_SIGNAL){
      alert("Kein Signal gefunden. Generiere zuerst ein Handelssignal.");
      return;
    }
    const contractsStr = prompt("Kontrakte (Anzahl, Zahl):", "1");
    const contracts = contractsStr ? Number(contractsStr) : 1;
    const note = prompt("Notiz (optional):", "") || "";

    const s = window.LAST_SIGNAL;
    const entry = Number(s.entry);
    const sl = Number(s.sl);
    const tps = Array.isArray(s.tps) ? s.tps.filter(x=>x!=null).map(Number) : [];

    const row = {
      date: s.date || new Date().toISOString().slice(0,10),
      market: s.market,
      side: s.side,
      orderType: s.orderType,
      entry, sl, tps,
      crv: Number(s.crv),
      tp1Prob: Number(s.tp1Prob),
      contracts: Number(contracts),
      status: "OPEN",
      pnlTicks: null,
      pnlUSD: null,
      note
    };
    const data = load();
    data.unshift(row);
    save(data);
    render();
  }

  function toCSV(rows){
    const headers = ["date","market","side","orderType","entry","sl","tps","crv","tp1Prob","contracts","status","pnlTicks","pnlUSD","note"];
    const lines = [headers.join(",")];
    rows.forEach(r=>{
      const tps = (r.tps||[]).join("|");
      const vals = [
        r.date, r.market, r.side, r.orderType, r.entry, r.sl, tps, r.crv, r.tp1Prob, r.contracts, r.status, r.pnlTicks, r.pnlUSD, JSON.stringify(r.note||"")
      ];
      lines.push(vals.map(v => (v===undefined||v===null)?"":String(v)).join(","));
    });
    return lines.join("\n");
  }

  function wireEvents(){
    const table = $("ajs-journal-table");
    table.addEventListener("click", (e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const act = btn.getAttribute("data-act");
      const i = Number(btn.getAttribute("data-i"));
      if(act==="DEL"){ removeRow(i); return; }
      updateStatus(i, act);
    });

    $("ajs-filter-market").addEventListener("change", render);
    $("ajs-filter-status").addEventListener("change", render);

    $("ajs-export-csv").addEventListener("click", ()=>{
      const rows = load();
      const csv = toCSV(rows);
      const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "journal.csv";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });

    $("ajs-clear-journal").addEventListener("click", ()=>{
      if(confirm("Journal wirklich leeren? (Nur lokal in diesem Browser)")){
        save([]); render();
      }
    });

    const addBtn = $("ajsJournalAddBtn");
    if(addBtn){
      addBtn.addEventListener("click", addFromLastSignal);
      // Enable button once LAST_SIGNAL appears
      const enableIfSignal = ()=>{
        if(window.LAST_SIGNAL){ addBtn.removeAttribute("disabled"); }
      };
      enableIfSignal();
      const origDef = Object.getOwnPropertyDescriptor(window, "LAST_SIGNAL");
      try{
        Object.defineProperty(window, "LAST_SIGNAL", {
          set(v){ if(origDef && origDef.set) origDef.set(v); else this.___LAST_SIGNAL=v; addBtn.removeAttribute("disabled"); },
          get(){ return (origDef && origDef.get)? origDef.get() : this.___LAST_SIGNAL; }
        });
      }catch(e){
        // fallback: poll
        setInterval(enableIfSignal, 1000);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    wireEvents();
    render();
  });
})();
