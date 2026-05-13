import os
import json
import time
import logging
import requests
import sys
from datetime import datetime
import zoneinfo # Necessario per gestire il fuso orario in modo robusto

# Configurazione Base
BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno"
DATA_DIR = "data"
TRENI_FILE = "treni.txt"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

# Forza il fuso orario italiano
IT_TZ = zoneinfo.ZoneInfo("Europe/Rome")

CAPOLINEA_ATTESI = {
    "S11": ["COMO", "RHO", "GARIBALDI", "CHIASSO", "CENTRALE"],
    "RE80": ["CHIASSO", "CENTRALE"]
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def read_treni():
    treni = []
    if not os.path.exists(TRENI_FILE):
        logging.error(f"File {TRENI_FILE} non trovato.")
        return treni

    with open(TRENI_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
            
        numeri = line.replace(",", " ").replace(";", " ").split()
        for num_str in numeri:
            if not num_str.isdigit():
                continue
            numero = int(num_str)
            if str(numero).startswith("255") or str(numero) == "25201":
                linea = "RE80"
            else:
                linea = "S11"
            treni.append({"linea": linea, "numero": numero})
            
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

def calcola_stato(api_data, linea):
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
        if any(x in sub_desc for x in ["LIMITATO", "TERMINA", "SOPPRESS"]):
             stato_calcolato = "PARZ. SOPPRESSO"
        elif linea in CAPOLINEA_ATTESI and fermate:
             ult_fermata_prog = fermate[-1].get("stazione", "").upper()
             if all(cap not in ult_fermata_prog for cap in CAPOLINEA_ATTESI[linea]):
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
    
    if not old_data:
        is_critico = new_scan["ritardo_capolinea"] > 15 or new_scan["stato"] in ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]
        return {
            "stato": new_scan["stato"],
            "critico": is_critico,
            "ritardo_attuale": new_scan["ritardo_attuale"],
            "ritardo_picco": new_scan["ritardo_attuale"],
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
    
    stato = new_scan["stato"] if new_scan["stato"] in ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"] else old_data["stato"]
    is_critico = old_data.get("critico", False) or new_scan["ritardo_capolinea"] > 15 or stato in ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]
        
    ritardo_attuale = new_scan["ritardo_attuale"]
    ritardo_picco = max(old_data.get("ritardo_picco", 0), ritardo_attuale)
    
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
        
    # Usa orario italiano per i nomi dei file e log
    now_it = datetime.now(IT_TZ)
    oggi_str = now_it.strftime("%Y-%m-%d")
    db_file = os.path.join(DATA_DIR, f"database_totale_{oggi_str}.json")
    
    db_data = {"data": oggi_str, "ultima_scansione": now_it.isoformat(), "treni": {}}
    if os.path.exists(db_file):
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                db_data = json.load(f)
        except Exception as e:
            logging.error(f"Errore lettura {db_file}: {e}")
            
    success_count = 0
            
    for item in treni_da_monitorare:
        linea, num = item["linea"], item["numero"]
        logging.info(f"Scansione {linea} {num}...")
        
        cod_staz, ts = fetch_stazione_origine(num)
        if not cod_staz:
            continue
            
        api_data = fetch_andamento_treno(cod_staz, num, ts)
        if not api_data:
            continue
            
        parsed_data = calcola_stato(api_data, linea)
        db_data["treni"][str(num)] = merge_dati(db_data["treni"].get(str(num)), parsed_data, now_it)
        db_data["treni"][str(num)].update({"linea": linea, "numero": num})
        
        success_count += 1
        time.sleep(2) # Anti-ban

    if success_count == 0:
        logging.error("Zero treni aggiornati. Qualcosa non va con la connessione o le API.")
        sys.exit(1)

    with open(db_file, "w", encoding="utf-8") as f:
        json.dump(db_data, f, indent=2, ensure_ascii=False)
            
    logging.info(f"Completato: {success_count} treni aggiornati.")

if __name__ == "__main__":
    main()
