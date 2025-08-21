let clienti = [];

// Legge clienti.json
async function caricaClienti() {
    const res = await fetch("clienti.json");
    clienti = await res.json();
    caricaDate();
    aggiornaDati();
}

// Popola select date
function caricaDate() {
    const select = document.getElementById("filter-date");
    select.innerHTML = '<option value="all">Tutte le date</option>';
    const dates = [...new Set(clienti.map(c => c.data).filter(Boolean))].sort();
    dates.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
    });
}

// Applica filtri
function filtraClienti() {
    const date = document.getElementById("filter-date").value;
    const type = document.getElementById("filter-type").value;

    let dati = [...clienti];
    if (date !== "all") dati = dati.filter(c => c.data === date);

    return { dati, type };
}

// Calcola aggregati e fasce
function calcolaFasce(dati, type) {
    const fasce = {};
    dati.forEach(c => {
        let [h, m] = (c.orario || "00:00").split(":").map(Number);
        m = m < 30 ? 0 : 30;
        const fascia = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`;
        if (!fasce[fascia]) fasce[fascia] = { Adulti:0, Bambini:0 };
        if ((c.descrizione || "").toLowerCase().includes("bamb")) fasce[fascia].Bambini++;
        else fasce[fascia].Adulti++;
    });

    const result = [];
    let totaleAdulti=0, totaleBambini=0;
    Object.keys(fasce).sort().forEach(f => {
        const a = fasce[f].Adulti;
        const b = fasce[f].Bambini;
        totaleAdulti += a; totaleBambini += b;
        const row = { 
            "Fascia Oraria": f, 
            "Adulti": a, 
            "Bambini": b, 
            "Totale": a+b, 
            "Incasso Adulti": a*3, 
            "Incasso Bambini": b*2, 
            "Incasso Totale": a*3+b*2 
        };
        result.push(row);
    });

    result.push({ 
        "Fascia Oraria":"TOTALE", 
        "Adulti":totaleAdulti, 
        "Bambini":totaleBambini, 
        "Totale":totaleAdulti+totaleBambini,
        "Incasso Adulti":totaleAdulti*3, 
        "Incasso Bambini":totaleBambini*2, 
        "Incasso Totale":totaleAdulti*3+totaleBambini*2 
    });

    // Filtra tipo se necessario
    if (type==="adulti") return result.map(r=>({
        "Fascia Oraria": r["Fascia Oraria"], 
        "Adulti": r["Adulti"], 
        "Incasso Adulti": r["Incasso Adulti"]
    }));
    if (type==="bambini") return result.map(r=>({
        "Fascia Oraria": r["Fascia Oraria"], 
        "Bambini": r["Bambini"], 
        "Incasso Bambini": r["Incasso Bambini"]
    }));
    return result;
}

// Aggiorna cards
function aggiornaCards(dati) {
    const totale = dati.find(r=>r["Fascia Oraria"]==="TOTALE");
    document.querySelector("#card-adulti .value").textContent = totale ? totale.Adulti : 0;
    document.querySelector("#card-bambini .value").textContent = totale ? totale.Bambini : 0;
    document.querySelector("#card-totale .value").textContent = totale ? totale.Totale : 0;
    document.querySelector("#card-incasso .value").textContent = totale ? totale["Incasso Totale"] + " €" : "0 €";
}

// Aggiorna tabella
function aggiornaTabella(dati) {
    const tbody = document.querySelector("#client-table tbody");
    tbody.innerHTML = "";
    dati.forEach(r=>{
        const tr = document.createElement("tr");
        if(r["Fascia Oraria"]==="TOTALE") tr.classList.add("totale");
        Object.values(r).forEach(val=>{
            const td = document.createElement("td");
            td.textContent = typeof val==="number" && val>=0 && !String(val).includes('.') ? (val+" €") : val;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// Aggiorna grafici con Plotly
function aggiornaGrafici(dati) {
    const filtrati = dati.filter(r=>r["Fascia Oraria"]!=="TOTALE");
    const fasce = filtrati.map(r=>r["Fascia Oraria"]);
    const adulti = filtrati.map(r=>r.Adulti||0);
    const bambini = filtrati.map(r=>r.Bambini||0);

    // Bar
    Plotly.newPlot("bar-chart", [
        {x:fasce, y:adulti, type:"bar", name:"Adulti", marker:{color:"#1f77b4"}},
        {x:fasce, y:bambini, type:"bar", name:"Bambini", marker:{color:"#ff7f0e"}}
    ], {title:"Clienti per Fascia Oraria", height:500, barmode:"stack"});

    // Pie
    const totaleAdulti = adulti.reduce((a,b)=>a+b,0);
    const totaleBambini = bambini.reduce((a,b)=>a+b,0);
    Plotly.newPlot("pie-chart", [{values:[totaleAdulti,totaleBambini], labels:["Adulti","Bambini"], type:"pie", marker:{colors:["#1f77b4","#ff7f0e"]}}], {title:"Distribuzione Clienti", height:500});

    // Line
    Plotly.newPlot("line-chart", [
        {x:fasce, y:adulti, type:"scatter", mode:"lines+markers", name:"Adulti", line:{color:"#1f77b4"}},
        {x:fasce, y:bambini, type:"scatter", mode:"lines+markers", name:"Bambini", line:{color:"#ff7f0e"}}
    ], {title:"Andamento Clienti", height:500});
}

// Aggiorna tutto
function aggiornaDati() {
    const {dati, type} = filtraClienti();
    const fasce = calcolaFasce(dati,type);
    aggiornaCards(fasce);
    aggiornaTabella(fasce);
    aggiornaGrafici(fasce);
}

// Scarica PDF con firma
async function scaricaBackupPDF() {
    const { dati } = filtraClienti();  
    const numeroPersone = dati.length;
    
    // Calcola soldi guadagnati in base a descrizione
    const soldiGuadagnati = dati.reduce((sum, c) => {
        if ((c.descrizione || "").toLowerCase().includes("bamb")) return sum + 2;
        return sum + 3;
    }, 0);

    const oggi = new Date();
    const dataOggi = oggi.toLocaleDateString("it-IT"); 

    const dataFiltro = document.getElementById("filter-date").value;

    // Nome file dinamico
    let nomeFile;
    if (dataFiltro && dataFiltro !== "all") {
        nomeFile = `${dataFiltro}_kneip.pdf`;  
    } else {
        const gg = String(oggi.getDate()).padStart(2, "0");
        const mm = String(oggi.getMonth() + 1).padStart(2, "0");
        const aaaa = oggi.getFullYear();
        nomeFile = `${aaaa}-${mm}-${gg}_full_kneip.pdf`;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Backup Clienti", 105, 20, null, null, "center");

    doc.setFontSize(12);
    doc.text(`Numero di persone: ${numeroPersone}`, 20, 40);
    doc.text(`Soldi guadagnati: €${soldiGuadagnati}`, 20, 50);

    // Nel PDF scriviamo data effettiva del backup (oggi)
    doc.text(`Data download: ${dataOggi}`, 20, 60);

    let y = 80;
    dati.forEach((c, i) => {
        const spesa = (c.descrizione || "").toLowerCase().includes("bamb") ? 2 : 3;
        doc.text(`${i + 1}. ${c.id} - ${c.descrizione} - Spesa: €${spesa}`, 20, y);
        y += 7;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    // Firma e chiusura documento
    try {
        const img = await fetch('firma.png');
        if (img.ok) {
            const blob = await img.blob();
            const reader = new FileReader();
            reader.onload = function(e) {
                const firmaX = 20;
                doc.text(`Molveno (TN), ${dataOggi}`, firmaX, y + 20);
                doc.text("Samuele Sartori", firmaX, y + 30);
                doc.addImage(e.target.result, 'PNG', 5, y + 35, 60, 20);
                doc.save(nomeFile);
            };
            reader.readAsDataURL(blob);
        } else {
            doc.save(nomeFile);
        }
    } catch (e) {
        console.warn("Firma non caricata:", e);
        doc.save(nomeFile);
    }
}

// Eventi
document.addEventListener("DOMContentLoaded", ()=>{
    caricaClienti();
    document.getElementById("filter-date").addEventListener("change", aggiornaDati);
    document.getElementById("filter-type").addEventListener("change", aggiornaDati);
    document.getElementById("btn-apply").addEventListener("click", aggiornaDati);
    document.getElementById("btn-download").addEventListener("click", scaricaBackupPDF);
});
