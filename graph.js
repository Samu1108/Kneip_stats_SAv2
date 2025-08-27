let clientiGraph = [];

async function caricaClientiGraph() {
  const res = await fetch("clienti.json");
  clientiGraph = await res.json();
  if (!clientiGraph.length) return;

  // Popola tabella completa
  creaTabellaCompleta(clientiGraph);

  // Prepara dataset
  const perGiorno = {};
  const perSettimanaOrario = {};

  clientiGraph.forEach(c => {
    const isBambino = (c.descrizione||"").toLowerCase().includes("bamb");
    const prezzo = isBambino ? 2 : 3;
    const giorno = c.data;
    const orario = c.orario ? c.orario.slice(0,2) : "00";
    const weekday = new Date(c.data).toLocaleDateString("it-IT",{weekday:"short"});

    if (!perGiorno[giorno]) perGiorno[giorno] = {clienti:0, adulti:0, bambini:0, incasso:0};
    perGiorno[giorno].clienti++;
    if (isBambino) perGiorno[giorno].bambini++; else perGiorno[giorno].adulti++;
    perGiorno[giorno].incasso += prezzo;

    if (!perSettimanaOrario[weekday]) perSettimanaOrario[weekday] = {};
    if (!perSettimanaOrario[weekday][orario]) perSettimanaOrario[weekday][orario] = 0;
    perSettimanaOrario[weekday][orario]++;
  });

  const dati = Object.entries(perGiorno).map(([data,val])=>({data,...val}));

  // 1) Bar Clienti per Giorno
  Plotly.newPlot("chart-clienti-giorno", [{
    x: dati.map(d=>d.data),
    y: dati.map(d=>d.clienti),
    type:"bar",
    marker:{color:"#2563eb"}
  }], {title:"Clienti per Giorno"});

  // 2) Linea Incassi
  Plotly.newPlot("chart-incassi", [{
    x: dati.map(d=>d.data),
    y: dati.map(d=>d.incasso),
    type:"scatter",
    mode:"lines+markers",
    line:{shape:"spline", color:"#16a34a"}
  }], {title:"Incasso Giornaliero (€)"});

  // 3) Pie Adulti vs Bambini
  const totAdulti = dati.reduce((a,b)=>a+b.adulti,0);
  const totBambini = dati.reduce((a,b)=>a+b.bambini,0);
  Plotly.newPlot("chart-pie", [{
    values:[totAdulti,totBambini],
    labels:["Adulti","Bambini"],
    type:"pie"
  }], {title:"Distribuzione Clienti"});

  // 4) Stacked bar (Adulti + Bambini)
  Plotly.newPlot("chart-stacked", [
    {x:dati.map(d=>d.data), y:dati.map(d=>d.adulti), name:"Adulti", type:"bar"},
    {x:dati.map(d=>d.data), y:dati.map(d=>d.bambini), name:"Bambini", type:"bar"}
  ], {barmode:"stack", title:"Clienti per Giorno (Stacked)"});

  // 5) Heatmap GiornoSettimana vs Orario
  const weekdays = ["lun","mar","mer","gio","ven","sab","dom"];
  const hours = [...Array(24).keys()].map(h=>String(h).padStart(2,"0"));

  const z = weekdays.map(giorno =>
    hours.map(h => perSettimanaOrario[giorno]?.[h] || 0)
  );

  Plotly.newPlot("chart-heatmap", [{
    z, x:hours, y:weekdays,
    type:"heatmap",
    colorscale:"Blues"
  }], {title:"Clienti per Giorno/Orario"});
}

function creaTabellaCompleta(dati) {
  const table = document.getElementById("full-table");
  table.innerHTML = "";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Data","Orario","Descrizione"].forEach(h=>{
    const th=document.createElement("th"); th.textContent=h; headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  dati.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${r.data}</td>
      <td>${r.orario || "-"}</td>
      <td>${r.descrizione || "-"}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

document.addEventListener("DOMContentLoaded", caricaClientiGraph);
