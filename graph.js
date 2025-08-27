// === DATI DI ESEMPIO ===
// Orari della giornata
const orari = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// Dati per ogni orario
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
  let thead = "<tr><th>Orario</th><th>Bambini</th><th>Adulti</th><th>Totale</th><th>Incasso Bambini (€)</th><th>Incasso Adulti (€)</th><th>Incasso Totale (€)</th></tr>";

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

  table.innerHTML = thead + rows;
}
creaTabella();

// === GRAFICI ===

// 1. Clienti per Orario
Plotly.newPlot("chart-clienti-orario", [
  { x: orari, y: bambini, type:"bar", name:"Bambini" },
  { x: orari, y: adulti, type:"bar", name:"Adulti" }
], { barmode:"stack", title:"Clienti per Orario" });

// 2. Incassi per Orario
Plotly.newPlot("chart-incassi-orario", [
  { x: orari, y: incassoBambini, type:"bar", name:"Incasso Bambini" },
  { x: orari, y: incassoAdulti, type:"bar", name:"Incasso Adulti" }
], { barmode:"stack", title:"Incassi per Orario (€)" });

// 3. Pie Chart Adulti vs Bambini
Plotly.newPlot("chart-pie", [{
  labels:["Bambini","Adulti"],
  values:[bambini.reduce((a,b)=>a+b,0), adulti.reduce((a,b)=>a+b,0)],
  type:"pie"
}], { title:"Distribuzione Clienti" });

// 4. Linea andamento
Plotly.newPlot("chart-linea", [
  { x: orari, y: bambini, mode:"lines+markers", name:"Bambini" },
  { x: orari, y: adulti, mode:"lines+markers", name:"Adulti" }
], { title:"Andamento Clienti per Orario" });

// 5. Heatmap Orari vs Tipo Cliente
Plotly.newPlot("chart-heatmap", [{
  z: [bambini, adulti],
  x: orari,
  y: ["Bambini","Adulti"],
  type:"heatmap",
  colorscale:"Blues"
}], { title:"Heatmap Clienti per Orario" });
