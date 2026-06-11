import os
import glob
import shutil
from datetime import datetime

DATA_DIR = "data"
ARCHIVE_DIR = os.path.join(DATA_DIR, "archive")

def archive_old_data():
    if not os.path.exists(DATA_DIR):
        print("Cartella data non trovata.")
        return

    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)

    current_month = datetime.now().strftime("%Y-%m")
    
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    archived_count = 0
    
    for file_path in files:
        filename = os.path.basename(file_path)
        # Formato: database_totale_YYYY-MM-DD.json
        try:
            date_part = filename.replace("database_totale_", "").replace(".json", "")
            file_month = date_part[:7] # YYYY-MM
            
            if file_month < current_month:
                month_archive_dir = os.path.join(ARCHIVE_DIR, file_month)
                if not os.path.exists(month_archive_dir):
                    os.makedirs(month_archive_dir)
                    
                dest_path = os.path.join(month_archive_dir, filename)
                shutil.move(file_path, dest_path)
                archived_count += 1
                print(f"Archiviato: {filename} in {month_archive_dir}")
        except Exception as e:
            print(f"Errore durante l'archiviazione di {filename}: {e}")

    print(f"Archiviazione completata. {archived_count} file spostati.")
    clean_expired_archive()

def clean_expired_archive():
    if not os.path.exists(ARCHIVE_DIR):
        return

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

    deleted_count = 0
    if os.path.exists(ARCHIVE_DIR):
        for item in os.listdir(ARCHIVE_DIR):
            item_path = os.path.join(ARCHIVE_DIR, item)
            if os.path.isdir(item_path) and len(item) == 7 and item[4] == '-':
                try:
                    if item < cutoff_month:
                        print(f"Eliminazione archivio scaduto (>12 mesi): {item}")
                        shutil.rmtree(item_path)
                        deleted_count += 1
                except Exception as e:
                    print(f"Errore durante l'eliminazione dell'archivio {item}: {e}")

    print(f"Pulizia archivio completata. {deleted_count} cartelle rimosse.")

if __name__ == "__main__":
    archive_old_data()

