// === DATI DI ESEMPIO ===
const orari = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const bambini = [5, 8, 12, 9, 6, 7, 10, 8, 12, 5];
const adulti  = [10, 12, 15, 20, 14, 18, 16, 22, 19, 12];
const prezzoBambino = 5;
const prezzoAdulto = 10;

// Calcoli
const totale = bambini.map((b,i) => b + adulti[i]);
const incassoBambini = bambini.map(b => b * prezzoBambino);
const incassoAdulti  = adulti.map(a => a * prezzoAdulto);
const incassoTotale  = totale.map((t,i) => incassoBambini[i] + incassoAdulti[i]);

// === TABELLA ===
function creaTabella() {
  const table = document.getElementById("orari-table");

  // Intestazione
  let thead = `<tr>
    <th>Orario</th>
    <th>Bambini</th>
    <th>Adulti</th>
    <th>Totale</th>
    <th>Incasso Bambini (€)</th>
    <th>Incasso Adulti (€)</th>
    <th>Incasso Totale (€)</th>
  </tr>`;

  // Righe
  let rows = orari.map((ora,i) => 
    `<tr>
      <td>${ora}</td>
      <td>${bambini[i]}</td>
      <td>${adulti[i]}</td>
      <td>${totale[i]}</td>
      <td>${incassoBambini[i]}</td>
      <td>${incassoAdulti[i]}</td>
      <td>${incassoTotale[i]}</td>
    </tr>`
  ).join("");

  // Totale generale
  const totaleBambini = bambini.reduce((a,b)=>a+b,0);
  const totaleAdulti = adulti.reduce((a,b)=>a+b,0);
  const totaleClienti = totale.reduce((a,b)=>a+b,0);
  const totaleIncassoBambini = incassoBambini.reduce((a,b)=>a+b,0);
  const totaleIncassoAdulti = incassoAdulti.reduce((a,b)=>a+b,0);
  const totaleIncassoTotale = incassoTotale.reduce((a,b)=>a+b,0);

  rows += `<tr class="totale">
    <td>TOTALE</td>
    <td>${totaleBambini}</td>
    <td>${totaleAdulti}</td>
    <td>${totaleBambini + totaleAdulti}</td>
    <td>${totaleIncassoBambini}</td>
    <td>${totaleIncassoAdulti}</td>
    <td>${totaleIncassoTotale}</td>
  </tr>`;

  table.innerHTML = thead + rows;
}
creaTabella();

// === GRAFICI ===
const chartHeight = 1000;

// 1. Clienti per Orario
Plotly.newPlot("chart-clienti-orario", [
  { x: orari, y: bambini, type:"bar", name:"Bambini", marker:{color:"#ff7f0e"} },
  { x: orari, y: adulti, type:"bar", name:"Adulti", marker:{color:"#1f77b4"} }
], { barmode:"stack", title:"Clienti per Orario", height:chartHeight });

// 2. Incassi per Orario
Plotly.newPlot("chart-incassi-orario", [
  { x: orari, y: incassoBambini, type:"bar", name:"Incasso Bambini", marker:{color:"#ff7f0e"} },
  { x: orari, y: incassoAdulti, type:"bar", name:"Incasso Adulti", marker:{color:"#1f77b4"} }
], { barmode:"stack", title:"Incassi per Orario (€)", height:chartHeight });

// 3. Pie Chart Adulti vs Bambini
Plotly.newPlot("chart-pie", [{
  labels:["Bambini","Adulti"],
  values:[bambini.reduce((a,b)=>a+b,0), adulti.reduce((a,b)=>a+b,0)],
  type:"pie",
  marker:{colors:["#ff7f0e","#1f77b4"]}
}], { title:"Distribuzione Clienti", height:chartHeight });

// 4. Linea andamento
Plotly.newPlot("chart-linea", [
  { x: orari, y: bambini, mode:"lines+markers", name:"Bambini", line:{color:"#ff7f0e"} },
  { x: orari, y: adulti, mode:"lines+markers", name:"Adulti", line:{color:"#1f77b4"} }
], { title:"Andamento Clienti per Orario", height:chartHeight });

// 5. Heatmap Orari vs Tipo Cliente
Plotly.newPlot("chart-heatmap", [{
  z: [bambini, adulti],
  x: orari,
  y: ["Bambini","Adulti"],
  type:"heatmap",
  colorscale:"Blues"
}], { title:"Heatmap Clienti per Orario", height:chartHeight });
