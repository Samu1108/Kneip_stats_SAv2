let clientiStats = [];

// Carica dati
async function caricaClientiStats() {
    const res = await fetch("clienti.json");
    clientiStats = await res.json();
    calcolaStatistiche();
}

function calcolaStatistiche() {
    if (!clientiStats.length) return;

    // Totali
    let adulti = 0, bambini = 0, incassoTotale = 0;
    const perGiorno = {};
    const perOrario = {};

    clientiStats.forEach(c => {
        const isBambino = (c.descrizione || "").toLowerCase().includes("bamb");
        const prezzo = isBambino ? 2 : 3;
        incassoTotale += prezzo;
        if (isBambino) bambini++; else adulti++;

        // Giorno
        if (!perGiorno[c.data]) perGiorno[c.data] = { clienti: 0, incasso: 0 };
        perGiorno[c.data].clienti++;
        perGiorno[c.data].incasso += prezzo;

        // Orario arrotondato (es. 14:00 o 14:30)
        let [h, m] = (c.orario || "00:00").split(":").map(Number);
        m = m < 30 ? "00" : "30";
        const fascia = `${h.toString().padStart(2,"0")}:${m}`;
        if (!perOrario[fascia]) perOrario[fascia] = 0;
        perOrario[fascia]++;
    });

    const totaleClienti = adulti + bambini;
    const incassoMedioCliente = (incassoTotale / totaleClienti).toFixed(2);

    // Giorno con più clienti / incasso
    const giorni = Object.entries(perGiorno);
    const maxClientiGiorno = giorni.reduce((a,b)=> b[1].clienti > a[1].clienti ? b : a);
    const maxIncassoGiorno = giorni.reduce((a,b)=> b[1].incasso > a[1].incasso ? b : a);

    // Media clienti al giorno
    const mediaClientiGiorno = (totaleClienti / giorni.length).toFixed(2);

    // Orario con più clienti medi
    const maxOrario = Object.entries(perOrario).reduce((a,b)=> b[1] > a[1] ? b : a);

    // Giorno della settimana migliore
    const giorniSettimana = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
    const perSettimana = {};
    clientiStats.forEach(c=>{
        const d = new Date(c.data);
        const giorno = giorniSettimana[d.getDay()];
        if (!perSettimana[giorno]) perSettimana[giorno] = 0;
        perSettimana[giorno]++;
    });
    const bestWeekday = Object.entries(perSettimana).reduce((a,b)=> b[1]>a[1]?b:a);

    // Top 3 giorni per incasso
    const top3 = [...giorni].sort((a,b)=>b[1].incasso - a[1].incasso).slice(0,3);

    // Aggiorna DOM
    aggiornaStatsCards({
        adulti,bambini,totaleClienti,incassoTotale,incassoMedioCliente,
        maxClientiGiorno,maxIncassoGiorno,mediaClientiGiorno,
        maxOrario,bestWeekday,top3
    });
}

function aggiornaStatsCards(stats) {
    document.getElementById("stat-incasso-medio").textContent = stats.incassoMedioCliente + " €";
    document.getElementById("stat-totale-incasso").textContent = stats.incassoTotale + " €";
    document.getElementById("stat-adulti").textContent = stats.adulti;
    document.getElementById("stat-bambini").textContent = stats.bambini;
    document.getElementById("stat-max-clienti-giorno").textContent = `${stats.maxClientiGiorno[0]} (${stats.maxClientiGiorno[1].clienti} clienti)`;
    document.getElementById("stat-max-incasso-giorno").textContent = `${stats.maxIncassoGiorno[0]} (${stats.maxIncassoGiorno[1].incasso} €)`;
    document.getElementById("stat-media-clienti-giorno").textContent = stats.mediaClientiGiorno;
    document.getElementById("stat-orario-top").textContent = `${stats.maxOrario[0]} (${stats.maxOrario[1]} clienti)`;
    document.getElementById("stat-best-weekday").textContent = `${stats.bestWeekday[0]} (${stats.bestWeekday[1]} clienti)`;

    // Top 3
    const list = document.getElementById("stat-top3");
    list.innerHTML = "";
    stats.top3.forEach(([giorno, dati])=>{
        const li = document.createElement("li");
        li.textContent = `${giorno}: ${dati.incasso} €`;
        list.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", caricaClientiStats);
