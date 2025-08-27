/* ======== CONFIG ======== */
const PRICE_ADULTO = 3;
const PRICE_BAMBINO = 2;

/* ======== STATE ======== */
let raw = [];        // records crudi
let records = [];    // records normalizzati (Date, flag, ecc.)
let daily = [];      // aggregati giornalieri (dopo filtro)
let filters = { start: null, end: null, tipo: 'all', rollWindow: 7 };

/* ======== UTILS ======== */
const fmtInt = n => (isFinite(n) ? Math.round(n) : 0);
const fmtEur = n => (isFinite(n) ? `${fmtInt(n)} €` : "0 €");
const pct = (a,b) => b>0 ? (100*a/b) : 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const itWeekday = d => ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d]; // 0=Dom
const pad2 = x => String(x).padStart(2,'0');
const parseIsChild = s => (s||"").toLowerCase().includes("bamb");

/* Rolling average semplice */
function rolling(arr, w) {
  if (w <= 1) return arr.slice();
  const out = [];
  let sum = 0;
  for (let i=0;i<arr.length;i++){
    sum += arr[i];
    if (i>=w) sum -= arr[i-w];
    out.push(i>=w-1 ? sum/w : null);
  }
  return out;
}

/* Percentile (tipo nearest-rank) */
function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const idx = Math.ceil((p/100)*a.length)-1;
  return a[clamp(idx,0,a.length-1)];
}

/* Z-score su vettore (ritorna array di z) */
function zscores(arr){
  const n = arr.length;
  if (!n) return [];
  const m = arr.reduce((s,x)=>s+x,0)/n;
  const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/n;
  const sd = Math.sqrt(v)||1;
  return arr.map(x => (x-m)/sd);
}

/* Costruisce un oggetto Date da "YYYY-MM-DD" e "HH:MM" (UTC-like per coerenza) */
function makeDate(dateStr, timeStr){
  const [Y,M,D] = (dateStr||"1970-01-01").split("-").map(Number);
  const [h,m]   = (timeStr||"00:00").split(":").map(Number);
  // month index 0-based
  return new Date(Date.UTC(Y, (M||1)-1, D||1, h||0, m||0, 0));
}

/* Scarica testo come file */
function download(filename, text){
  const blob = new Blob([text], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ======== LOAD & PREP ======== */
async function loadData(){
  const res = await fetch("clienti.json");
  raw = await res.json();

  // Normalizza
  records = raw.map((c, i) => {
    const isChild = parseIsChild(c.descrizione);
    const dt = makeDate(c.data, c.orario);
    const hour = Number((c.orario||"00:00").split(":")[0]||0);
    const halfHour = Number((c.orario||"00:00").split(":")[1]||0) < 30 ? 0 : 30;
    const bucket = `${pad2(hour)}:${pad2(halfHour)}`;
    const euro = isChild ? PRICE_BAMBINO : PRICE_ADULTO;
    return {
      idx: i,
      id: c.id ?? i+1,
      dateStr: c.data,
      timeStr: c.orario || "00:00",
      dt,
      weekday: dt.getUTCDay(), // 0=Dom
      hour,
      bucket,
      isChild,
      euro
    };
  }).filter(r => r.dateStr); // tiene solo quelli con data valida

  // Pre-popola date UI
  const dates = [...new Set(records.map(r=>r.dateStr))].sort();
  if (dates.length){
    document.getElementById("start-date").value = dates[0];
    document.getElementById("end-date").value   = dates[dates.length-1];
    filters.start = dates[0];
    filters.end   = dates[dates.length-1];
  }

  applyFilters(); // prima render
}

/* ======== FILTERING ======== */
function applyFilters(){
  const start = filters.start;
  const end   = filters.end;
  const tipo  = filters.tipo;

  const keep = r => {
    const inRange = (!start || r.dateStr >= start) && (!end || r.dateStr <= end);
    if (!inRange) return false;
    if (tipo === 'adulti' &&  r.isChild) return false;
    if (tipo === 'bambini' && !r.isChild) return false;
    return true;
  };

  const R = records.filter(keep).sort((a,b)=> a.dt - b.dt);
  renderAll(R);
}

/* ======== AGGREGATIONS ======== */
function aggregateDaily(R){
  const map = new Map(); // key=dateStr
  for (const r of R){
    if (!map.has(r.dateStr)){
      map.set(r.dateStr, {
        date: r.dateStr,
        n:0, adulti:0, bambini:0,
        euro:0
      });
    }
    const d = map.get(r.dateStr);
    d.n += 1;
    if (r.isChild){ d.bambini += 1; } else { d.adulti += 1; }
    d.euro += r.euro;
  }
  const arr = [...map.values()].sort((a,b)=> a.date.localeCompare(b.date));
  return arr;
}

function aggregateHour(R){
  // per ora 0..23, con split adulti/bambini
  const by = Array.from({length:24}, (_,h)=>({hour:h, n:0, adulti:0, bambini:0, euro:0}));
  for (const r of R){
    const b = by[r.hour];
    b.n += 1;
    if (r.isChild){ b.bambini += 1; } else { b.adulti += 1; }
    b.euro += r.euro;
  }
  return by;
}

function aggregateHeatmap(R){
  // y = dateStr (ord), x = 0..23, z = counts
  const dates = [...new Set(R.map(r=>r.dateStr))].sort();
  const x = Array.from({length:24}, (_,i)=>i);
  const z = dates.map(d=>{
    const row = Array(24).fill(0);
    R.forEach(r=>{ if (r.dateStr===d) row[r.hour]++; });
    return row;
  });
  // anche split adulti/bambini (per hotspot table)
  const zA = dates.map(d=>{
    const row = Array(24).fill(0);
    R.forEach(r=>{ if (r.dateStr===d && !r.isChild) row[r.hour]++; });
    return row;
  });
  const zB = dates.map(d=>{
    const row = Array(24).fill(0);
    R.forEach(r=>{ if (r.dateStr===d && r.isChild) row[r.hour]++; });
    return row;
  });
  return {dates, x, z, zA, zB};
}

function aggregateDOWBoxes(R){
  // boxplot per giorno della settimana: distribuzione dei clienti per giorno
  // 1) daily totals
  const d = aggregateDaily(R);
  const byDOW = Array.from({length:7}, ()=>[]);
  for (const row of d){
    const wd = (new Date(row.date+"T00:00:00Z")).getUTCDay();
    byDOW[wd].push(row.n);
  }
  return byDOW;
}

function interarrivalMinutes(R){
  const mins = [];
  for (let i=1;i<R.length;i++){
    const deltaMs = (R[i].dt - R[i-1].dt);
    const m = Math.max(0, Math.round(deltaMs/60000));
    mins.push(m);
  }
  return mins;
}

function paretoByHour(R){
  // Pareto sulle (date,ora): quali ore (in tutto il periodo filtrato) generano più clienti
  const key = (d,h)=> `${d}|${h}`;
  const map = new Map();
  for (const r of R){
    const k = key(r.dateStr, r.hour);
    map.set(k, (map.get(k)||0)+1);
  }
  const arr = [...map.entries()].map(([k,n])=>{
    const [d,h] = k.split("|");
    return { date: d, hour: Number(h), n };
  }).sort((a,b)=> b.n - a.n);
  const cum = [];
  let s = 0;
  const tot = R.length;
  for (let i=0;i<arr.length;i++){
    s += arr[i].n;
    cum.push(s/tot*100);
  }
  return { items: arr, cum };
}

/* ======== RENDER ======== */
function renderAll(R){
  // === Aggregazioni base ===
  daily = aggregateDaily(R);
  const byHour = aggregateHour(R);
  const heat   = aggregateHeatmap(R);
  const byDow  = aggregateDOWBoxes(R);
  const inter  = interarrivalMinutes(R);
  const pto    = paretoByHour(R);

  // === KPI ===
  const totClients = R.length;
  const totRev     = R.reduce((s,r)=>s+r.euro,0);
  const daysN      = daily.length;
  const avgDay     = daysN ? (totClients/daysN) : 0;
  const sdDay      = (()=>{
    const arr = daily.map(d=>d.n);
    const m = arr.reduce((s,x)=>s+x,0)/(arr.length||1);
    const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(arr.length||1);
    return Math.sqrt(v)||0;
  })();
  const cv         = avgDay>0 ? (sdDay/avgDay*100) : 0;
  const adults     = R.filter(r=>!r.isChild).length;
  const pAdults    = pct(adults, totClients);
  const bestDay    = daily.slice().sort((a,b)=>b.n-a.n)[0];
  const p95        = percentile(daily.map(d=>d.n), 95);
  const medInter   = percentile(inter, 50);

  document.getElementById("kpi-total").textContent = fmtInt(totClients);
  document.getElementById("kpi-rev").textContent   = fmtEur(totRev);
  document.getElementById("kpi-avg").textContent   = avgDay.toFixed(2);
  document.getElementById("kpi-cv").textContent    = `${sdDay.toFixed(2)} / ${cv.toFixed(1)}%`;
  document.getElementById("kpi-adult-share").textContent = `${pAdults.toFixed(1)}%`;
  document.getElementById("kpi-best-day").textContent    = bestDay ? `${bestDay.date} (${bestDay.n})` : "-";
  document.getElementById("kpi-p95").textContent   = fmtInt(p95);
  document.getElementById("kpi-med-inter").textContent = `${fmtInt(medInter)} min`;

  // === TREND GIORNALIERO + ROLLING ===
  const xDates = daily.map(d=>d.date);
  const yCount = daily.map(d=>d.n);
  const yRoll  = rolling(yCount, clamp(Number(filters.rollWindow)||7, 1, 60));

  Plotly.newPlot("trend-daily", [
    { x:xDates, y:yCount, type:"scatter", mode:"lines+markers", name:"Clienti/Giorno" },
    { x:xDates, y:yRoll,  type:"scatter", mode:"lines", name:`Media mobile (${filters.rollWindow}g)` }
  ], { title:"Andamento Giornaliero (con media mobile)", hovermode:"x unified" });

  // === STACK AREA: Adulti vs Bambini nel tempo ===
  const yA = daily.map(d=>d.adulti);
  const yB = daily.map(d=>d.bambini);
  Plotly.newPlot("area-type", [
    { x:xDates, y:yA, type:"scatter", mode:"lines", stackgroup:"one", name:"Adulti" },
    { x:xDates, y:yB, type:"scatter", mode:"lines", stackgroup:"one", name:"Bambini" }
  ], { title:"Composizione Clienti nel Tempo (Stacked Area)", hovermode:"x unified" });

  // === BOX PLOT per giorno della settimana ===
  const tracesBox = byDow.map((arr, idx)=>({
    y: arr, type:"box", name: itWeekday(idx)
  }));
  Plotly.newPlot("dow-box", tracesBox, { title:"Distribuzione Clienti per Giorno della Settimana (Box Plot)" });

  // === BAR: Ora del giorno (split adulti/bambini) ===
  const hours = byHour.map(r=>r.hour);
  const yH_A  = byHour.map(r=>r.adulti);
  const yH_B  = byHour.map(r=>r.bambini);
  Plotly.newPlot("hod-bar", [
    { x:hours, y:yH_A, type:"bar", name:"Adulti" },
    { x:hours, y:yH_B, type:"bar", name:"Bambini" }
  ], { title:"Clienti medi per Ora del Giorno", barmode:"stack", xaxis:{dtick:1, title:"Ora"}, yaxis:{title:"Clienti"} });

  // === HEATMAP (giorno x ora) ===
  Plotly.newPlot("heatmap", [{
    z: heat.z, x: heat.x, y: heat.dates, type:"heatmap", colorbar:{title:"Clienti"}
  }], { title:"Heatmap Affluenza (Giorno × Ora)", xaxis:{title:"Ora"}, yaxis:{title:"Data"} });

  // === Inter-arrival histogram ===
  Plotly.newPlot("interarrival-hist", [{
    x: inter, type:"histogram", nbinsx: 40, name:"Interarrivo (min)"
  }], { title:"Distribuzione Interarrivi (minuti)", xaxis:{title:"Minuti"}, yaxis:{title:"Frequenza"} });

  // === Pareto (cumulativo %) sulle finestre (giorno+ora) ===
  const rank = pto.items.map((_,i)=>i+1);
  Plotly.newPlot("pareto", [
    { x: rank, y: pto.items.map(x=>x.n), type:"bar", name:"Clienti per finestra (giorno+ora)" },
    { x: rank, y: pto.cum, type:"scatter", mode:"lines+markers", yaxis:"y2", name:"Cumulativo %" }
  ], {
    title:"Pareto: quali finestre (giorno+ora) generano il traffico",
    yaxis:{ title:"Clienti" },
    yaxis2:{ title:"Cumulativo %", overlaying:"y", side:"right", rangemode:"tozero", range:[0,100] },
    xaxis:{ title:"Rank della finestra (1 = più affollata)" }
  });

  // === Anomalie (z-score) sui daily totals ===
  const z = zscores(yCount);
  Plotly.newPlot("anomalies", [
    { x:xDates, y:yCount, type:"scatter", mode:"lines+markers", name:"Clienti/Giorno" },
    { x:xDates.filter((_,i)=>Math.abs(z[i])>=2), y:yCount.filter((_,i)=>Math.abs(z[i])>=2),
      type:"scatter", mode:"markers", name:"Anomalia |z|≥2" }
  ], { title:"Rilevazione Anomalie sui Clienti Giornalieri (z-score)" });

  // === Tabella Hotspot (Top 15) ===
  renderHotspots(heat);
}

function renderHotspots(heat){
  // genera top righe per (date,hour)
  const rows = [];
  for (let i=0;i<heat.dates.length;i++){
    for (let h=0; h<heat.x.length; h++){
      const n = heat.z[i][h];
      if (n>0){
        const adulti  = heat.zA[i][h];
        const bambini = heat.zB[i][h];
        const euro = adulti*PRICE_ADULTO + bambini*PRICE_BAMBINO;
        rows.push({ date: heat.dates[i], hour:h, n, adulti, bambini, euro });
      }
    }
  }
  rows.sort((a,b)=> b.n - a.n);
  const top = rows.slice(0, 15);

  const tbody = document.querySelector("#table-hotspots tbody");
  tbody.innerHTML = "";
  top.forEach((r, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${r.date}</td>
      <td>${pad2(r.hour)}:00</td>
      <td>${r.n}</td>
      <td>${r.adulti}</td>
      <td>${r.bambini}</td>
      <td>${fmtInt(r.euro)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ======== CSV EXPORT ======== */
function exportDailyCSV(){
  const headers = ["data","clienti","adulti","bambini","incasso"];
  const lines = [headers.join(",")];
  for (const d of daily){
    lines.push([d.date, d.n, d.adulti, d.bambini, d.euro].join(","));
  }
  download("statistiche_giornaliere.csv", lines.join("\n"));
}

/* ======== UI EVENTS ======== */
function bindUI(){
  document.getElementById("apply").addEventListener("click", ()=>{
    filters.start = document.getElementById("start-date").value || null;
    filters.end   = document.getElementById("end-date").value   || null;
    filters.tipo  = document.getElementById("tipo").value || 'all';
    filters.rollWindow = Math.max(1, parseInt(document.getElementById("roll-window").value||"7",10));
    applyFilters();
  });

  document.getElementById("reset").addEventListener("click", ()=>{
    const dates = [...new Set(records.map(r=>r.dateStr))].sort();
    if (dates.length){
      document.getElementById("start-date").value = dates[0];
      document.getElementById("end-date").value   = dates[dates.length-1];
      document.getElementById("tipo").value = "all";
      document.getElementById("roll-window").value = 7;
      filters = { start: dates[0], end: dates[dates.length-1], tipo:'all', rollWindow:7 };
      applyFilters();
    }
  });

  document.getElementById("export-csv").addEventListener("click", exportDailyCSV);
}

/* ======== BOOT ======== */
document.addEventListener("DOMContentLoaded", ()=>{
  bindUI();
  loadData().catch(err=>{
    console.error("Errore nel caricamento di clienti.json", err);
    // fallback: messaggio semplice
    Plotly.newPlot("trend-daily", [], {title:"Impossibile caricare i dati (controlla percorso clienti.json)"});
  });
});
