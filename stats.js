let clientiStats = [];


async function caricaClientiStats() {
    try {
        const res = await fetch("clienti2.json");
        clientiStats = await res.json();
        popolaFiltri();
        calcolaStatistiche();
    } catch (err) {
        console.error("Errore caricamento dati clienti:", err);
    }
}

function popolaFiltri() {

    const yearSelect = document.getElementById("filter-year");
    const dateSelect = document.getElementById("filter-date");


    yearSelect.innerHTML =
        '<option value="all">Tutti gli anni</option>';

    dateSelect.innerHTML =
        '<option value="all">Tutte le date</option>';



    const anni = [...new Set(
        clientiStats
        .map(c => c.data?.substring(0,4))
        .filter(Boolean)
    )].sort();



    anni.forEach(anno=>{

        const option=document.createElement("option");

        option.value=anno;
        option.textContent=anno;

        yearSelect.appendChild(option);

    });



    const date=[...new Set(
        clientiStats
        .map(c=>c.data)
        .filter(Boolean)
    )].sort().reverse();



    date.forEach(d=>{

        const option=document.createElement("option");

        option.value=d;
        option.textContent=d;

        dateSelect.appendChild(option);

    });


    caricaMesi();

}
function caricaMesi(){

    const anno =
        document.getElementById("filter-year").value;


    const monthSelect =
        document.getElementById("filter-month");


    monthSelect.innerHTML =
        '<option value="all">Tutti i mesi</option>';



    const mesi=[...new Set(

        clientiStats
        .filter(c =>
            anno==="all" ||
            c.data.startsWith(anno)
        )
        .map(c=>c.data.substring(5,7))

    )].sort();



    mesi.forEach(m=>{

        const option=document.createElement("option");

        option.value=m;

        option.textContent =
            new Date(2000,m-1,1)
            .toLocaleString(
                "it-IT",
                {month:"long"}
            );


        monthSelect.appendChild(option);

    });

}

function calcolaStatistiche() {
    if (!clientiStats.length) return;

const annoSelezionato =
    document.getElementById("filter-year").value;


const meseSelezionato =
    document.getElementById("filter-month").value;


const dataSelezionata =
    document.getElementById("filter-date").value;



let datiFiltrati=[...clientiStats];



// FILTRO ANNO
if(annoSelezionato!=="all"){

    datiFiltrati =
    datiFiltrati.filter(c=>
        c.data.startsWith(annoSelezionato)
    );

}


// FILTRO MESE
if(meseSelezionato!=="all"){

    datiFiltrati =
    datiFiltrati.filter(c=>
        c.data.substring(5,7)===meseSelezionato
    );

}


// FILTRO DATA
if(dataSelezionata!=="all"){

    datiFiltrati =
    datiFiltrati.filter(c=>
        c.data===dataSelezionata
    );

}

if (!datiFiltrati.length) return;
    let adulti = 0, bambini = 0, incassoTotale = 0;
    let sommaMeteo = 0, countMeteo = 0;
    const perGiorno = {};
    const perOrario = {};

    datiFiltrati.forEach(c => {
        const isBambino = (c.descrizione || "").toLowerCase().includes("bamb");
        const prezzo = isBambino ? 2 : 3;
        incassoTotale += prezzo;
        if (isBambino) bambini++; else adulti++;

        // Meteo: solo se presente e valido
        if (c.meteo !== undefined && !isNaN(c.meteo)) {
            sommaMeteo += Number(c.meteo);
            countMeteo++;
        }

        // Giorno
        if (!perGiorno[c.data]) perGiorno[c.data] = { clienti: 0, incasso: 0 };
        perGiorno[c.data].clienti++;
        perGiorno[c.data].incasso += prezzo;

        // Orario arrotondato
        let [h, m] = (c.orario || "00:00").split(":").map(Number);
        m = m < 30 ? "00" : "30";
        const fascia = `${h.toString().padStart(2,"0")}:${m}`;
        if (!perOrario[fascia]) perOrario[fascia] = 0;
        perOrario[fascia]++;
    });

    const totaleClienti = adulti + bambini;
    const incassoMedioCliente = (totaleClienti ? incassoTotale / totaleClienti : 0).toFixed(2);
    const meteoMedio = countMeteo ? (sommaMeteo / countMeteo).toFixed(1) : "-";

    // Giorno con più clienti / incasso
    const giorni = Object.entries(perGiorno);
    const maxClientiGiorno = giorni.reduce((a,b)=> b[1].clienti > a[1].clienti ? b : a, [null,{clienti:0}]);
    const maxIncassoGiorno = giorni.reduce((a,b)=> b[1].incasso > a[1].incasso ? b : a, [null,{incasso:0}]);

    // Media clienti al giorno
    const mediaClientiGiorno = (giorni.length ? (totaleClienti / giorni.length).toFixed(2) : 0);

    // Orario con più clienti
    const maxOrario = Object.entries(perOrario).reduce((a,b)=> b[1] > a[1] ? b : a, ["00:00",0]);

    // Giorno della settimana migliore
    const giorniSettimana = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
    const perSettimana = {};
    datiFiltrati.forEach(c=>{
        const d = new Date(c.data);
        const giorno = giorniSettimana[d.getDay()];
        if (!perSettimana[giorno]) perSettimana[giorno] = 0;
        perSettimana[giorno]++;
    });
    const bestWeekday = Object.entries(perSettimana).reduce((a,b)=> b[1]>a[1]?b:a, ["-",0]);

    // Top 3 giorni per incasso
    const top3 = [...giorni].sort((a,b)=>b[1].incasso - a[1].incasso).slice(0,3);

    // Aggiorna DOM
    aggiornaStatsCards({
        adulti, bambini, totaleClienti, incassoTotale, incassoMedioCliente,
        maxClientiGiorno, maxIncassoGiorno, mediaClientiGiorno,
        maxOrario, bestWeekday, top3, meteoMedio
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

    // Meteo
    const liMeteo = document.getElementById("meteo");
liMeteo.textContent = stats.meteoMedio;
liMeteo.style.color = "#111";       // sempre nero
liMeteo.style.fontSize = "1.4rem";  // grande come le altre card
liMeteo.style.fontWeight = "700";
    meteoList.appendChild(liMeteo);
}

document.addEventListener("DOMContentLoaded", ()=>{

    caricaClientiStats();


    document
    .getElementById("filter-year")
    .addEventListener("change",()=>{

        caricaMesi();
        calcolaStatistiche();

    });



    document
    .getElementById("filter-month")
    .addEventListener("change",
        calcolaStatistiche
    );


    document
    .getElementById("filter-date")
    .addEventListener("change",
        calcolaStatistiche
    );

});
