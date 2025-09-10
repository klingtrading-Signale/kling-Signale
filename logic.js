
// A++ Signal Generator – Logik (vereinfachte, regelbasierte Umsetzung wie im Chat)
const $ = (id)=>document.getElementById(id);
const num = (v)=> (v===""||v===null||v===undefined) ? NaN : Number(v);

function tickValueFor(market){
  if(market==="ES") return 12.5;
  if(market==="MES") return 1.25;
  if(market==="NQ") return 5;
  if(market==="MNQ") return 0.5;
  return 1;
}
function stepFor(market){
  if(market==="ES"||market==="MES") return 0.25;
  if(market==="NQ"||market==="MNQ") return 0.25;
  return 0.01;
}
function clampToTick(p, market){
  const step = stepFor(market);
  return Math.round(p/step)*step;
}

async function parsePDF(file){
  const statusEl = $("pdfStatus");
  try{
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data}).promise;
    let fullText = "";
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(it=>it.str).join(" ");
      fullText += " " + strings;
    }
    statusEl.textContent = "PDF geladen – Text extrahiert.";
    const findings = {callWalls:[], putWalls:[]};
    const tokens = fullText.replace(/,/g,"").split(/\s+/);
    for(let i=0;i<tokens.length;i++){
      const t = tokens[i];
      const n = Number(t);
      if(!isNaN(n) && n>1000 && n<100000){
        const next = tokens.slice(i, i+15).join(" ");
        if(/Call/i.test(next)){
          const m = next.match(/(Open\s*Interest|OI)\s*([0-9]{1,7})/i);
          if(m){findings.callWalls.push({strike:n, oi:Number(m[2])});}
        } else if(/Put/i.test(next)){
          const m = next.match(/(Open\s*Interest|OI)\s*([0-9]{1,7})/i);
          if(m){findings.putWalls.push({strike:n, oi:Number(m[2])});}
        }
      }
    }
    findings.callWalls.sort((a,b)=>b.oi-a.oi);
    findings.putWalls.sort((a,b)=>b.oi-a.oi);
    return findings;
  }catch(e){
    statusEl.textContent = "PDF konnte nicht gelesen werden (wird ignoriert).";
    return {callWalls:[], putWalls:[]};
  }
}

function dayTrend(openCtx, gex, price, prevHigh, prevLow){
  let bias = "neutral";
  if(openCtx==="ueberVTH") bias = "bullisch";
  if(openCtx==="unterVTH") bias = "bärisch";
  if(gex==="positiv" && bias!=="bärisch") bias = "bullisch";
  if(gex==="negativ" && bias!=="bullisch") bias = "bärisch";
  return bias;
}

function rateSetup({side, price, prevHigh, prevLow, bias, crv, strictCRV}){
  const shortAboveVTH = (side==="short" && price>prevHigh);
  const longBelowVTL = (side==="long" && price<prevLow);
  const trendAgree = ( (bias==="bullisch" && side==="long") || (bias==="bärisch" && side==="short") || (bias==="neutral") );
  if(!trendAgree) return "A-";
  if(shortAboveVTH || longBelowVTL) return "A";
  if(strictCRV && crv<Number($("rrFilter").value)) return "A";
  return "A++";
}

function computeSignalFutures(input, optionFindings){
  const {market, price, prevVAH, prevHigh, prevPOC, prevVAL, prevLow, gex, openCtx, gapType, rrMin, tpCount} = input;

  const callTop = optionFindings?.callWalls?.[0]?.strike ?? null;
  const putTop  = optionFindings?.putWalls?.[0]?.strike ?? null;

  const bias = dayTrend(openCtx, gex, price, prevHigh, prevLow);

  const nearVAH = Math.abs(price - prevVAH) <= 2.0;
  const nearVTH = Math.abs(price - prevHigh) <= 2.0;
  const nearVAL = Math.abs(price - prevVAL) <= 2.0;
  const nearVTL = Math.abs(price - prevLow) <= 2.0;

  let side = "neutral";
  let entry, sl, tp1, tp2, tp3;

  if(bias==="bullisch" && (nearVAL || nearVTL)){
    side = "long";
    entry = clampToTick(Math.min(prevVAL, prevLow) + 0.5, market);
    sl    = clampToTick(Math.min(prevVAL, prevLow) - 1.25, market);
    tp1   = clampToTick(prevPOC, market);
    tp2   = clampToTick(prevVAH, market);
    tp3   = clampToTick(prevHigh, market);
  } else if(bias==="bärisch" && (nearVAH || nearVTH)){
    side = "short";
    entry = clampToTick(Math.max(prevVAH, prevHigh) - 0.5, market);
    sl    = clampToTick(Math.max(prevVAH, prevHigh) + 1.25, market);
    tp1   = clampToTick(prevPOC, market);
    tp2   = clampToTick(prevVAL, market);
    tp3   = clampToTick(prevLow, market);
  } else {
    if(price >= prevPOC){
      side = "short";
      entry = clampToTick(prevVAH - 0.25, market);
      sl    = clampToTick(prevHigh + 1.0, market);
      tp1   = clampToTick(prevPOC, market);
      tp2   = clampToTick(prevVAL, market);
      tp3   = clampToTick(prevLow, market);
    }else{
      side = "long";
      entry = clampToTick(prevVAL + 0.25, market);
      sl    = clampToTick(prevLow - 1.0, market);
      tp1   = clampToTick(prevPOC, market);
      tp2   = clampToTick(prevVAH, market);
      tp3   = clampToTick(prevHigh, market);
    }
  }

  let orderType = "Limit";
  if(side==="short" && entry > price){ orderType = "Stop"; }
  if(side==="long" && entry < price){ orderType = "Stop"; }

  if(side==="long" && orderType==="Limit" && entry > price){
    entry = clampToTick(price - 0.25, market);
  }
  if(side==="short" && orderType==="Limit" && entry < price){
    entry = clampToTick(price + 0.25, market);
  }

  const r = Math.abs(entry - sl);
  const rrv = Math.abs(tp1 - entry) / (r || 1e-9);
  const crv = Number(rrv.toFixed(2));

  const shortAboveVTH = side==="short" && entry > prevHigh;
  const longBelowVTL  = side==="long" && entry < prevLow;

  let tp1Prob = 0.7;
  if(bias==="bullisch" && side==="long") tp1Prob = 0.82;
  if(bias==="bärisch" && side==="short") tp1Prob = 0.82;
  if(shortAboveVTH || longBelowVTL) tp1Prob -= 0.12;

  const strict = ($("crvStrict").value==="on");
  const rating = rateSetup({side, price, prevHigh, prevLow, bias, crv, strictCRV:strict});
  const passCRV = crv >= Number($("rrFilter").value);
  const ampel = (passCRV ? "🟢" : "🟡");

  const tps = [tp1, tp2, tp3].filter(Boolean).slice(0, tpCount);

  return {active: passCRV, ampel, rating, bias, side, orderType, entry, sl, tps, crv, tp1Prob: Math.max(0, Math.min(1, tp1Prob)), notes: []};
}

function computeSignalCrypto(input){
  const {market, cOpen, cHigh, cLow, cVAH, cPOC, cVAL, cATR, cPrice, rrMin, tpCount} = input;
  let bias = "neutral";
  if(cPrice > cVAH) bias = "bullisch";
  if(cPrice < cVAL) bias = "bärisch";

  let side="neutral", entry, sl, tp1, tp2, tp3;
  if(bias==="bullisch"){
    side="long";
    entry = cVAL * 1.001;
    sl    = cLow * 0.999;
    tp1   = cPOC;
    tp2   = cVAH;
    tp3   = cHigh;
  }else if(bias==="bärisch"){
    side="short";
    entry = cVAH * 0.999;
    sl    = cHigh * 1.001;
    tp1   = cPOC;
    tp2   = cVAL;
    tp3   = cLow;
  }else{
    if(cPrice >= cPOC){
      side="short";
      entry = cVAH * 0.999;
      sl    = cHigh * 1.001;
      tp1   = cPOC;
      tp2   = cVAL;
      tp3   = cLow;
    }else{
      side="long";
      entry = cVAL * 1.001;
      sl    = cLow * 0.999;
      tp1   = cPOC;
      tp2   = cVAH;
      tp3   = cHigh;
    }
  }
  const r = Math.abs(entry - sl);
  const crv = Math.abs(tp1 - entry) / (r || 1e-9);
  let tp1Prob = 0.75;
  if(bias==="neutral") tp1Prob = 0.68;
  const passCRV = crv >= Number($("rrFilter").value);
  const ampel = passCRV ? "🟢" : "🟡";
  const tps = [tp1, tp2, tp3].filter(Boolean).slice(0, tpCount);
  return {active: passCRV, ampel, rating: passCRV?"A++":"A", bias, side, orderType:"Limit", entry, sl, tps, crv:Number(crv.toFixed(2)), tp1Prob, notes:[]};
}

function positionSizing(market, entry, sl, riskPerTrade, preference){
  const tickVal = tickValueFor(market);
  const step = stepFor(market);
  const ticks = Math.max(1, Math.ceil(Math.abs(entry - sl)/step));
  const riskPerContract = ticks * tickVal;
  let contracts = Math.floor((riskPerTrade || 0) / riskPerContract);
  if(contracts < 1) contracts = 1;
  return {contracts, ticks, riskPerContract};
}

function renderSignal(res, market){
  const area = $("signalArea");
  if(!res){ area.innerHTML = `<div class="muted">Noch kein Signal generiert.</div>`; return; }
  if(!res.active){
    area.innerHTML = `<div class="badge warn">⚠️ Kein logisches/profitables Setup (CRV-Filter).</div>`;
    return;
  }
  const typeTxt = res.side==="long" ? "BUY" : "SELL";
  const orderTxt = res.orderType ? res.orderType.toUpperCase() : "LIMIT";
  const tpsHtml = res.tps.map((v,i)=>`<div class="box tp"><div><strong>TP${i+1}</strong></div><div>${v}</div></div>`).join("");
  const copyText =
`${res.ampel} ${res.rating} – ${market} (${typeTxt} ${orderTxt})
Entry: ${res.entry}
SL: ${res.sl}
TPs: ${res.tps.join(", ")}
CRV: ${res.crv.toFixed(2)} | Tagestrend: ${res.bias} | TP1-Wahrscheinlichkeit: ${(res.tp1Prob*100).toFixed(0)}%`;
  area.innerHTML = `
    <div class="signal-row" style="align-items:center">
      <span class="badge ${res.rating==='A++'?'good': res.rating==='A'?'warn':'bad'}">${res.ampel} ${res.rating}</span>
      <span class="badge">${res.side.toUpperCase()}</span>
      <span class="badge">${res.orderType}</span>
      <span class="badge">CRV ${res.crv.toFixed(2)}</span>
      <span class="badge">TP1 ${(res.tp1Prob*100).toFixed(0)}%</span>
      <span class="badge">Trend: ${res.bias}</span>
    </div>
    <div class="signal-row">
      <div class="box entry"><div><strong>ENTRY</strong></div><div>${res.entry}</div></div>
      <div class="box sl"><div><strong>SL</strong></div><div>${res.sl}</div></div>
      ${tpsHtml}
    </div>
    <div class="copy" id="copyBox">${copyText}${(res.notes&&res.notes.length)? "\n" + res.notes.join("\n") : ""}</div>
  `;
}

function isCrypto(m){ return ["BTC","DOGE","SOL","SHIB","XRP"].includes(m); }
function maybeShowFields(){
  const m = $("market").value;
  const isC = isCrypto(m);
  $("futures-fields").style.display = isC ? "none" : "block";
  $("crypto-fields").style.display = isC ? "block" : "none";
  $("option-pdf").style.display = (!isC && (m==="ES"||m==="MES")) ? "block" : "none";
  $("nq-oi-fields").style.display = (!isC && (m==="NQ"||m==="MNQ")) ? "grid" : "none";
  const step = stepFor(m);
  ["prevVAH","prevHigh","prevPOC","prevVAL","prevLow","price"].forEach(id=>{ const el=$(id); if(el) el.step=step; });
}

document.addEventListener("DOMContentLoaded", ()=>{
  maybeShowFields();
  $("market").addEventListener("change", maybeShowFields);
  $("reset").addEventListener("click", ()=>location.reload());

  $("generate").addEventListener("click", async ()=>{
    const m = $("market").value;
    const rrMin = Number($("rrFilter").value);
    const tpCount = Number($("tpCount").value);

    if(isCrypto(m)){
      const input = {
        market: m,
        cOpen: num($("cOpen").value),
        cHigh: num($("cHigh").value),
        cLow: num($("cLow").value),
        cVAH: num($("cVAH").value),
        cPOC: num($("cPOC").value),
        cVAL: num($("cVAL").value),
        cATR: num($("cATR").value),
        cPrice: num($("cPrice").value),
        rrMin, tpCount
      };
      const result = computeSignalCrypto(input);
      renderSignal(result, m);
      return;
    }

    const input = {
      market: m,
      price: num($("price").value),
      prevVAH: num($("prevVAH").value),
      prevHigh: num($("prevHigh").value),
      prevPOC: num($("prevPOC").value),
      prevVAL: num($("prevVAL").value),
      prevLow: num($("prevLow").value),
      maxPain: num($("maxPain").value),
      gex: $("gex").value,
      gammaFlip: num($("gammaFlip").value),
      openCtx: $("openContext").value,
      gapType: $("gapType").value,
      rrMin, tpCount
    };

    let optionFindings = {callWalls:[], putWalls:[]};

    if(m==="ES" || m==="MES"){
      const f = $("pdfFile").files?.[0];
      if(f){
        $("pdfStatus").textContent = "Lese PDF…";
        optionFindings = await parsePDF(f);
        $("pdfStatus").textContent = `Call-Walls: ${optionFindings.callWalls.slice(0,2).map(x=>x.strike).join(", ")} | Put-Walls: ${optionFindings.putWalls.slice(0,2).map(x=>x.strike).join(", ")}`;
      }else{
        $("pdfStatus").textContent = "Keine PDF hochgeladen – Option-Chain wird nicht berücksichtigt.";
      }
    }

    if(m==="NQ" || m==="MNQ"){
      const call = $("callOI").value.trim();
      const put  = $("putOI").value.trim();
      if(call && call.includes("/")){
        const strike = Number(call.split("/")[0].trim());
        const oi = Number(call.split("/")[1].trim());
        if(!isNaN(strike) && !isNaN(oi)) optionFindings.callWalls = [{strike, oi}];
      }
      if(put && put.includes("/")){
        const strike = Number(put.split("/")[0].trim());
        const oi = Number(put.split("/")[1].trim());
        if(!isNaN(strike) && !isNaN(oi)) optionFindings.putWalls = [{strike, oi}];
      }
    }

    
const result = computeSignalFutures(input, optionFindings);

// --- Risk enforcement & Mini→Micro toggle ---
const riskMax = num($("riskPerTrade").value);
if (!isNaN(riskMax) && riskMax > 0 && result && result.entry && result.sl) {
  const stepX = stepFor(m);
  const tickValX = tickValueFor(m);
  const ticksX = Math.max(1, Math.ceil(Math.abs(result.entry - result.sl)/stepX));
  const riskPer1 = ticksX * tickValX;

  const autoMicro = (document.getElementById("autoMicroToggle")?.checked === true);
  const isMini = (m === "ES" || m === "NQ");
  if (riskPer1 > riskMax) {
    if (isMini) {
      const micro = (m === "ES") ? "MES" : "MNQ";
      const stepM = stepFor(micro);
      const tickValM = tickValueFor(micro);
      const ticksM = Math.max(1, Math.ceil(Math.abs(result.entry - result.sl)/stepM));
      const riskPer1M = ticksM * tickValM;
      if (riskPer1M <= riskMax) {
        if (autoMicro) {
          // switch market to micro for output
          m = micro;
          result.notes = (result.notes||[]).concat([`Auto Micro aktiv → ${micro} (Risiko/K: ${riskPer1M.toFixed(2)}$, Max: ${riskMax.toFixed(2)}$)`]);
        } else {
          // render Micro as recommended signal (do NOT block)
          m = micro;
          result.notes = (result.notes||[]).concat([
            `Empfohlenes Micro-Signal: ${micro} (Risiko/K: ${riskPer1M.toFixed(2)}$, Max: ${riskMax.toFixed(2)}$) – Mini (${m==="MES"?"ES":m==="MNQ"?"NQ":m}) überschreitet das Max-Risiko.`
          ]);
        }
      } else {
        const area = $("signalArea");
        area.innerHTML = `<div class="badge warn">⚠️ Max-Risiko überschritten (Mini & Micro). Bitte SL enger setzen oder Risiko erhöhen.</div>`;
        return;
      }
    } else {
      // Non-mini instrument too risky → block
      const area = $("signalArea");
      area.innerHTML = `<div class="badge warn">⚠️ Max-Risiko überschritten (≈ ${riskPer1.toFixed(2)}$ pro Kontrakt). Bitte SL enger setzen oder Micro wählen.</div>`;
      return;
    }
  } else {
    // within risk, annotate info line
    result.notes = (result.notes||[]).concat([`Risiko/Kontrakt: ${riskPer1.toFixed(2)}$ (Max: ${riskMax.toFixed(2)}$)`]);
  }
}

// old sizing preview (not used in output, kept for compatibility)
const pos = (isNaN(num($("riskPerTrade").value))) ? null : (function(){
  const tickVal = tickValueFor(m);
  const step = stepFor(m);
  const ticks = Math.max(1, Math.ceil(Math.abs(result.entry - result.sl)/step));
  const riskPerContract = ticks * tickVal;
  let contracts = Math.floor((num($("riskPerTrade").value) || 0) / riskPerContract);
  if(contracts < 1) contracts = 1;
  return {contracts, ticks, riskPerContract};
})();

renderSignal(result, m);

  });
});
