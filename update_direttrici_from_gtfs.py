import os
import zipfile
import csv
import io
import re
import glob

# Configurazione percorsi
ZIP_PATH = "trenord_gtfs.zip"
INPUT_DIR = "direttrici"
OUTPUT_DIR = "direttrici_test_output"

def load_gtfs_data(zip_path):
    routes = {}
    trip_origins = {}
    train_mappings = {} # (service_name, train_num) -> origin_stop_id
    
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"File ZIP GTFS non trovato in: {zip_path}")
        
    print(f"Caricamento dati GTFS da {zip_path}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # 1. Carica routes
        print(" - Lettura routes.txt...")
        with zip_ref.open("routes.txt") as f:
            text_stream = io.TextIOWrapper(f, encoding='utf-8')
            reader = csv.DictReader(text_stream)
            for row in reader:
                routes[row['route_id']] = row['route_short_name'].strip()
                
        # 2. Carica stop_times per trovare le origini di ciascun trip
        print(" - Lettura stop_times.txt (questo potrebbe richiedere qualche secondo)...")
        with zip_ref.open("stop_times.txt") as f:
            text_stream = io.TextIOWrapper(f, encoding='utf-8')
            reader = csv.DictReader(text_stream)
            for row in reader:
                tid = row['trip_id']
                sid = row['stop_id']
                seq = int(row['stop_sequence'])
                
                if tid not in trip_origins:
                    trip_origins[tid] = (sid, seq)
                else:
                    current_sid, current_seq = trip_origins[tid]
                    if seq < current_seq:
                        trip_origins[tid] = (sid, seq)
                        
        # 3. Carica trips ed estrai i treni
        print(" - Lettura trips.txt...")
        with zip_ref.open("trips.txt") as f:
            text_stream = io.TextIOWrapper(f, encoding='utf-8')
            reader = csv.DictReader(text_stream)
            for row in reader:
                route_id = row['route_id']
                trip_short_name = row['trip_short_name'].strip()
                trip_id = row['trip_id']
                
                if route_id == 'Bus':
                    continue
                    
                service_name = routes.get(route_id)
                if not service_name:
                    continue
                    
                # Estrazione numero treno (es. "RE_11 - 2153" -> "2153")
                if " - " in trip_short_name:
                    parts = trip_short_name.split(" - ")
                    train_num = parts[1].strip()
                else:
                    train_num = trip_short_name
                    
                if not train_num.isdigit():
                    continue
                    
                origin_info = trip_origins.get(trip_id)
                if origin_info:
                    origin_stop_id = origin_info[0]
                    train_mappings[(service_name, train_num)] = origin_stop_id
                    
    print(f"GTFS caricato con successo. Trovati {len(train_mappings)} accoppiamenti unici (Servizio, Numero) -> Origine.")
    return train_mappings

# Mappatura dei servizi personalizzati ai nomi dei servizi GTFS
SERVICE_MAPPING = {
    'S34': 'S31',
    'R32': 'R25'
}

def get_train_lines(service_name, train_mappings):
    # Estrae e organizza i treni per un determinato servizio
    # Se il servizio ha un mapping custom, usa quello, altrimenti usa il nome originale
    gtfs_service_name = SERVICE_MAPPING.get(service_name, service_name)
    trains = [f"{num}-{orig}" for (s, num), orig in train_mappings.items() if s == gtfs_service_name]
    if not trains:
        return []
        
    odds = []
    evens = []
    for t in trains:
        num_part = t.split('-')[0]
        if int(num_part) % 2 == 1:
            odds.append(t)
        else:
            evens.append(t)
            
    # Ordinamento numerico basato sul numero del treno
    odds.sort(key=lambda x: int(x.split('-')[0]))
    evens.sort(key=lambda x: int(x.split('-')[0]))
    
    res = []
    if odds:
        res.append(", ".join(odds) + "\n")
    if evens:
        res.append(", ".join(evens) + "\n")
        
    return res

def main():
    try:
        train_mappings = load_gtfs_data(ZIP_PATH)
    except Exception as e:
        print(f"Errore fatale nel caricamento GTFS: {e}")
        return
        
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Creata cartella di output temporanea: {OUTPUT_DIR}")
        
    input_files = sorted(glob.glob(os.path.join(INPUT_DIR, "*.txt")))
    if not input_files:
        print(f"Nessun file .txt trovato nella cartella {INPUT_DIR}.")
        return
        
    print(f"\nInizio elaborazione dei file delle direttrici...")
    
    stats_updated = []
    
    for file_path in input_files:
        filename = os.path.basename(file_path)
        output_file_path = os.path.join(OUTPUT_DIR, filename)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        in_service_block = False
        service_name = None
        updated_services = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Se incontriamo un blocco servizio
            if stripped.startswith('# SERVIZIO:'):
                new_lines.append(line)
                in_service_block = True
                service_name = stripped.split('SERVIZIO:', 1)[1].strip()
                
                # Ottieni i treni dal GTFS per questo servizio
                train_lines = get_train_lines(service_name, train_mappings)
                if train_lines:
                    new_lines.append("\n") # Riga vuota prima della lista
                    for tl in train_lines:
                        new_lines.append(tl)
                        new_lines.append("\n") # Riga vuota dopo ciascuna direzione
                    updated_services.append((service_name, sum(len(tl.split(',')) for tl in train_lines)))
                else:
                    # Se non ci sono treni nel GTFS, rimetti delle righe vuote placeholder
                    new_lines.append("\n\n\n")
                    updated_services.append((service_name, 0))
                    
                i += 1
                # Salta le righe dei treni originali fino al prossimo commento o fine file
                while i < len(lines):
                    next_stripped = lines[i].strip()
                    if next_stripped.startswith('#'):
                        break
                    i += 1
                continue
                
            # Se incontriamo un commento generico (non SERVIZIO)
            if stripped.startswith('#') and not stripped.startswith('# SERVIZIO:'):
                in_service_block = False
                new_lines.append(line)
                i += 1
                continue
                
            # Se siamo dentro un blocco servizio ma la riga non è un commento, la saltiamo (è già stata sostituita)
            if in_service_block:
                i += 1
            else:
                # Altrimenti copiamo la riga così com'è (es. capolinea, nome, ecc.)
                new_lines.append(line)
                i += 1
                
        # Scrivi il file nella cartella temporanea
        with open(output_file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        if updated_services:
            stats_updated.append((filename, updated_services))
            
    print("\n=== RESOCONTO ELABORAZIONE (SALVATO IN DIRETTRICI_TEST_OUTPUT/) ===")
    for fname, services in stats_updated:
        services_str = ", ".join([f"{s} ({count} treni)" for s, count in services])
        print(f" - {fname}: {services_str}")
        
    print(f"\nElaborazione completata con successo! I nuovi file si trovano in '{OUTPUT_DIR}/'.")
    print("Controlla che i file siano corretti prima di copiarli nella cartella ufficiale.")

if __name__ == "__main__":
    main()
