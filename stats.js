let clienti = [];

async function caricaClienti() {
    const res = await fetch("clienti.json");
    clienti = await res.json();
    calcolaStatisticheAvanzate();
}

function calcolaStatisticheAvanzate() {
    if (clienti.length === 0) return;

    // Incasso totale e medio
    const incassi = clienti.map(c =>
        (c.descrizione || "").toLowerCase().includes("bamb") ? 2 : 3
    );
    const totale = incassi.reduce((a,b)=>a+b,0);
    const medio = (totale / incassi.length).toFixed(2);

    document.getElementById("avg-incasso").textContent = medio + " €";

    // Giorno con più clienti
    const perGiorno = {};
    clienti.forEach(c => {
        if (!perGiorno[c.data]) perGiorno[c.data] = 0;
        perGiorno[c.data]++;
    });
    const bestDay = Object.entries(perGiorno).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById("best-day").textContent = bestDay ? `${bestDay[0]} (${bestDay[1]} clienti)` : "-";

    // Ora di punta
    const perOra = {};
    clienti.forEach(c => {
        let [h] = (c.orario || "00:00").split(":");
        if (!perOra[h]) perOra[h] = 0;
        perOra[h]++;
    });
    const peak = Object.entries(perOra).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById("peak-hour").textContent = peak ? `${peak[0]}:00 (${peak[1]} clienti)` : "-";

    // Grafico Heatmap Giorni/Ore
    const giorni = [...new Set(clienti.map(c=>c.data))].sort();
    const ore = [...new Set(clienti.map(c=>(c.orario||"00:00").split(":")[0]))].sort();
    const z = giorni.map(g => ore.map(o =>
        clienti.filter(c=>c.data===g && c.orario.startsWith(o)).length
    ));

    Plotly.newPlot("heatmap-chart", [{
        z, x: ore, y: giorni, type: "heatmap", colorscale:"YlOrRd"
    }], {title:"Affluenza Giorni / Ore", height:500});

    // Trend incassi nel tempo
    const incassiGiornalieri = giorni.map(g =>
        clienti.filter(c=>c.data===g).reduce((s,c)=> s+((c.descrizione||"").toLowerCase().includes("bamb")?2:3),0)
    );
    Plotly.newPlot("trend-chart", [{
        x: giorni, y: incassiGiornalieri, type:"scatter", mode:"lines+markers", line:{color:"#2ca02c"}
    }], {title:"Andamento Incassi Giornalieri", height:500});

    // Scatter clienti vs incasso
    Plotly.newPlot("scatter-chart", [{
        x: incassi, y: clienti.map((c,i)=>i+1), mode:"markers", type:"scatter", marker:{size:8, color:"#1f77b4"}
    }], {title:"Distribuzione Incassi per Cliente", height:500});
}

document.addEventListener("DOMContentLoaded", caricaClienti);
