// A++ Signal Generator – Client-Only Prototype
// CSV Option Chain: Strike,Type,OI,Volume  (Type = Call | Put)

const $ = (id)=>document.getElementById(id);

const TICK = {
  ES: {size:0.25, value:12.5},
  MES:{size:0.25, value:1.25},
  NQ: {size:0.25, value:5},
  MNQ:{size:0.25, value:0.5},
};

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map(h=>h.trim().toLowerCase());
  const idx = {
    strike: header.indexOf("strike"),
    type: header.indexOf("type"),
    oi: header.indexOf("oi"),
    volume: header.indexOf("volume"),
  };
  const rows = [];
  for(const ln of lines){
    const cols = ln.split(",").map(x=>x.trim());
    if(cols.length < 4) continue;
    rows.push({
      strike: parseFloat(cols[idx.strike]),
      type: (cols[idx.type]||"").toLowerCase(),
      oi: parseFloat(cols[idx.oi]),
      volume: parseFloat(cols[idx.volume])
    });
  }
  return rows;
}

let uploadedOC = null;

$("ocsv").addEventListener("change", async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const text = await f.text();
  uploadedOC = parseCSV(text);
  renderOCPreview(uploadedOC);
});

function renderOCPreview(rows){
  const el = $("ocPreview");
  if(!rows || !rows.length){ el.innerHTML = "<div class='placeholder'>Keine Daten geladen.</div>"; return; }
  const calls = rows.filter(r=>r.type==="call");
  const puts  = rows.filter(r=>r.type==="put");
  const topCallOI = [...calls].sort((a,b)=>b.oi-a.oi)[0];
  const topPutOI  = [...puts].sort((a,b)=>b.oi-a.oi)[0];
  const topCallVol= [...calls].sort((a,b)=>b.volume-a.volume)[0];
  const topPutVol = [...puts].sort((a,b)=>b.volume-a.volume)[0];
  el.innerHTML = `
    <div class="kpi"><div class="hd">Top Call OI</div><div class="val">${topCallOI?.strike ?? "-"}</div></div>
    <div class="kpi"><div class="hd">Top Put OI</div><div class="val">${topPutOI?.strike ?? "-"}</div></div>
    <div class="kpi"><div class="hd">Top Call Vol</div><div class="val">${topCallVol?.strike ?? "-"}</div></div>
    <div class="kpi"><div class="hd">Top Put Vol</div><div class="val">${topPutVol?.strike ?? "-"}</div></div>
  `;
}

// Insert example values for quick test
$("btnExample").addEventListener("click", ()=>{
  // ES example
  $("date").value = new Date().toISOString().slice(0,10);
  $("market").value = "ES";
  $("currentPrice").value = "6432.25";
  $("openType").value = "range";
  $("atr").value = "56.5";
  $("vix").value = "15.2";
  $("prevHigh").value = "6470.25";
  $("prevLow").value = "6391.25";
  $("prevVAH").value = "6446.50";
  $("prevPOC").value = "6432.00";
  $("prevVAL").value = "6394.75";
  $("todayVAH").value = "6450.00";
  $("todayPOC").value = "6435.00";
  $("todayVAL").value = "6420.00";
  $("maxPain").value = "6375";
  $("gex").value = "positiv";
  $("gammaFlip").value = "6279";
  $("accountSize").value = "2000";
  $("riskPerTrade").value = "50";
  $("minRR").value = "3";
  $("numTPs").value = "1";
});

$("btnClear").addEventListener("click", ()=>{
  document.querySelectorAll("input").forEach(i=>i.value="");
  document.querySelectorAll("select").forEach(s=>{
    if(s.id==="market") s.value="ES";
    else if(s.id==="gex") s.value="positiv";
    else if(s.id==="minRR") s.value="3";
    else if(s.id==="numTPs") s.value="1";
    else if(s.id==="openType") s.value="range";
    else s.selectedIndex=0;
  });
  uploadedOC=null; $("ocsv").value="";
  $("ocPreview").innerHTML="";
  $("signalArea").innerHTML='<div class="placeholder">Noch kein Signal erzeugt.</div>';
});

$("btnGenerate").addEventListener("click", ()=>{
  const ctx = getInputs();
  const result = generateSignal(ctx);
  renderSignal(result);
});

function getInputs(){
  const m = $("market").value;
  const numeric = id => parseFloat($(id).value);
  const ctx = {
    date: $("date").value || "",
    market: m,
    price: numeric("currentPrice"),
    openType: $("openType").value,
    atr: numeric("atr"),
    vix: numeric("vix"),
    prevHigh: numeric("prevHigh"),
    prevLow: numeric("prevLow"),
    prevVAH: numeric("prevVAH"),
    prevPOC: numeric("prevPOC"),
    prevVAL: numeric("prevVAL"),
    todayVAH: numeric("todayVAH"),
    todayPOC: numeric("todayPOC"),
    todayVAL: numeric("todayVAL"),
    maxPain: numeric("maxPain"),
    gex: $("gex").value,
    gammaFlip: numeric("gammaFlip"),
    accountSize: parseFloat($("accountSize").value),
    riskPerTrade: parseFloat($("riskPerTrade").value),
    minRR: parseFloat($("minRR").value),
    numTPs: parseInt($("numTPs").value,10),
    enforceAplusplus: $("enforceAplusplus").checked,
    optionChain: uploadedOC
  };
  return ctx;
}

// Core Strategy Logic (simplified to match chat rules)
function dayTrend(ctx){
  // Very simple heuristic:
  if(ctx.openType==="gap_up" || (ctx.price > ctx.prevVAH)) return "bullisch";
  if(ctx.openType==="gap_down" || (ctx.price < ctx.prevVAL)) return "bärisch";
  return "neutral";
}

function pickWalls(oc){
  if(!oc || !oc.length) return {};
  const calls = oc.filter(r=>r.type==="call");
  const puts  = oc.filter(r=>r.type==="put");
  const topCallOI = [...calls].sort((a,b)=>b.oi-a.oi)[0];
  const topPutOI  = [...puts].sort((a,b)=>b.oi-a.oi)[0];
  return { callWall: topCallOI?.strike, putWall: topPutOI?.strike };
}

function nearest(arr, ref){
  let best=null, d=Infinity;
  for(const v of arr.filter(x=>Number.isFinite(x))){
    const dd=Math.abs(v-ref);
    if(dd<d){d=dd; best=v;}
  }
  return best;
}

function proposeSetup(ctx){
  const trend = dayTrend(ctx);
  const walls = pickWalls(ctx.optionChain);
  const levels = {
    VAH: ctx.prevVAH,
    POC: ctx.prevPOC,
    VAL: ctx.prevVAL
  };
  const price = ctx.price;
  // Bias:
  let bias="neutral";
  if(ctx.maxPain && price > ctx.maxPain) bias = "bärisch";
  if(ctx.maxPain && price < ctx.maxPain) bias = "bullisch";
  if(ctx.gex==="positiv" && bias==="bärisch") bias="neutral"; // mean-reversion can override strength
  if(ctx.gex==="negativ" && bias==="bullisch") bias="neutral";

  // Candidate SHORT (mean-reversion near VAH + CallWall)
  const shortZone = [levels.VAH, walls.callWall, levels.POC].filter(x=>Number.isFinite(x));
  const shortEntryLevel = nearest(shortZone, price);
  const shortOk = (shortEntryLevel>=price); // for limit sell
  // Candidate LONG (mean-reversion near VAL + PutWall)
  const longZone  = [levels.VAL, walls.putWall, levels.POC].filter(x=>Number.isFinite(x));
  const longEntryLevel = nearest(longZone, price);
  const longOk = (longEntryLevel<=price); // for limit buy

  // Decide
  const cand = [];
  if(shortEntryLevel && (ctx.gex!=="negativ" ? true : trend!=="neutral")) {
    cand.push({side:"short", entry:shortEntryLevel, zone:shortZone, reason:"VAH/POC + Call-Wall Konfluenz (Mean-Reversion)"});
  }
  if(longEntryLevel && (ctx.gex!=="negativ" ? true : trend!=="neutral")) {
    cand.push({side:"long", entry:longEntryLevel, zone:longZone, reason:"VAL/POC + Put-Wall Konfluenz (Mean-Reversion)"});
  }

  // Rank by confluence distance
  cand.sort((a,b)=>Math.abs(a.entry-price)-Math.abs(b.entry-price));

  // Enforce A++ filters if needed
  function violatesAplusplus(c){
    if(!ctx.enforceAplusplus) return false;
    if(c.side==="short" && c.entry < ctx.prevHigh) return true; // short darf nicht unter VTH (Entry unter VTH => invalid)
    if(c.side==="long" && c.entry > ctx.prevLow)  return true; // long darf nicht über VTL
    const tr = trend;
    if(tr==="bullisch" && c.side==="short") return true;
    if(tr==="bärisch"  && c.side==="long")  return true;
    return false;
  }

  const selected = cand.find(c=>!violatesAplusplus(c)) || cand[0] || null;

  return {trend, walls, levels, bias, selected};
}

function computeStopsAndTargets(ctx, proposal){
  if(!proposal?.selected) return null;
  const side = proposal.selected.side;
  const entry = proposal.selected.entry;
  const atr = ctx.atr || 0;
  const VTH = ctx.prevHigh, VTL=ctx.prevLow, POC=ctx.prevPOC, VAH=ctx.prevVAH, VAL=ctx.prevVAL;

  let sl, tp1, tp2, tp3, orderType="Limit";
  // SL logic per chat (structure + ATR buffer 0.5 * ATR)
  if(side==="short"){
    sl = Math.max(VTH ?? -Infinity, entry) + 0.5*atr;
    // logical TP: first to POC then VAL
    tp1 = Math.min(POC ?? Infinity, entry);
    if(!Number.isFinite(tp1)) tp1 = VAL ?? (entry - 0.8*atr);
    tp2 = VAL ?? (entry - 1.2*atr);
    tp3 = (VAL && ctx.todayVAL) ? Math.min(VAL, ctx.todayVAL) - 0.5*atr : entry - 1.8*atr;
    if(entry < ctx.price){ orderType="Stop Sell"; } // ensure passive logic with stop if below price
  }else{
    sl = Math.min(VTL ?? Infinity, entry) - 0.5*atr;
    tp1 = Math.max(POC ?? -Infinity, entry);
    if(!Number.isFinite(tp1)) tp1 = VAH ?? (entry + 0.8*atr);
    tp2 = VAH ?? (entry + 1.2*atr);
    tp3 = (VAH && ctx.todayVAH) ? Math.max(VAH, ctx.todayVAH) + 0.5*atr : entry + 1.8*atr;
    if(entry > ctx.price){ orderType="Stop Buy"; }
  }

  // sanity: ensure ordering
  if(side==="short"){
    tp1 = Math.min(tp1, entry - 0.25); // at least one tick
  }else{
    tp1 = Math.max(tp1, entry + 0.25);
  }

  // RR calc (to TP1)
  const tick = TICK[ctx.market] || TICK.ES;
  const toTicks = (pts)=> Math.round( (pts / tick.size) );
  const riskPts = Math.abs(entry - sl);
  const rewardPts = Math.abs(tp1 - entry);
  const rr = rewardPts / (riskPts || 1e-9);
  const riskTicks = toTicks(riskPts);
  const rewardTicks = toTicks(rewardPts);
  const riskUSDperContract = riskTicks * tick.value;
  let contracts = Math.floor( (ctx.riskPerTrade||0) / (riskUSDperContract||1e-9) );
  if(contracts<0) contracts=0;

  return {
    side, entry, sl, tp1, tp2, tp3, rr, riskTicks, rewardTicks, riskUSDperContract,
    orderType
  };
}

function gradeSetup(ctx, prop, calc){
  if(!prop?.selected || !calc) return {grade:"-", lamp:"red", prob:0, note:"Kein Setup"};
  // Probability heuristic
  let prob=70;
  if(ctx.gex==="positiv") prob+=10;
  if(ctx.gex==="negativ") prob-=10;
  if(ctx.vix && ctx.vix<18) prob+=5; else if(ctx.vix>25) prob-=10;
  if(prop.bias==="bullisch" && calc.side==="long") prob+=5;
  if(prop.bias==="bärisch" && calc.side==="short") prob+=5;

  // Grade
  let grade="A";
  if(prob>=82 && calc.rr>=3) grade="A++";
  else if(prob>=75 && calc.rr>=2) grade="A+";
  else if(prob>=65) grade="A";
  else grade="B";

  // Lamp
  let lamp="yellow";
  if(grade==="A++"||grade==="A+") lamp="green";
  if(grade==="B") lamp="red";

  return {grade, lamp, prob: Math.max(35, Math.min(92, Math.round(prob))) };
}

function validateOrderLogic(ctx, calc){
  // Entry placement validity
  if(calc.side==="short"){
    if(calc.orderType==="Limit" && calc.entry < ctx.price){
      return {ok:false, msg:"Limit-Sell Entry darf nicht unter aktuellem Preis liegen. Stop-Sell empfohlen."};
    }
  }else{
    if(calc.orderType==="Limit" && calc.entry > ctx.price){
      return {ok:false, msg:"Limit-Buy Entry darf nicht über aktuellem Preis liegen. Stop-Buy empfohlen."};
    }
  }
  return {ok:true};
}

function generateSignal(ctx){
  // basic checks
  const required = ["market","price","prevHigh","prevLow","prevVAH","prevPOC","prevVAL","atr","maxPain"];
  const miss = required.filter(k=>!Number.isFinite(ctx[k]) && k!=="market");
  if(miss.length){
    return {error:`Fehlende Felder: ${miss.join(", ")}`};
  }

  const prop = proposeSetup(ctx);
  if(!prop.selected) return {none:true, reason:"Keine Konfluenz gefunden."};

  const calc = computeStopsAndTargets(ctx, prop);
  if(!calc) return {none:true, reason:"Konnte SL/TP nicht berechnen."};

  // CRV filter
  if(calc.rr < (ctx.minRR||1)){
    return {none:true, reason:`Kein logisches Setup mit gewünschtem CRV ≥ ${ctx.minRR}:1 gefunden.`};
  }

  const val = validateOrderLogic(ctx, calc);
  if(!val.ok) return {none:true, reason:val.msg};

  const grade = gradeSetup(ctx, prop, calc);

  return {ok:true, ctx, prop, calc, grade};
}

function fmt(n){ return Number.isFinite(n)? n.toFixed(2) : "-"; }

function renderSignal(res){
  const host = $("signalArea");
  if(res.error){
    host.innerHTML = `<div class="signal-box"><div class="badge red">Fehler</div><div style="margin-top:6px">${res.error}</div></div>`;
    return;
  }
  if(res.none){
    host.innerHTML = `<div class="signal-box"><div class="badge yellow">Hinweis</div><div style="margin-top:6px">${res.reason}</div></div>`;
    return;
  }
  const {ctx, prop, calc, grade} = res;
  const lampClass = grade.lamp==="green"?"green":(grade.lamp==="red"?"red":"yellow");
  const sideLabel = calc.side==="short" ? "Short (Verkauf)" : "Long (Kauf)";

  // Build TPs based on requested number
  const tps = [calc.tp1, calc.tp2, calc.tp3].filter(v=>Number.isFinite(v)).slice(0, ctx.numTPs||1);

  host.innerHTML = `
    <div class="signal-box">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div class="badge ${lampClass}">Ampel: ${grade.lamp.toUpperCase()}</div>
        <div class="badge">Bewertung: ${grade.grade}</div>
        <div class="badge">TP1-W'keit: ${grade.prob}%</div>
        <div class="badge">CRV: ${ (calc.rr).toFixed(2) }:1</div>
      </div>

      <div style="margin-top:8px" class="row">
        <div class="kpi"><div class="hd">Richtung</div><div class="val">${sideLabel}</div></div>
        <div class="kpi"><div class="hd">Order-Typ</div><div class="val">${calc.orderType}</div></div>
        <div class="kpi"><div class="hd">Tagestrend</div><div class="val">${prop.trend}</div></div>
        <div class="kpi"><div class="hd">Konfluenz</div><div class="val">${prop.selected.reason}</div></div>
      </div>

      <div class="boxes">
        <div class="box entry"><div class="hd">ENTRY</div><div class="val">${fmt(calc.entry)}</div></div>
        <div class="box sl"><div class="hd">STOP</div><div class="val">${fmt(calc.sl)}</div><div style="font-size:12px;opacity:.7">Risiko: ${calc.riskTicks} Ticks</div></div>
        <div class="box tp"><div class="hd">TP1</div><div class="val">${fmt(tps[0])}</div></div>
      </div>

      ${tps[1] ? `<div class="boxes">
        <div class="box tp"><div class="hd">TP2</div><div class="val">${fmt(tps[1])}</div></div>
        ${tps[2]?`<div class="box tp"><div class="hd">TP3</div><div class="val">${fmt(tps[2])}</div></div>`:""}
      </div>`:""}

      <div style="margin-top:8px" class="row">
        <div class="kpi"><div class="hd">Bias</div><div class="val">${prop.bias}</div></div>
        <div class="kpi"><div class="hd">Top Call-Wall</div><div class="val">${prop.walls.callWall ?? "-"}</div></div>
        <div class="kpi"><div class="hd">Top Put-Wall</div><div class="val">${prop.walls.putWall ?? "-"}</div></div>
      </div>
    </div>
  `;
}
