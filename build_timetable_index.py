import os
import zipfile
import csv
import io
import json

zip_path = "trenord_gtfs.zip" if os.path.exists("trenord_gtfs.zip") else "monitor_treni/trenord_gtfs.zip"
output_dir = "data" if os.path.exists("trenord_gtfs.zip") else "monitor_treni/data"
os.makedirs(output_dir, exist_ok=True)

stops_map = {}
routes_map = {}
trips_map = {}
timetable = {}
timetable_compressed = {}
all_stations = set()

print("1. Loading GTFS data...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    # Read stops.txt
    with zip_ref.open("stops.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for row in reader:
            stop_id = row['stop_id']
            stop_name = row['stop_name'].strip()
            stops_map[stop_id] = stop_name
            all_stations.add(stop_name)

    # Read routes.txt
    with zip_ref.open("routes.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for row in reader:
            routes_map[row['route_id']] = row['route_short_name'].strip()

    # Read trips.txt
    with zip_ref.open("trips.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for row in reader:
            route_id = row['route_id']
            trip_short_name = row['trip_short_name'].strip()
            trip_id = row['trip_id']
            
            if route_id == 'Bus':
                continue
                
            line_name = routes_map.get(route_id, "")
            
            # Extract train number
            if " - " in trip_short_name:
                train_num = trip_short_name.split(" - ")[1].strip()
            else:
                train_num = trip_short_name
                
            if train_num.isdigit():
                trips_map[trip_id] = (train_num, line_name)

    # Read stop_times.txt
    print("2. Processing stop times...")
    with zip_ref.open("stop_times.txt") as f:
        reader = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))
        for row in reader:
            trip_id = row['trip_id']
            stop_id = row['stop_id']
            dep_time = row['departure_time'].strip()
            seq = int(row['stop_sequence'])
            
            if trip_id not in trips_map:
                continue
                
            train_num, line_name = trips_map[trip_id]
            stop_name = stops_map.get(stop_id)
            if not stop_name:
                continue
                
            # Popola timetable estesa e compressa
            if stop_name not in timetable:
                timetable[stop_name] = {}
                timetable_compressed[stop_name] = {}
                
            dep_hm = dep_time[:5]
            
            # Gestisci duplicati tenendo il percorso con sequenza minore
            if train_num in timetable[stop_name]:
                if seq < timetable[stop_name][train_num]["seq"]:
                    timetable[stop_name][train_num] = {
                        "seq": seq,
                        "dep": dep_hm,
                        "line": line_name
                    }
                    timetable_compressed[stop_name][train_num] = [seq, dep_hm, line_name]
            else:
                timetable[stop_name][train_num] = {
                    "seq": seq,
                    "dep": dep_hm,
                    "line": line_name
                }
                timetable_compressed[stop_name][train_num] = [seq, dep_hm, line_name]

# Salva file di indice
print(f"3. Saving files to {output_dir}...")
with open(os.path.join(output_dir, "orari_tratte.json"), "w", encoding="utf-8") as f:
    json.dump(timetable, f, ensure_ascii=False, indent=2)

with open(os.path.join(output_dir, "orari_tratte_compresso.json"), "w", encoding="utf-8") as f:
    json.dump(timetable_compressed, f, ensure_ascii=False) # Niente spazi o indentazioni per ridurre lo spazio

with open(os.path.join(output_dir, "stazioni.json"), "w", encoding="utf-8") as f:
    json.dump(sorted(list(all_stations)), f, ensure_ascii=False, indent=2)

print(f"Finished! Extended: {len(timetable)} stazioni. Compressed index built successfully.")
