const PRICE_ADULTO = 3;
const PRICE_BAMBINO = 2;
const PERMANENZA_MIN = 75;
const CAPACITA = 60;

let raw = [], rec = [], filteredRecords = [], aggregatedDaily = [], aggregatedHourly = [];

const pad2 = x => String(x).padStart(2,"0");
const toEur = n => Number(n).toFixed(2) + " €";
const isChild = s => (s||"").toLowerCase().includes("bamb");
const parseDate = (d,t="00:00")=>{const [Y,M,D]=d.split("-").map(Number); const [h,m]=t.split(":").map(Number); return new Date(Y,M-1,D,h,m);};

async function loadData(){
    raw = await (await fetch("clienti.json")).json();
    rec = raw.map((r,i)=>({
        idx:i,
        id:r.id ?? i+1,
        data:r.data,
        orario:r.orario||"00:00",
        dt:parseDate(r.data,r.orario||"00:00"),
        hour:(r.orario||"00:00").split(":")[0]|0,
        isChild:isChild(r.descrizione),
        price:isChild(r.descrizione)?PRICE_BAMBINO:PRICE_ADULTO
    })).filter(r=>r.data);

    const dates = [...new Set(rec.map(r=>r.data))].sort();
    if(dates.length){
        document.getElementById("start-date").value=dates[0];
        document.getElementById("end-date").value=dates[dates.length-1];
    }
    bindUI();
    applyFilters();
}

/* FILTRI */
function getFilters(){
    return {
        start: document.getElementById("start-date").value,
        end: document.getElementById("end-date").value,
        tipo: document.getElementById("filter-type").value
    };
}

function applyFilters(){
    const f = getFilters();
    const start = f.start? new Date(f.start) : null;
    const end = f.end? new Date(f.end) : null;

    filteredRecords = rec.filter(r=>{
        const inDate = (!start || r.dt >= start) && (!end || r.dt <= end);
        const inType = f.tipo==="all" || (f.tipo==="adulti"? !r.isChild : r.isChild);
        return inDate && inType;
    });

    aggregatedDaily = aggregateDaily(filteredRecords);
    const hourlyFiltered = filteredRecords.filter(r=>r.hour>=9 && r.hour<=17);
    aggregatedHourly = aggregateHourly(hourlyFiltered);
    renderAll();
}

/* AGGREGAZIONI */
function aggregateDaily(records){
    const map = new Map();
    records.forEach(r=>{
        if(!map.has(r.data)) map.set(r.data,{date:r.data,n:0,adulti:0,bambini:0,revenue:0});
        const d = map.get(r.data);
        d.n++;
        r.isChild? d.bambini++ : d.adulti++;
        d.revenue+=r.price;
    });
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function aggregateHourly(records){
    const dates = [...new Set(records.map(r=>r.data))];
    const matrix = {};
    dates.forEach(d=>{
        matrix[d]=Array.from({length:24},(_,h)=>({hour:h,adulti:0,bambini:0,totale:0,revenue:0}));
    });
    records.forEach(r=>{
        const row = matrix[r.data][r.hour];
        r.isChild? row.bambini++ : row.adulti++;
        row.totale++;
        row.revenue+=r.price;
    });

    const summary = [];
    for(let h=9;h<=17;h++){
        const totalArrivals = dates.reduce((s,d)=>s+matrix[d][h].totale,0);
        const totalAdulti = dates.reduce((s,d)=>s+matrix[d][h].adulti,0);
        const totalBamb = dates.reduce((s,d)=>s+matrix[d][h].bambini,0);
        const totalRev = dates.reduce((s,d)=>s+matrix[d][h].revenue,0);
        summary.push({hour:h,totalArrivals,totalAdulti,totalBamb,totalRev});
    }
    return {dates,matrix,summary};
}

/* KPI */
function computeKPIs(){
    const totClients = filteredRecords.length;
    const totRevenue = filteredRecords.reduce((s,r)=>s+r.price,0);
    const avgPerClient = totClients? (totRevenue/totClients).toFixed(2):"0.00";
    const avgPerDay = aggregatedDaily.length? (aggregatedDaily.reduce((s,d)=>s+d.n,0)/aggregatedDaily.length).toFixed(2):"0.00";

    const peakHour = aggregatedHourly.summary.reduce((max,h)=>h.totalArrivals>max.totalArrivals?h:max,{hour:-1,totalArrivals:0});
    const saturation = CAPACITA? Math.round(peakHour.totalArrivals/CAPACITA*100) :0;
    const preds = aggregatedHourly.summary.map(h=>h.totalArrivals/aggregatedDaily.length||0);
    return {totClients,totRevenue,avgPerClient,avgPerDay,peakHour,peakHourStr: peakHour.hour>=0? pad2(peakHour.hour)+":00 ("+peakHour.totalArrivals+" clienti)" : "-",saturation,preds};
}

/* RENDER */
function renderKPIs(){
    const k=computeKPIs();
    document.getElementById("kpi-total").textContent=k.totClients;
    document.getElementById("kpi-revenue").textContent=toEur(k.totRevenue);
    document.getElementById("kpi-revenue-per-client").textContent=toEur(Number(k.avgPerClient));
    document.getElementById("kpi-avg").textContent=k.avgPerDay;
    document.getElementById("kpi-peak").textContent=k.peakHourStr;
    document.getElementById("kpi-saturation").textContent=k.saturation+"%";
    document.getElementById("kpi-predict").textContent=k.preds.map((v,i)=>`${pad2(i+9)}:00→${Math.round(v)}`).join(", ");
}

function renderHourlyTable(){
    const tbody=document.querySelector("#hourly-table tbody");
    tbody.innerHTML="";
    aggregatedHourly.summary.forEach(h=>{
        const pred = Math.round(h.totalArrivals/aggregatedDaily.length||0);
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${pad2(h.hour)}:00</td><td>${h.totalAdulti}</td><td>${h.totalBamb}</td><td>${h.totalArrivals}</td><td>${toEur(h.totalRev)}</td><td>${pred}</td>`;
        tbody.appendChild(tr);
    });
    const top = [...aggregatedHourly.summary].sort((a,b)=>b.totalArrivals-a.totalArrivals).slice(0,8)
        .map((r,i)=>`${i+1}. ${pad2(r.hour)}:00 — ${r.totalArrivals}`).join("<br/>");
    document.getElementById("top-hours-list").innerHTML=top;
}

function renderOccupancy(){
    const buckets = new Map();
    filteredRecords.forEach(r=>{
        const start=r.dt.getTime();
        const end=start+PERMANENZA_MIN*60*1000;
        for(let t=start;t<end;t+=5*60*1000){
            const dt=new Date(t);
            const key=`${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
            buckets.set(key,(buckets.get(key)||0)+1);
        }
    });
    const keys=[...buckets.keys()].sort();
    const counts=keys.map(k=>buckets.get(k));
    Plotly.newPlot("chart-occupancy",[{
        x:keys,y:counts,type:"scatter",mode:"lines",name:"Occupazione stimata",line:{shape:"spline"}
    }],{title:"Occupazione stimata 9-17",
        shapes:[{type:"line",x0:keys[0],x1:keys[keys.length-1],y0:CAPACITA,y1:CAPACITA,line:{color:'red',dash:'dash'}}],
        yaxis:{range:[0,Math.max(CAPACITA,...counts)+5]}
    });
}

function renderTrend(){
    const x=aggregatedDaily.map(d=>d.date);
    const y=aggregatedDaily.map(d=>d.n);
    Plotly.newPlot("chart-trend-daily",[{
        x,y,type:"scatter",mode:"lines+markers",name:"Clienti/giorno"
    }],{title:"Andamento giornaliero"});
}

function renderAll(){
    renderKPIs();
    renderHourlyTable();
    renderOccupancy();
    renderTrend();
}

/* UI */
function bindUI(){
    document.getElementById("apply-filters").addEventListener("click",applyFilters);
    document.getElementById("reset-filters").addEventListener("click",()=>{
        const dates=[...new Set(rec.map(r=>r.data))].sort();
        document.getElementById("start-date").value=dates[0];
        document.getElementById("end-date").value=dates[dates.length-1];
        document.getElementById("filter-type").value="all";
        applyFilters();
    });
    document.getElementById("recompute").addEventListener("click",applyFilters);
    document.getElementById("export-hourly").addEventListener("click",()=>exportCSV("hourly"));
    document.getElementById("export-daily").addEventListener("click",()=>exportCSV("daily"));

    document.querySelectorAll(".tab-btn").forEach(btn=>{
        btn.addEventListener("click",()=>{
            document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
            document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
            document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
        });
    });
}

/* EXPORT CSV */
function exportCSV(type){
    let body="";
    if(type==="hourly"){
        const header=["Ora","Adulti","Bambini","Totale","Incasso (€)","Previsti"];
        const rows = aggregatedHourly.summary.map(h=>[pad2(h.hour)+":00",h.totalAdulti,h.totalBamb,h.totalArrivals,h.totalRev.toFixed(2),Math.round(h.totalArrivals/aggregatedDaily.length||0)]);
        body=[header.join(","),...rows.map(r=>r.join(","))].join("\n");
        download("hourly.csv",body);
    } else {
        const header=["Data","Clienti","Adulti","Bambini","Incasso (€)"];
        const rows = aggregatedDaily.map(d=>[d.date,d.n,d.adulti,d.bambini,d.revenue.toFixed(2)]);
        body=[header.join(","),...rows.map(r=>r.join(","))].join("\n");
        download("daily.csv",body);
    }
}

function download(filename,text){
    const blob=new Blob([text],{type:'text/csv;charset=utf-8;'});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.setAttribute("download",filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded",loadData);
