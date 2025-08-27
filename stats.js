const PRICE_ADULTO = 3;
const PRICE_BAMBINO = 2;
const PERMANENZA_MIN = 75;
const CAPACITA = 60;

let raw=[], rec=[], aggregatedDaily=[], aggregatedHourly=[], filteredRecords=[];

const pad2 = x => String(x).padStart(2,"0");
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
        const [h,m] = (r.orario||"00:00").split(":");
        return {
            idx: i,
            id: r.id ?? i+1,
            data: r.data,
            orario: r.orario||"00:00",
            dt,
            hour: Number(h),
            minute: Number(m),
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
    return {start:s,end:e,tipo:t};
}

function applyFiltersAndRender(){
    const f = getFilters();
    filteredRecords = rec.filter(r =>
        r.data >= f.start &&
        r.data <= f.end &&
        (f.tipo==="all" || (f.tipo==="adulti"?!r.isChild:r.isChild)) &&
        r.hour >= 9 && r.hour <= 17
    ).sort((a,b)=>a.dt-b.dt);

    aggregatedDaily = aggregateDaily(filteredRecords);
    aggregatedHourly = aggregateHourlyByDay(filteredRecords);
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
    const summary=[];
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

/* OCCUPANCY */
function computeOccupancyTimeline(R,bucketMinutes=5){
    const buckets = new Map();
    for(const rec of R){
        const start = rec.dt.getTime();
        const end = start + PERMANENZA_MIN*60*1000;
        for(let t=start; t<end; t+=bucketMinutes*60*1000){
            const dt = new Date(t);
            const key = `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(Math.floor(dt.getMinutes()/bucketMinutes)*bucketMinutes)}`;
            buckets.set(key,(buckets.get(key)||0)+1);
        }
    }
    const keys=[...buckets.keys()].sort();
    const counts = keys.map(k=>buckets.get(k));
    return {keys,counts,buckets};
}

/* KPI */
function computeKPIs(){
    const totClients = filteredRecords.length;
    const totRevenue = filteredRecords.reduce((s,r)=>s+r.price,0);
    const avgRevenuePerClient = totClients ? (totRevenue/totClients).toFixed(2) : "0.00";

    const dailyCounts = aggregatedDaily.map(d=>d.n);
    const avgPerDay = dailyCounts.length ? (dailyCounts.reduce((s,x)=>s+x,0)/dailyCounts.length).toFixed(2) : "0.00";

    const peakDay = aggregatedDaily.reduce((max,d)=>d.n>max.n?d:max,{n:0,revenue:0,date:"-"});

    const occ = computeOccupancyTimeline(filteredRecords,5);
    const peakCount = occ.counts.length ? Math.max(...occ.counts) : 0;
    const saturation = CAPACITA>0 ? (peakCount/CAPACITA*100) : 0;

    const preds = aggregatedHourly.summary.map(h=>h.totalArrivals/dailyCounts.length||0);
    const predStr = preds.map((v,i)=>`${pad2(i+9)}:00→${Math.round(v)}`).join(", ");

    return {
        totClients,
        totRevenue,
        avgRevenuePerClient,
        avgPerDay,
        peakDay: peakDay.date + " (" + peakDay.n + " clienti, " + peakDay.revenue + " €)",
        peakCount,
        saturation: Math.round(saturation),
        predStr
    };
}

/* RENDER */
function renderKPIs(){
    const k = computeKPIs();
    document.getElementById("kpi-total").textContent = k.totClients;
    document.getElementById("kpi-revenue").textContent = k.totRevenue + " €";
    document.getElementById("kpi-revenue-per-client").textContent = k.avgRevenuePerClient + " €";
    document.getElementById("kpi-avg").textContent = k.avgPerDay;
    document.getElementById("kpi-peak").textContent = k.peakDay;
    document.getElementById("kpi-saturation").textContent = k.saturation + "%";
    document.getElementById("kpi-predict").textContent = k.predStr;
}

function renderHourlyTable(){
    const tbody = document.querySelector("#hourly-table tbody");
    tbody.innerHTML = "";
    aggregatedHourly.summary.forEach(h=>{
        const pred = Math.round(h.totalArrivals/aggregatedDaily.length||0);
        const tr = document.createElement("tr");
        tr.innerHTML=`<td>${pad2(h.hour)}:00</td><td>${h.totalAdulti}</td><td>${h.totalBamb}</td>
        <td>${h.totalArrivals}</td><td>${h.totalRev.toFixed(2)} €</td><td>${pred}</td>`;
        tbody.appendChild(tr);
    });
}

function renderOccupancy(){
    const occ = computeOccupancyTimeline(filteredRecords,5);
    Plotly.newPlot("chart-occupancy",[{
        x:occ.keys,
        y:occ.counts,
        type:"scatter",
        mode:"lines",
        name:"Occupazione stimata",
        line:{shape:"spline"}
    }],{
        title:"Occupazione stimata 9-17",
        shapes:[{type:"line",x0:occ.keys[0],x1:occ.keys[occ.keys.length-1],y0:CAPACITA,y1:CAPACITA,line:{color:'red',dash:'dash'}}],
        yaxis:{range:[0,Math.max(CAPACITA,Math.max(...occ.counts))+5]}
    });
}

function renderTrend(){
    const x = aggregatedDaily.map(d=>d.date);
    const y = aggregatedDaily.map(d=>d.n);
    Plotly.newPlot("chart-trend-daily",[{
        x,y,type:"scatter",mode:"lines+markers",name:"Clienti/giorno"
    }],{title:"Andamento giornaliero"});
}

/* UI BIND */
function bindUI(){
    document.getElementById("apply-filters").addEventListener("click",applyFiltersAndRender);
    document.getElementById("reset-filters").addEventListener("click",()=>{
        const dates=[...new Set(rec.map(r=>r.data))].sort();
        document.getElementById("start-date").value = dates[0];
        document.getElementById("end-date").value = dates[dates.length-1];
        document.getElementById("filter-type").value="all";
        applyFiltersAndRender();
    });
    document.getElementById("recompute").addEventListener("click",applyFiltersAndRender);
    document.getElementById("export-hourly").addEventListener("click",()=>exportCSV("hourly"));
    document.getElementById("export-daily").addEventListener("click",()=>exportCSV("daily"));
    document.querySelectorAll(".tab-btn").forEach(btn=>btn.addEventListener("click",()=>{
        document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".tab-panel").forEach(p=>p.style.display="none");
        document.getElementById("tab-"+btn.dataset.tab).style.display="";
    }));
}

/* EXPORT CSV */
function exportCSV(type){
    let body="";
    if(type==="hourly"){
        const header=["Ora","Adulti","Bambini","Totale","Incasso (€)","Previsti"];
        const rows = aggregatedHourly.summary.map(h=>[
            pad2(h.hour)+":00",
            h.totalAdulti,
            h.totalBamb,
            h.totalArrivals,
            h.totalRev.toFixed(2)+" €",
            Math.round(h.totalArrivals/aggregatedDaily.length||0)
        ]);
        body = [header.join(","),...rows.map(r=>r.join(","))].join("\n");
        download("hourly.csv",body);
    } else {
        const header=["Data","Clienti","Adulti","Bambini","Incasso (€)"];
        const rows = aggregatedDaily.map(d=>[
            d.date,
            d.n,
            d.adulti,
            d.bambini,
            d.revenue.toFixed(2)+" €"
        ]);
        body = [header.join(","),...rows.map(r=>r.join(","))].join("\n");
        download("daily.csv",body);
    }
}

function download(filename,text){
    const blob = new Blob([text],{type:'text/csv;charset=utf-8;'});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download',filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderAll(){
    renderKPIs();
    renderHourlyTable();
    renderOccupancy();
    renderTrend();
}

document.addEventListener("DOMContentLoaded",()=>{loadData();});
