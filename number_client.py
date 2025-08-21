import json
import firebase_admin
from firebase_admin import credentials, firestore

# Inizializza Firebase
cred = credentials.Certificate("C:/Users/sarto/OneDrive/Desktop/kneip/independence/vecchio_ma_statico/backup_clienti.json/serviceAccountKey.json")
# scarica la tua chiave JSON dal Firebase Console
firebase_admin.initialize_app(cred)

db = firestore.client()

# Funzione per esportare la collezione "clienti" in clienti.json
def export_clienti():
    conferma = input("Vuoi scaricare tutti i clienti e sovrascrivere clienti.json? (s/n): ")
    if conferma.lower() != 's':
        print("Operazione annullata.")
        return

    try:
        clienti_ref = db.collection("clienti")
        docs = clienti_ref.stream()

        items = []
        for doc in docs:
            items.append({"id": doc.id, **doc.to_dict()})

        with open("clienti.json", "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

        print(f"Esportazione completata: {len(items)} clienti salvati in 'clienti.json'.")
    except Exception as e:
        print("Errore durante l'export:", e)

# Funzione esistente per contare i clienti
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

# Esegui esportazione e conta
export_clienti()
conta_clienti("clienti.json")
