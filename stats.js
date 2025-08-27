/* stats.js
   Richiede clienti.json nella stessa cartella.
   Permanenza fissa = 75 min, capienza = 60 (puoi cambiare le costanti qui sotto)
*/

const PRICE_ADULTO = 3;
const PRICE_BAMBINO = 2;
const PERMANENZA_MIN = 75; // 1h15
const CAPACITA = 60;

// stato
let raw = [];
let rec = []; // records normalizzati
let aggregatedDaily = [];
let aggregatedHourly = []; // per ora 0..23
let filteredRecords = [];

// utilità
const pad2 = x => String(x).padStart(2, '0');
const toEur = n => `${Math.round(n)} €`;
const isChild = s => (s||"").toLowerCase().includes("bamb");

// parse date/time safely (treating as local dates but use consistent buckets)
function toDateObj(dateStr, timeStr){
  // assume dateStr "YYYY-MM-DD", timeStr "HH:MM"
  const [Y,M,D] = (dateStr||"1970-01-01").split("-").map(Number);
  const [h,m] = (timeStr||"00:00").split(":").map(Number);
  // Use local Date constructor but zero seconds
  return new Date(Y, (M||1)-1, D||1, h||0, m||0, 0);
}

// fetch + normalize
async function loadData(){
  try {
    const res = await fetch("clienti.json");
    raw = await res.json();
  } catch (e) {
    console.error("Errore caricamento clienti.json", e);
    alert("Impossibile caricare clienti.json (controlla percorso / server).");
    return;
  }
  rec = raw.map((r, idx) => {
    const child = isChild(r.descrizione);
    const dt = toDateObj(r.data, r.orario);
    const hour = (r.orario || "00:00").split(":")[0] || "00";
    const minute = (r.orario || "00:00").split(":")[1] || "00";
    return {
      idx, id: r.id ?? (idx+1),
      data: r.data,
      orario: r.orario || "00:00",
      dt,
      hour: Number(hour),
      minute: Number(minute),
      bucketHalf: `${pad2(hour)}:${Number(minute) < 30 ? "00" : "30"}`,
      isChild: child,
      price: child ? PRICE_BAMBINO : PRICE_ADULTO
    };
  }).filter(r => r.data); // scarta senza data

  // set default date range UI
  const dates = [...new Set(rec.map(r => r.data))].sort();
  if (dates.length){
    document.getElementById("start-date").value = dates[0];
    document.getElementById("end-date").value = dates[dates.length-1];
  }

  // inizializza eventi UI
  bindUI();

  // prima render
  applyFiltersAndRender();
}

/* ====== FILTRI ====== */
function getFilters(){
  const s = document.getElementById("start-date").value || null;
  const e = document.getElementById("end-date").value || null;
  const t = document.getElementById("filter-type").value || "all";
  const roll = Math.max(1, parseInt(document.getElementById("roll-window").value||"7",10));
  return { start: s, end: e, tipo: t, rollWindow: roll };
}

function applyFiltersAndRender(){
  const f = getFilters();
  filteredRecords = rec.filter(r => {
    if (f.start && r.data < f.start) return false;
    if (f.end && r.data > f.end) return false;
    if (f.tipo === "adulti" && r.isChild) return false;
    if (f.tipo === "bambini" && !r.isChild) return false;
    return true;
  }).sort((a,b)=> a.dt - b.dt);

  // ri-aggregazioni
  aggregatedDaily = aggregateDaily(filteredRecords);
  aggregatedHourly = aggregateHourlyByDay(filteredRecords); // object mapping day->hour->counts
  aggregatedHourly.summary = aggregateHourlySummary(aggregatedHourly); // summary per hour across days (totale, max, min, adulti/bambini/incasso)
  renderAll();
}

/* ====== AGGREGAZIONI ====== */

// daily totals
function aggregateDaily(R){
  const map = new Map();
  for (const r of R){
    if (!map.has(r.data)) map.set(r.data, { date: r.data, n:0, adulti:0, bambini:0, revenue:0 });
    const d = map.get(r.data);
    d.n += 1;
    if (r.isChild) d.bambini += 1; else d.adulti += 1;
    d.revenue += r.price;
  }
  return [...map.values()].sort((a,b)=> a.date.localeCompare(b.date));
}

// build per-day-hour matrix: object { dates:[], matrix: { date -> [hour objects] } }
function aggregateHourlyByDay(R){
  const dates = [...new Set(R.map(r=>r.data))].sort();
  const matrix = {};
  for (const d of dates){
    // initialize hours 0..23
    matrix[d] = Array.from({length:24}, (_,h)=>({ hour:h, adulti:0, bambini:0, totale:0, revenue:0 }));
  }
  for (const r of R){
    const row = matrix[r.data][r.hour];
    if (r.isChild) row.bambini += 1; else row.adulti += 1;
    row.totale += 1;
    row.revenue += r.price;
  }
  return { dates, matrix };
}

// summary per hour across dates: totals, max per-day, min per-day
function aggregateHourlySummary(hourlyByDay){
  const summary = [];
  const dates = hourlyByDay.dates;
  for (let h=0; h<24; h++){
    // per-day values
    const perDayTotals = dates.map(d => hourlyByDay.matrix[d][h].totale);
    const perDayAdulti = dates.map(d => hourlyByDay.matrix[d][h].adulti);
    const perDayBamb  = dates.map(d => hourlyByDay.matrix[d][h].bambini);
    const perDayRev   = dates.map(d => hourlyByDay.matrix[d][h].revenue);

    const totalArrivals = perDayTotals.reduce((s,v)=>s+v,0);
    const totalAdulti = perDayAdulti.reduce((s,v)=>s+v,0);
    const totalBamb = perDayBamb.reduce((s,v)=>s+v,0);
    const totalRev = perDayRev.reduce((s,v)=>s+v,0);

    const maxArrivals = perDayTotals.length ? Math.max(...perDayTotals) : 0;
    const minArrivals = perDayTotals.length ? Math.min(...perDayTotals) : 0;
    const maxAdulti = perDayAdulti.length ? Math.max(...perDayAdulti) : 0;
    const minAdulti = perDayAdulti.length ? Math.min(...perDayAdulti) : 0;
    const maxBamb = perDayBamb.length ? Math.max(...perDayBamb) : 0;
    const minBamb = perDayBamb.length ? Math.min(...perDayBamb) : 0;
    const maxRev = perDayRev.length ? Math.max(...perDayRev) : 0;
    const minRev = perDayRev.length ? Math.min(...perDayRev) : 0;

    summary.push({
      hour: h,
      totalArrivals,
      totalAdulti,
      totalBamb,
      totalRev,
      maxArrivals,
      minArrivals,
      maxAdulti,
      minAdulti,
      maxBamb,
      minBamb,
      maxRev,
      minRev
    });
  }
  return summary;
}

/* ====== OCCUPANCY (stima usando permanenza) ======
   Idea: per ogni record consideriamo [start, end=start+PERMANENZA_MIN)
   registriamo presenza in bucket ogni 5 minuti (o 15) e sommiamo.
*/
function computeOccupancyTimeline(R, bucketMinutes = 5){
  const buckets = new Map(); // key "YYYY-MM-DDTHH:MM" -> count
  for (const rec of R){
    const start = rec.dt.getTime();
    const end = start + PERMANENZA_MIN * 60 * 1000;
    // iterate per bucket
    for (let t = start; t < end; t += bucketMinutes * 60 * 1000){
      const dt = new Date(t);
      // normalize to string key: date + hh:mm (local)
      const key = `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(Math.floor(dt.getMinutes()/bucketMinutes)*bucketMinutes)}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }
  // sorted arrays
  const keys = [...buckets.keys()].sort();
  const counts = keys.map(k => buckets.get(k));
  return { keys, counts, buckets };
}

/* ====== KPI UTILI ====== */
function computeKPIs(){
  const totClients = filteredRecords.length;
  const totRevenue = filteredRecords.reduce((s,r)=>s+r.price,0);
  const dailyCounts = aggregatedDaily.map(d=>d.n);
  const avgPerDay = dailyCounts.length ? (dailyCounts.reduce((s,x)=>s+x,0) / dailyCounts.length) : 0;

  // interarrival median
  const inter = [];
  for (let i=1;i<filteredRecords.length;i++){
    const diffMin = Math.round((filteredRecords[i].dt - filteredRecords[i-1].dt) / 60000);
    inter.push(Math.max(0,diffMin));
  }
  inter.sort((a,b)=>a-b);
  const medianInter = inter.length ? inter[Math.floor(inter.length/2)] : 0;

  // occupancy timeline and peak saturation
  const occ = computeOccupancyTimeline(filteredRecords, 5);
  const peakCount = occ.counts.length ? Math.max(...occ.counts) : 0;
  const peakKey = occ.keys[occ.counts.indexOf(peakCount)] || "-";
  const saturation = CAPACITA>0 ? (peakCount / CAPACITA * 100) : 0;

  return {
    totClients, totRevenue, avgPerDay: avgPerDay.toFixed(2),
    medianInter, peakCount, peakKey, saturation: saturation.toFixed(1)
  };
}

/* ====== RENDERING ====== */

function renderKPIs(){
  const k = computeKPIs();
  document.getElementById("kpi-total").textContent = k.totClients;
  document.getElementById("kpi-revenue").textContent = toEur(k.totRevenue);
  document.getElementById("kpi-avg").textContent = k.avgPerDay;
  document.getElementById("kpi-med-inter").textContent = k.medianInter + " min";
  document.getElementById("kpi-peak").textContent = k.peakKey + " (" + k.peakCount + ")";
  document.getElementById("kpi-saturation").textContent = k.saturation + "%";
}

function renderTrendAndDow(){
  // Trend giornaliero
  const x = aggregatedDaily.map(d=>d.date);
  const y = aggregatedDaily.map(d=>d.n);
  const roll = Number(document.getElementById("roll-window").value || 7);
  const yRoll = movingAverage(y, roll);

  Plotly.newPlot("chart-trend-daily", [
    { x, y, type:"scatter", mode:"lines+markers", name:"Clienti/giorno" },
    { x, y:yRoll, type:"scatter", mode:"lines", name:`Media mobile ${roll}g` }
  ], { title:"Andamento giornaliero" });

  // Dow distribution
  const dowMap = {};
  for (const d of aggregatedDaily){
    const dow = new Date(d.date).getDay(); // 0=dom
    const label = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][dow];
    dowMap[label] = (dowMap[label]||0) + d.n;
  }
  const dowX = Object.keys(dowMap);
  const dowY = Object.values(dowMap);
  Plotly.newPlot("chart-dow", [{ x:dowX, y:dowY, type:"bar" }], { title:"Distribuzione per giorno della settimana" });

  // Stack area adulti vs bambini
  const dates = aggregatedDaily.map(d=>d.date);
  const adulti = aggregatedDaily.map(d=>d.adulti);
  const bambini = aggregatedDaily.map(d=>d.bambini);
  Plotly.newPlot("chart-stack-type", [
    { x:dates, y:adulti, type:"scatter", mode:"lines", name:"Adulti", stackgroup:"one" },
    { x:dates, y:bambini, type:"scatter", mode:"lines", name:"Bambini", stackgroup:"one" }
  ], { title:"Composizione Adulti / Bambini nel tempo" });
}

/* moving average (null for initial days to keep alignment) */
function movingAverage(arr, window){
  if (window <= 1) return arr.slice();
  const out = [];
  let sum = 0;
  for (let i=0;i<arr.length;i++){
    sum += arr[i];
    if (i >= window) sum -= arr[i-window];
    out.push(i >= window-1 ? +(sum/window).toFixed(2) : null);
  }
  return out;
}

/* TABLE ORARIA: Totale / Max / Min */
function renderHourlyTable(){
  const metric = document.getElementById("hour-metric").value; // total / max / min
  const sortOpt = document.getElementById("hour-sort").value;

  const summary = aggregatedHourly.summary || [];
  const rows = summary.map(s => {
    let adulti, bambini, totale, incasso;
    if (metric === "total"){
      adulti = s.totalAdulti;
      bambini = s.totalBamb;
      totale = s.totalArrivals;
      incasso = s.totalRev;
    } else if (metric === "max"){
      adulti = s.maxAdulti;
      bambini = s.maxBamb;
      totale = s.maxArrivals;
      incasso = s.maxRev;
    } else { // min
      adulti = s.minAdulti;
      bambini = s.minBamb;
      totale = s.minArrivals;
      incasso = s.minRev;
    }
    return {
      hour: s.hour,
      adulti, bambini, totale, incasso
    };
  });

  // sort
  if (sortOpt === "hour") rows.sort((a,b)=>a.hour-b.hour);
  else if (sortOpt === "total_desc") rows.sort((a,b)=>b.totale-a.totale);
  else if (sortOpt === "total_asc") rows.sort((a,b)=>a.totale-b.totale);
  else if (sortOpt === "incasso_desc") rows.sort((a,b)=>b.incasso-a.incasso);
  else if (sortOpt === "incasso_asc") rows.sort((a,b)=>a.incasso-b.incasso);

  // populate table
  const tbody = document.querySelector("#hourly-table tbody");
  tbody.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${pad2(r.hour)}:00</td><td>${r.adulti}</td><td>${r.bambini}</td><td>${r.totale}</td><td>${Math.round(r.incasso)}</td>`;
    tbody.appendChild(tr);
  }

  // Top hours list (right panel)
  const top = [...rows].sort((a,b)=>b.totale-a.totale).slice(0,8).map((r,i)=>`${i+1}. ${pad2(r.hour)}:00 — ${r.totale}`).join("<br/>");
  document.getElementById("top-hours-list").innerHTML = top;
}

/* OCCUPANCY CHART + HEATMAP HOUR */
function renderOccupancy(){
  const occ = computeOccupancyTimeline(filteredRecords, 5);
  if (occ.keys.length === 0){
    Plotly.purge("chart-occupancy");
    Plotly.newPlot("chart-occupancy", [], { title:"Occupazione (nessun dato)" });
    Plotly.purge("chart-heatmap-hour");
    Plotly.newPlot("chart-heatmap-hour", [], { title:"Heatmap oraria (nessun dato)" });
    return;
  }

  // occupancy timeline
  Plotly.newPlot("chart-occupancy", [{
    x: occ.keys,
    y: occ.counts,
    name: "Occupazione stimata",
    type: "scatter",
    mode: "lines",
    line: {shape: "spline"}
  }], {
    title: "Occupazione stimata (bucket 5 min) — linea rossa = capienza",
    shapes: [{
      type:"line", x0: occ.keys[0], x1: occ.keys[occ.keys.length-1], y0: CAPACITA, y1: CAPACITA,
      line: { color: 'red', dash: 'dash' }
    }],
    yaxis: { range: [0, Math.max(CAPACITA, Math.max(...occ.counts))+5] }
  });

  // heatmap: hour of day aggregated (0..23)
  const hourAgg = Array.from({length:24}, ()=>0);
  for (const r of filteredRecords) hourAgg[r.hour] += 1;
  Plotly.newPlot("chart-heatmap-hour", [{
    z: [hourAgg],
    x: Array.from({length:24}, (_,i)=>i),
    y: ["Clienti"],
    type: "heatmap",
    colorscale: "YlOrRd"
  }], { title: "Heatmap - Totale arrivi per ora (selezione)" });
}

/* ANOMALIES / INTERARRIVAL / PARETO */
function renderAnomaliesAndExtras(){
  // anomalies: z-score on daily totals
  const dailyVals = aggregatedDaily.map(d=>d.n);
  const z = zScores(dailyVals);
  const dates = aggregatedDaily.map(d=>d.date);
  const anomalousDates = dates.filter((d,i) => Math.abs(z[i]) >= 2);
  Plotly.newPlot("chart-anomalies", [
    { x: dates, y: dailyVals, type:"scatter", mode:"lines+markers", name:"Clienti/giorno" },
    { x: anomalousDates, y: anomalousDates.map(d=>aggregatedDaily.find(x=>x.date===d).n), type:"scatter", mode:"markers", name:"Anomalie (|z|≥2)", marker:{size:10, color:"red"} }
  ], { title: "Anomalie giornaliere (z-score)" });

  // interarrival histogram
  const inter = [];
  for (let i=1;i<filteredRecords.length;i++){
    inter.push(Math.max(0, Math.round((filteredRecords[i].dt - filteredRecords[i-1].dt)/60000)));
  }
  Plotly.newPlot("chart-interarrival", [{ x: inter, type:"histogram", nbinsx:40 }], { title:"Distribuzione interarrivi (minuti)" });

  // Pareto: finestre (giorno+ora)
  const map = new Map();
  for (const r of filteredRecords){
    const key = `${r.data}|${r.hour}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const items = [...map.entries()].map(([k,v]) => ({ key:k, n:v })).sort((a,b)=>b.n-a.n);
  const ranks = items.map((it,i) => i+1);
  const counts = items.map(it=>it.n);
  const cumPerc = counts.reduce((acc, val, i, arr) => { const s = (acc.length?acc[acc.length-1]:0) + val; acc.push(Math.round(100 * s / arr.reduce((a,b)=>a+b,0))); return acc; }, []);
  Plotly.newPlot("chart-pareto", [
    { x: ranks, y: counts, type:"bar", name:"Clienti/week-slot" },
    { x: ranks, y: cumPerc, type:"scatter", mode:"lines+markers", name:"Cumulativo %", yaxis:"y2" }
  ], {
    title:"Pareto finestre (giorno|ora)",
    yaxis:{ title:"Clienti" },
    yaxis2:{ title:"Cumulativo %", overlaying:"y", side:"right", range:[0,100] }
  });

  // hotspots small table (right panel)
  const hotTbody = document.querySelector("#hotspots-small tbody");
  hotTbody.innerHTML = "";
  items.slice(0,8).forEach((it, i)=>{
    const [d,h] = it.key.split("|");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${d}</td><td>${pad2(h)}:00</td><td>${it.n}</td>`;
    hotTbody.appendChild(tr);
  });
}

/* ====== HELPERS ====== */
function zScores(arr){
  if (!arr.length) return [];
  const n = arr.length;
  const mean = arr.reduce((s,x)=>s+x,0)/n;
  const varr = arr.reduce((s,x)=>s+(x-mean)*(x-mean),0)/n;
  const sd = Math.sqrt(varr) || 1;
  return arr.map(x => (x-mean)/sd);
}

/* ====== EXPORT CSV ====== */
function exportHourlyCSV(){
  const metric = document.getElementById("hour-metric").value;
  const rows = (aggregatedHourly.summary || []).map(s=>{
    let adulti, bambini, tot, inc;
    if (metric === "total"){
      adulti = s.totalAdulti; bambini = s.totalBamb; tot = s.totalArrivals; inc = s.totalRev;
    } else if (metric === "max"){
      adulti = s.maxAdulti; bambini = s.maxBamb; tot = s.maxArrivals; inc = s.maxRev;
    } else {
      adulti = s.minAdulti; bambini = s.minBamb; tot = s.minArrivals; inc = s.minRev;
    }
    return [pad2(s.hour)+":00", adulti, bambini, tot, Math.round(inc)];
  });
  const header = ["Ora","Adulti","Bambini","Totale","Incasso"];
  const body = [header.join(",")].concat(rows.map(r=>r.join(","))).join("\n");
  download("hourly_stats.csv", body);
}

function exportDailyCSV(){
  const header = ["data","clienti","adulti","bambini","incasso"];
  const rows = aggregatedDaily.map(d=>[d.date, d.n, d.adulti, d.bambini, Math.round(d.revenue)]);
  const body = [header.join(",")].concat(rows.map(r=>r.join(","))).join("\n");
  download("daily_stats.csv", body);
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ====== BIND UI ====== */
function bindUI(){
  document.getElementById("apply-filters").addEventListener("click", applyFiltersAndRender);
  document.getElementById("reset-filters").addEventListener("click", ()=>{
    // reset to full range
    if (!rec.length) return;
    const dates = [...new Set(rec.map(r=>r.data))].sort();
    document.getElementById("start-date").value = dates[0];
    document.getElementById("end-date").value = dates[dates.length-1];
    document.getElementById("filter-type").value = "all";
    document.getElementById("roll-window").value = 7;
    applyFiltersAndRender();
  });

  document.getElementById("hour-metric").addEventListener("change", renderHourlyTable);
  document.getElementById("hour-sort").addEventListener("change", renderHourlyTable);
  document.getElementById("export-hourly").addEventListener("click", exportHourlyCSV);
  document.getElementById("export-overall").addEventListener("click", exportDailyCSV);
  document.getElementById("recompute").addEventListener("click", applyFiltersAndRender);

  // tab switching
  document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach(p=>p.style.display="none");
      document.getElementById("tab-"+tab).style.display = "";
    });
  });

  // allow clicking header to sort by that column:
  document.querySelectorAll("#hourly-table th").forEach(th=>{
    th.addEventListener("click", ()=>{
      const col = th.dataset.col;
      const select = document.getElementById("hour-sort");
      // toggling primitive: if hour -> total_desc
      if (col === "hour") select.value = "hour";
      else if (col === "adulti" || col === "bambini" || col === "totale" || col === "incasso") {
        // toggle desc on col
        if (select.value === `${col}_desc`) select.value = `${col}_asc`;
        else select.value = `${col}_desc`;
      }
      renderHourlyTable();
    });
  });
}

/* ====== RENDER ALL ====== */
function renderAll(){
  renderKPIs();
  renderTrendAndDow();
  renderHourlyTable();
  renderOccupancy();
  renderAnomaliesAndExtras();
}

/* ====== BOOT ====== */
document.addEventListener("DOMContentLoaded", ()=>{ loadData(); });

