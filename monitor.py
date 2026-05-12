import os
import json
import time
import logging
import requests
from datetime import datetime

# Configurazione Base
BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno"
DATA_DIR = "data"
TRENI_FILE = "treni.txt"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Configurazioni Capolinea per rilevamento Soppressioni Parziali
CAPOLINEA_ATTESI = {
    "S11": ["COMO", "RHO", "GARIBALDI", "CHIASSO", "CENTRALE"],
    "RE80": ["CHIASSO", "CENTRALE"]
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def read_treni():
    """Legge il file treni.txt e restituisce una lista di dict con linea e numero."""
    treni = []
    if not os.path.exists(TRENI_FILE):
        logging.warning(f"File {TRENI_FILE} non trovato. Ritorno lista vuota.")
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
            # Regola semplice per assegnare la linea
            if str(numero).startswith("255") or str(numero) == "25201":
                linea = "RE80"
            else:
                linea = "S11"
            treni.append({"linea": linea, "numero": numero})
            
    return treni

def fetch_stazione_origine(numero):
    """Chiama cercaNumeroTrenoTrenoAutocomplete per ottenere codice stazione origine e timestamp base."""
    url = f"{BASE_URL}/cercaNumeroTrenoTrenoAutocomplete/{numero}"
    for _ in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200 and r.text.strip():
                # Esempio risposta: "25001 - COMO SAN GIOVANNI|25001-S01700-1747267200000"
                # Può restituire più righe, prendiamo la prima
                lines = r.text.strip().split("\n")
                if lines:
                    parts = lines[0].split("|")
                    if len(parts) == 2:
                        # 25001-S01700-1747267200000
                        subparts = parts[1].split("-")
                        if len(subparts) >= 3:
                            return subparts[1], subparts[2] # codice_stazione, timestamp
            return None, None
        except Exception as e:
            logging.error(f"Errore autocomplete per {numero}: {e}")
            time.sleep(2)
    return None, None

def fetch_andamento_treno(codice_stazione, numero, timestamp):
    """Ottiene lo stato in tempo reale."""
    url = f"{BASE_URL}/andamentoTreno/{codice_stazione}/{numero}/{timestamp}"
    for _ in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                try:
                    # In alcune occasioni viaggiaTreno restituisce stringa vuota o non-JSON
                    if r.text.strip():
                        return r.json()
                except ValueError:
                    return None
            return None
        except Exception as e:
            logging.error(f"Errore andamento per {numero}: {e}")
            time.sleep(2)
    return None

def calcola_stato(api_data, linea):
    """Elabora il JSON API e restituisce il ritardo e lo stato calcolato."""
    
    # 1. Estrazione Base
    provvedimento = api_data.get("provvedimento", 0)
    ritardo_attuale = api_data.get("ritardo", 0)
    
    origine = api_data.get("origine", "")
    destinazione = api_data.get("destinazione", "")
    fermate = api_data.get("fermate", [])
    
    # Valuta fermata capolinea per ritardo al capolinea
    # Prendi l'ultima fermata effettivamente raggiunta ("A" arrivo, o "P" se è arrivato e ripartito, ma per capolinea cerchiamo actualFermataType)
    # L'API dice actualFermataType=1 per arrivo? Oppure ha ritardoArrivo
    ritardo_capolinea = 0
    fermate_raggiunte = [f for f in fermate if f.get("effettiva") != None or f.get("ritardoArrivo", 0) > 0]
    
    if fermate_raggiunte:
        # ritardo all'ultima fermata nota
        ultima = fermate_raggiunte[-1]
        ritardo_capolinea = ultima.get("ritardoArrivo", ultima.get("ritardoPartenza", ritardo_attuale))
    else:
        # se non ci sono fermate raggiunte, usiamo l'attuale (che potrebbe essere 0 se non è partito)
        ritardo_capolinea = ritardo_attuale

    # 2. Rilevamento Stato
    stato_calcolato = "REGOLARE"
    if api_data.get("nonPartito", False) or (not fermate_raggiunte and ritardo_attuale == 0 and not api_data.get("stazioneUltimoRilevamento")):
        stato_calcolato = "INATTIVO"
    elif provvedimento == 1:
        stato_calcolato = "SOPPRESSO"
    elif provvedimento == 2:
        stato_calcolato = "PARZ. SOPPRESSO"
    else:
        # Controlliamo la parola LIMITATO / TERMINA nei campi
        sub_desc = api_data.get("subTitle", "").upper()
        if "LIMITATO" in sub_desc or "TERMINA" in sub_desc or "SOPPRESS" in sub_desc:
             stato_calcolato = "PARZ. SOPPRESSO"
        else:
             # Controllo capolinea mancanti se abbiamo i dati per la linea
             if linea in CAPOLINEA_ATTESI and fermate:
                 ult_fermata_prog = fermate[-1].get("stazione", "").upper()
                 # Se l'ultima fermata programmata non è nei capolinea attesi
                 cap_attesi = CAPOLINEA_ATTESI[linea]
                 if non_trovato(ult_fermata_prog, cap_attesi):
                     stato_calcolato = "LIMITATO"
                     
    # Se il ritardo capolinea > 15 e non è soppresso, è CRITICO
    # Ma "CRITICO" lo indichiamo come boolean, lo stato testuale rimane REGOLARE o RITARDO
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

def non_trovato(fermata, lista_attesi):
    for att in lista_attesi:
        if att in fermata or fermata in att:
            return False
    return True

def merge_dati(old_data, new_scan, data_str, timestamp_str):
    """Fonde i dati vecchi con i nuovi mantenendo il peggiore stato e aggiornando i ritardi."""
    
    if not old_data:
        # Prima scansione per questo treno oggi
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
            "storico_ritardi": [{"ts": timestamp_str[11:16], "rit": new_scan["ritardo_attuale"]}]
        }
    
    # Aggiornamento: Regole da piano
    # Lo stato NON_OK è irreversibile
    stato = old_data["stato"]
    non_ok_states = ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]
    
    if stato not in non_ok_states and new_scan["stato"] in non_ok_states:
        stato = new_scan["stato"]
        
    # Calcolo se è critico
    is_critico = old_data.get("critico", False)
    if new_scan["ritardo_capolinea"] > 15 or stato in non_ok_states:
        is_critico = True
        
    ritardo_attuale = new_scan["ritardo_attuale"]
    ritardo_picco = max(old_data.get("ritardo_picco", 0), ritardo_attuale)
    ritardo_capolinea = new_scan["ritardo_capolinea"]
    
    storico = old_data.get("storico_ritardi", [])
    current_time = timestamp_str[11:16]
    
    # Aggiungi a storico solo se è cambiato il minuto, o al massimo una volta per ogni run
    if not storico or storico[-1]["ts"] != current_time:
        storico.append({"ts": current_time, "rit": ritardo_attuale})
        
    return {
            "stato": stato,
            "critico": is_critico,
            "ritardo_attuale": ritardo_attuale,
            "ritardo_picco": ritardo_picco,
            "ritardo_capolinea": ritardo_capolinea,
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
        logging.error("Nessun treno da monitorare. Crea treni.txt nel formato 'S11 25001'.")
        return
        
    oggi_str = datetime.now().strftime("%Y-%m-%d")
    now_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    db_file = os.path.join(DATA_DIR, f"database_totale_{oggi_str}.json")
    
    db_data = {"data": oggi_str, "ultima_scansione": now_str, "treni": {}}
    if os.path.exists(db_file):
        try:
            with open(db_file, "r", encoding="utf-8") as f:
                db_data = json.load(f)
        except Exception as e:
            logging.error(f"Errore lettura {db_file}: {e}")
            
    db_data["ultima_scansione"] = now_str
            
    for item in treni_da_monitorare:
        linea = item["linea"]
        num = item["numero"]
        
        logging.info(f"Scansione treno {linea} {num}...")
        cod_staz, ts = fetch_stazione_origine(num)
        
        if not cod_staz:
            logging.warning(f"Treno {num} non trovato in autocomplete. Salto.")
            time.sleep(1)
            continue
            
        api_data = fetch_andamento_treno(cod_staz, num, ts)
        if not api_data:
            logging.warning(f"Nessun dato andamento per {num}. Salto.")
            time.sleep(1)
            continue
            
        parsed_data = calcola_stato(api_data, linea)
        
        treno_key = str(num)
        old_data = db_data["treni"].get(treno_key)
        
        new_merged = merge_dati(old_data, parsed_data, oggi_str, now_str)
        new_merged["linea"] = linea
        new_merged["numero"] = num
        
        db_data["treni"][treno_key] = new_merged
        
        # Salvataggio incrementale
        with open(db_file, "w", encoding="utf-8") as f:
            json.dump(db_data, f, indent=2, ensure_ascii=False)
            
        time.sleep(1.5) # Anti-ban

    logging.info(f"Monitoraggio completato. Dati salvati in {db_file}")

if __name__ == "__main__":
    main()
