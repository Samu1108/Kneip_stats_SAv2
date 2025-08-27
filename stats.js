const PRICE_ADULTO = 3;
const PRICE_BAMBINO = 2;
const PERMANENZA_MIN = 75;
const CAPACITA = 60;

let raw = [], rec = [], aggregatedDaily = [], aggregatedHourly = [], filteredRecords = [];

const pad2 = x => String(x).padStart(2,"0");
const toEur = n => Number(n).toFixed(2) + " €";
const isChild = s => (s||"").toLowerCase().includes("bamb");

function toDateObj(dateStr,timeStr){
    const [Y,M,D] = dateStr.split("-").map(Number);
    const [h,m] = (timeStr||"00:00").split(":").map(Number);
    return new Date(Y,M-1,D,h,m,0);
}

async function loadData(){
    const res = await fetch("clienti.json");
    raw = await res.json();
    rec = raw.map((r,i)=>{
        const child = isChild(r.descrizione);
        const dt = toDateObj(r.data,r.orario);
        const [h,m] = (r.orario||"00:00").split(":").map(Number);
        return {
            idx: i,
            id: r.id ?? i+1,
            data: r.data,
            orario: r.orario||"00:00",
            dt,
            hour: h,
            minute: m,
            bucketHalf: `${pad2(h)}:${m<30?"00":"30"}`,
            isChild: child,
            price: child ? PRICE_BAMBINO : PRICE_ADULTO
        };
    }).filter(r=>r.data);

    const dates = [...new Set(rec.map(r=>r.data))].sort();
    if(dates.length){
        document.getElementById("start-date").value = dates[0];
        document.getElementById("end-date").value = dates[dates.length-1];
    }

    bindUI();
    applyFiltersAndRender();
}

/* FILTRI */
function getFilters(){
    const s = document.getElementById("start-date").value || null;
    const e = document.getElementById("end-date").value || null;
    const t = document.getElementById("filter-type").value || "all";
    return { start: s, end: e, tipo: t };
}

function applyFiltersAndRender(){
    const f = getFilters();
    const startDate = f.start ? new Date(f.start) : null;
    const endDate = f.end ? new Date(f.end) : null;

    filteredRecords = rec.filter(r=>{
        const dt = r.dt;
        const inDate = (!startDate || dt >= startDate) && (!endDate || dt <= endDate);
        const inType = f.tipo === "all" || (f.tipo==="adulti"?!r.isChild:r.isChild);
        return inDate && inType;
    }).sort((a,b)=>a.dt-b.dt);

    // Aggregazioni orarie solo 9-17
    const hourlyFiltered = filteredRecords.filter(r => r.hour >= 9 && r.hour <= 17);
    aggregatedDaily = aggregateDaily(filteredRecords);
    aggregatedHourly = aggregateHourlyByDay(hourlyFiltered);
    aggregatedHourly.summary = aggregateHourlySummary(aggregatedHourly);

    renderAll();
}

/* AGGREGAZIONI */
function aggregateDaily(R){
    const map = new Map();
    for(const r of R){
        if(!map.has(r.data)) map.set(r.data,{date:r.data,n:0,adulti:0,bambini:0,revenue:0});
        const d = map.get(r.data);
        d.n++;
        r.isChild ? d.bambini++ : d.adulti++;
        d.revenue += r.price;
    }
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function aggregateHourlyByDay(R){
    const dates = [...new Set(R.map(r=>r.data))].sort();
    const matrix = {};
    for(const d of dates){
        matrix[d] = Array.from({length:24},(_,h)=>({hour:h,adulti:0,bambini:0,totale:0,revenue:0}));
    }
    for(const r of R){
        const row = matrix[r.data][r.hour];
        r.isChild ? row.bambini++ : row.adulti++;
        row.totale++;
        row.revenue += r.price;
    }
    return {dates,matrix};
}

function aggregateHourlySummary(hourlyByDay){
    const summary = [];
    const dates = hourlyByDay.dates;
    for(let h=9; h<=17; h++){
        const perDayTotals = dates.map(d=>hourlyByDay.matrix[d][h].totale);
        const perDayAdulti = dates.map(d=>hourlyByDay.matrix[d][h].adulti);
        const perDayBamb = dates.map(d=>hourlyByDay.matrix[d][h].bambini);
        const perDayRev = dates.map(d=>hourlyByDay.matrix[d][h].revenue);

        const totalArrivals = perDayTotals.reduce((s,v)=>s+v,0);
        const totalAdulti = perDayAdulti.reduce((s,v)=>s+v,0);
        const totalBamb = perDayBamb.reduce((s,v)=>s+v,0);
        const totalRev = perDayRev.reduce((s,v)=>s+v,0);

        summary.push({hour:h,totalArrivals,totalAdulti,totalBamb,totalRev});
    }
    return summary;
}

/* KPI */
function computeKPIs(){
    const totClients = filteredRecords.length;
    const totRevenue = filteredRecords.reduce((s,r)=>s+r.price,0);
    const avgRevenuePerClient = totClients ? (totRevenue/totClients).toFixed(2) : "0.00";
    const dailyCounts = aggregatedDaily.map(d=>d.n);
    const avgPerDay = dailyCounts.length ? (dailyCounts.reduce((s,x)=>s+x,0)/dailyCounts.length).toFixed(2) : "0.00";

    // Picco basato su clienti filtrati
    const peakDay = aggregatedDaily.reduce((max,d)=>d.n>max.n?d:max,{n:0,revenue:0,date:"-"});

    return {
        totClients,
        totRevenue,
        avgRevenuePerClient,
        avgPerDay,
        peakDay: peakDay.date + " (" + peakDay.n + " clienti, " + peakDay.revenue.toFixed(2) + " €)"
    };
}

/* RENDER */
function renderKPIs(){
    const k = computeKPIs();
    document.getElementById("kpi-total").textContent = k.totClients;
    document.getElementById("kpi-revenue").textContent = toEur(k.totRevenue);
    document.getElementById("kpi-revenue-per-client").textContent = toEur(Number(k.avgRevenuePerClient));
    document.getElementById("kpi-avg").textContent = k.avgPerDay;
    document.getElementById("kpi-peak").textContent = k.peakDay;
}

/* RENDER TAB, OCCUPANCY, TREND ... */
function renderHourlyTable(){/* simile alla versione precedente */}
function renderOccupancy(){/* simile */}
function renderTrend(){/* simile */}
function renderAll(){
    renderKPIs();
    renderHourlyTable();
    renderOccupancy();
    renderTrend();
}

function bindUI(){/* simile alla versione precedente */}

document.addEventListener("DOMContentLoaded",()=>{loadData();});
