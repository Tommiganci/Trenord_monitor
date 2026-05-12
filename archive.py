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

if __name__ == "__main__":
    archive_old_data()
