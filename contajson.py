import json

def conta_clienti(file_json):
    try:
        with open(file_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            print(f"Numero di clienti trovati: {len(data)}")
        else:
            print("Il file JSON non contiene una lista di clienti.")
    except Exception as e:
        print("Errore durante la lettura del file:", e)

# Esegui con il file esportato
conta_clienti("/home/sarto/Desktop/INDEPENDENCE/clienti.json")
