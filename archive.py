import os
import glob
import json
import shutil
from datetime import datetime

DATA_DIR = "data"
REGISTRO_PATH = os.path.join(DATA_DIR, "registro_storico.json")

def archive_old_data():
    if not os.path.exists(DATA_DIR):
        print("Cartella data non trovata.")
        return

    # 1. Carica o inizializza il registro storico
    if os.path.exists(REGISTRO_PATH):
        try:
            with open(REGISTRO_PATH, "r", encoding="utf-8") as f:
                registro_db = json.load(f)
            if "mappatura_treni" not in registro_db or "registro" not in registro_db:
                registro_db = {"mappatura_treni": {}, "registro": {}}
        except Exception as e:
            print(f"Errore lettura registro storico: {e}")
            registro_db = {"mappatura_treni": {}, "registro": {}}
    else:
        registro_db = {"mappatura_treni": {}, "registro": {}}

    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"Data corrente locale: {today_str}")

    # 2. Cerca i file database_totale_*.json nella cartella data
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    consolidated_count = 0

    for file_path in sorted(files):
        filename = os.path.basename(file_path)
        try:
            date_str = filename.replace("database_totale_", "").replace(".json", "")
            # Se il file è di un giorno precedente a oggi, consolidalo nel registro storico
            if date_str < today_str:
                print(f"Consolidamento di {filename} nel registro storico...")
                with open(file_path, "r", encoding="utf-8") as f:
                    day_db = json.load(f)

                day_summary = {}
                for num_str, t in day_db.get("treni", {}).items():
                    # Aggiorna la mappatura del treno a livello di radice
                    if num_str not in registro_db["mappatura_treni"] or not registro_db["mappatura_treni"][num_str].get("direttrice"):
                        registro_db["mappatura_treni"][num_str] = {
                            "direttrice": t.get("direttrice", ""),
                            "linea": t.get("linea", "")
                        }

                    # Salva solo i dati di stato e ritardo per la giornata
                    day_summary[num_str] = {
                        "r": t.get("ritardo_capolinea", 0),
                        "c": t.get("critico", False),
                        "s": t.get("stato", "REGOLARE")
                    }

                registro_db["registro"][date_str] = day_summary
                consolidated_count += 1
                
                # Rimuovi il file giornaliero consolidato
                os.remove(file_path)
                print(f"Consolidato ed eliminato file di dati: {filename}")
        except Exception as e:
            print(f"Errore durante il consolidamento di {filename}: {e}")

    # 3. Pulisci i dati più vecchi di 12 mesi rolling nel registro
    clean_expired_archive(registro_db)

    # 4. Salva il registro storico aggiornato
    if consolidated_count > 0 or len(registro_db.get("registro", {})) > 0:
        try:
            with open(REGISTRO_PATH, "w", encoding="utf-8") as f:
                json.dump(registro_db, f, indent=2, ensure_ascii=False)
            print(f"Registro storico salvato con successo. Consolidate {consolidated_count} nuove giornate.")
        except Exception as e:
            print(f"Errore durante il salvataggio del registro storico: {e}")

def clean_expired_archive(registro_db):
    now = datetime.now()
    year = now.year
    month = now.month

    # Conserviamo al massimo 12 mesi totali (il mese corrente attivo + gli ultimi 11 mesi archiviati)
    target_month = month - 11
    target_year = year
    while target_month <= 0:
        target_month += 12
        target_year -= 1

    cutoff_month = f"{target_year:04d}-{target_month:02d}"
    print(f"Mese limite di conservazione (ultimo anno): {cutoff_month}")

    # Rimuovi le giornate più vecchie di cutoff_month
    registro = registro_db.get("registro", {})
    expired_dates = [d for d in list(registro.keys()) if d < cutoff_month]
    
    for date_str in expired_dates:
        print(f"Eliminazione registro scaduto (>12 mesi): {date_str}")
        del registro[date_str]

    # Pulisci la mappatura treni per rimuovere i treni non più referenziati da nessuna giornata
    if expired_dates:
        referenced_trains = set()
        for day_summary in registro.values():
            referenced_trains.update(day_summary.keys())
        
        mappatura = registro_db.get("mappatura_treni", {})
        original_count = len(mappatura)
        registro_db["mappatura_treni"] = {
            k: v for k, v in mappatura.items() if k in referenced_trains
        }
        cleaned_count = original_count - len(registro_db["mappatura_treni"])
        if cleaned_count > 0:
            print(f"Mappature obsolete rimosse dalla tabella treni: {cleaned_count}")

if __name__ == "__main__":
    archive_old_data()
