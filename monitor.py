import os
import json
import time
import logging
import requests
import sys
import glob
from datetime import datetime
import zoneinfo # Necessario per gestire il fuso orario in modo robusto

# Configurazione Base
BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno"
DATA_DIR = "data"
DIRETTRICI_DIR = "direttrici"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

# Forza il fuso orario italiano
IT_TZ = zoneinfo.ZoneInfo("Europe/Rome")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def read_treni():
    treni = []
    direttrici_files = glob.glob(os.path.join(DIRETTRICI_DIR, "*.txt"))
    if not direttrici_files:
        logging.error(f"Nessun file trovato in {DIRETTRICI_DIR}.")
        return treni

    for file_path in direttrici_files:
        basename = os.path.basename(file_path)
        direttrice_nome, _ = os.path.splitext(basename)
        capolinea_list = []
        current_servizio = None
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            logging.error(f"Errore lettura file {file_path}: {e}")
            continue
            
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith("#"):
                if "NOME:" in line:
                    direttrice_nome = line.split("NOME:", 1)[1].strip()
                elif "CAPOLINEA:" in line:
                    caps_str = line.split("CAPOLINEA:", 1)[1].strip()
                    capolinea_list = [c.strip().upper() for c in caps_str.replace(",", " ").replace(";", " ").split() if c.strip()]
                elif "SERVIZIO:" in line:
                    current_servizio = line.split("SERVIZIO:", 1)[1].strip()
                continue
                
            numeri = line.replace(",", " ").replace(";", " ").split()
            for num_str in numeri:
                if not num_str.isdigit():
                    continue
                numero = int(num_str)
                servizio = current_servizio if current_servizio else direttrice_nome
                treni.append({
                    "direttrice": direttrice_nome,
                    "linea": servizio,
                    "numero": numero,
                    "capolinea": capolinea_list
                })
                
    return treni

def fetch_stazione_origine(numero):
    url = f"{BASE_URL}/cercaNumeroTrenoTrenoAutocomplete/{numero}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200 and r.text.strip():
            lines = r.text.strip().split("\n")
            if lines:
                parts = lines[0].split("|")
                if len(parts) == 2:
                    subparts = parts[1].split("-")
                    if len(subparts) >= 3:
                        return subparts[1], subparts[2]
        return None, None
    except Exception as e:
        logging.error(f"Errore autocomplete per {numero}: {e}")
        return None, None

def fetch_andamento_treno(codice_stazione, numero, timestamp):
    url = f"{BASE_URL}/andamentoTreno/{codice_stazione}/{numero}/{timestamp}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            if r.text.strip():
                return r.json()
            else:
                logging.warning(f"API ha risposto vuoto per treno {numero} (possibile ban o treno non ancora partito)")
        else:
            logging.error(f"Errore API {r.status_code} per treno {numero}")
        return None
    except Exception as e:
        logging.error(f"Errore andamento per {numero}: {e}")
        return None

def calcola_stato(api_data, linea, capolinea_attesi):
    provvedimento = api_data.get("provvedimento", 0)
    ritardo_attuale = api_data.get("ritardo", 0)
    origine = api_data.get("origine", "")
    destinazione = api_data.get("destinazione", "")
    fermate = api_data.get("fermate", [])
    
    ritardo_capolinea = 0
    fermate_raggiunte = [f for f in fermate if f.get("effettiva") is not None or f.get("ritardoArrivo", 0) > 0]
    
    if fermate_raggiunte:
        ultima = fermate_raggiunte[-1]
        ritardo_capolinea = ultima.get("ritardoArrivo", ultima.get("ritardoPartenza", ritardo_attuale))
    else:
        ritardo_capolinea = ritardo_attuale

    stato_calcolato = "REGOLARE"
    if provvedimento == 1:
        stato_calcolato = "SOPPRESSO"
    elif provvedimento == 2:
        stato_calcolato = "PARZ. SOPPRESSO"
    elif api_data.get("nonPartito", False):
        stato_calcolato = "INATTIVO"
    else:
        sub_desc = api_data.get("subTitle", "").upper()
        
        # Rileva fermate soppresse (actualFermataType == 3 o "3")
        has_suppressed_stops = any(f.get("actualFermataType") in [3, "3"] for f in fermate)
        last_stop_suppressed = len(fermate) > 0 and fermate[-1].get("actualFermataType") in [3, "3"]
        
        # Parole chiave testuali nei dettagli/note
        is_limitato_text = any(x in sub_desc for x in ["LIMITATO", "TERMINA"])
        is_soppresso_text = any(x in sub_desc for x in ["SOPPRESS", "CANCELLAT"])
        
        if last_stop_suppressed or is_limitato_text:
            stato_calcolato = "LIMITATO"
        elif has_suppressed_stops or is_soppresso_text:
            stato_calcolato = "PARZ. SOPPRESSO"
        elif capolinea_attesi and fermate:
             ult_fermata_prog = fermate[-1].get("stazione", "").upper()
             if all(cap not in ult_fermata_prog for cap in capolinea_attesi):
                 stato_calcolato = "LIMITATO"
                     
    if stato_calcolato == "REGOLARE" and ritardo_attuale > 0:
        stato_calcolato = "RITARDO"

    return {
        "stato": stato_calcolato,
        "ritardo_attuale": ritardo_attuale,
        "ritardo_capolinea": ritardo_capolinea,
        "origine": origine,
        "destinazione": destinazione,
        "orario_programmato": api_data.get("compOrarioPartenzaZeroEffettivo", ""),
        "note": api_data.get("subTitle", "")
    }

def merge_dati(old_data, new_scan, now_dt):
    timestamp_str = now_dt.strftime("%Y-%m-%dT%H:%M:%S")
    time_min = now_dt.strftime("%H:%M")
    
    non_ok_states = ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]

    if not old_data:
        is_critico = new_scan["ritardo_capolinea"] > 15 or new_scan["stato"] in non_ok_states
        return {
            "stato": new_scan["stato"],
            "critico": is_critico,
            "ritardo_attuale": new_scan["ritardo_attuale"],
            # FIX: picco del ritardo al capolinea, non dell'attuale intra-corsa
            "ritardo_picco": new_scan["ritardo_capolinea"],
            "ritardo_capolinea": new_scan["ritardo_capolinea"],
            "origine": new_scan["origine"],
            "destinazione": new_scan["destinazione"],
            "orario_programmato": new_scan["orario_programmato"],
            "note": new_scan["note"],
            "prima_rilevazione": timestamp_str,
            "ultima_rilevazione": timestamp_str,
            "scansioni": 1,
            "storico_ritardi": [{"ts": time_min, "rit": new_scan["ritardo_attuale"]}]
        }
    
    old_stato = old_data["stato"]

    if new_scan["stato"] in non_ok_states:
        # Stato grave è sempre irreversibile
        stato = new_scan["stato"]
    elif old_stato == "INATTIVO" and new_scan["stato"] != "INATTIVO":
        # Il treno era in attesa ed ora è partito: aggiorna lo stato
        stato = new_scan["stato"]
    elif old_stato in non_ok_states:
        # Stato grave precedente: mantienilo
        stato = old_stato
    else:
        # Per REGOLARE/RITARDO: non retrocedere mai a INATTIVO
        stato = new_scan["stato"] if new_scan["stato"] != "INATTIVO" else old_stato

    # FIX: il flag critico per stato grave è irreversibile, ma quello da ritardo
    # viene ricalcolato sulla base dello stato e del ritardo capolinea CORRENTE.
    # Questo evita che una lettura errata notturna blocchi il treno come critico
    # per tutta la giornata.
    stato_critico_irreversibile = old_data.get("critico", False) and old_stato in non_ok_states
    is_critico = stato_critico_irreversibile or new_scan["ritardo_capolinea"] > 15 or stato in non_ok_states

    ritardo_attuale = new_scan["ritardo_attuale"]
    # FIX: picco del ritardo al capolinea, non dell'attuale intra-corsa
    ritardo_picco = max(old_data.get("ritardo_picco", 0), new_scan["ritardo_capolinea"])
    
    storico = old_data.get("storico_ritardi", [])
    if not storico or storico[-1]["ts"] != time_min:
        storico.append({"ts": time_min, "rit": ritardo_attuale})
        
    return {
            "stato": stato,
            "critico": is_critico,
            "ritardo_attuale": ritardo_attuale,
            "ritardo_picco": ritardo_picco,
            "ritardo_capolinea": new_scan["ritardo_capolinea"],
            "origine": new_scan["origine"] or old_data["origine"],
            "destinazione": new_scan["destinazione"] or old_data["destinazione"],
            "orario_programmato": new_scan["orario_programmato"] or old_data["orario_programmato"],
            "note": new_scan["note"] or old_data["note"],
            "prima_rilevazione": old_data.get("prima_rilevazione", timestamp_str),
            "ultima_rilevazione": timestamp_str,
            "scansioni": old_data.get("scansioni", 0) + 1,
            "storico_ritardi": storico
    }

def main():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    treni_da_monitorare = read_treni()
    if not treni_da_monitorare:
        logging.error("Nessun treno da monitorare.")
        sys.exit(1)
        
    # Usa orario italiano per i log e scansioni
    now_it = datetime.now(IT_TZ)
    
    # Cache per gestire più database per data di partenza in un singolo run
    loaded_dbs = {}
    
    def get_db_data(date_str):
        if date_str in loaded_dbs:
            return loaded_dbs[date_str]
            
        db_file = os.path.join(DATA_DIR, f"database_totale_{date_str}.json")
        db_data = {"data": date_str, "ultima_scansione": now_it.isoformat(), "treni": {}}
        if os.path.exists(db_file):
            try:
                with open(db_file, "r", encoding="utf-8") as f:
                    db_data = json.load(f)
            except Exception as e:
                logging.error(f"Errore lettura {db_file}: {e}")
                
        db_data["ultima_scansione"] = now_it.isoformat()
        loaded_dbs[date_str] = db_data
        return db_data
            
    success_count = 0
            
    for item in treni_da_monitorare:
        linea, num = item["linea"], item["numero"]
        direttrice = item["direttrice"]
        capolinea_attesi = item["capolinea"]
        logging.info(f"Scansione {direttrice} - {linea} {num}...")
        
        cod_staz, ts = fetch_stazione_origine(num)
        if not cod_staz:
            continue
            
        # Determina la data di partenza reale del treno dal timestamp di origine
        try:
            dep_dt = datetime.fromtimestamp(int(ts) / 1000, tz=IT_TZ)
            dep_date_str = dep_dt.strftime("%Y-%m-%d")
        except Exception as e:
            logging.error(f"Errore conversione timestamp {ts} per treno {num}: {e}")
            continue
            
        api_data = fetch_andamento_treno(cod_staz, num, ts)
        if not api_data:
            continue
            
        parsed_data = calcola_stato(api_data, linea, capolinea_attesi)
        
        # Recupera il database specifico per la data di partenza
        db_data = get_db_data(dep_date_str)
        
        db_data["treni"][str(num)] = merge_dati(db_data["treni"].get(str(num)), parsed_data, now_it)
        db_data["treni"][str(num)].update({"direttrice": direttrice, "linea": linea, "numero": num})
        
        success_count += 1
        time.sleep(2) # Anti-ban

    if success_count == 0:
        logging.error("Zero treni aggiornati. Qualcosa non va con la connessione o le API.")
        sys.exit(1)

    # Scrivi tutti i database caricati e aggiornati
    for date_str, db_data in loaded_dbs.items():
        db_file = os.path.join(DATA_DIR, f"database_totale_{date_str}.json")
        try:
            with open(db_file, "w", encoding="utf-8") as f:
                json.dump(db_data, f, indent=2, ensure_ascii=False)
            logging.info(f"Database salvato: {db_file}")
        except Exception as e:
            logging.error(f"Errore scrittura {db_file}: {e}")
            
    logging.info(f"Completato: {success_count} treni aggiornati.")

if __name__ == "__main__":
    main()
