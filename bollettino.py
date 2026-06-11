import os
import json
import argparse
import glob
import sys
import io
from datetime import datetime

# Fix per l'encoding su Windows Terminal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DATA_DIR = "data"
DOCS_DIR = "docs"

def load_latest_data():
    if not os.path.exists(DATA_DIR):
        return None
    
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    if not files:
        return None
    
    # Sort by name (which includes date) to get the latest
    latest_file = sorted(files)[-1]
    
    with open(latest_file, "r", encoding="utf-8") as f:
        return json.load(f)

def get_emoji_stato(stato, critico):
    if stato == "REGOLARE":
        return "✅"
    elif stato == "INATTIVO":
        return "⏳"
    elif stato == "RITARDO" and not critico:
        return "⚠️"
    elif stato == "RITARDO" and critico:
        return "🚨"
    else:
        # SOPPRESSO, LIMITATO, ecc.
        return "❌"

def print_bollettino(data):
    treni = data.get("treni", {})
    if not treni:
        print("Nessun dato disponibile.")
        return

    print(f"=== BOLLETTINO TRENORD ===")
    print(f"Data: {data.get('data')} - Ultimo aggiornamento: {data.get('ultima_scansione')}\n")

    # Header
    print(f"{'TRENO':<12} | {'ST'} | {'RIT. ATT.':<9} | {'RIT. PICCO':<10} | {'RIT. CAP.':<9} | {'ORARIO PROG.':<12} | {'NOTE'}")
    print("-" * 85)

    totale_treni = len(treni)
    treni_anomali = 0

    # Ordiniamo i treni per linea e numero
    sorted_treni = sorted(treni.values(), key=lambda x: (x.get("linea", ""), x.get("numero", 0)))

    for t in sorted_treni:
        linea_num = f"{t.get('linea', '')} {t.get('numero', '')}"
        stato = t.get("stato", "REGOLARE")
        critico = t.get("critico", False)
        
        if critico:
            treni_anomali += 1

        emoji = get_emoji_stato(stato, critico)
        rit_att = f"{t.get('ritardo_attuale', 0)}'"
        rit_picco = f"{t.get('ritardo_picco', 0)}'"
        rit_cap = f"{t.get('ritardo_capolinea', 0)}'"
        prog = t.get('orario_programmato', '')
        note = t.get('note', '')
        
        if stato in ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]:
            note = f"{stato} - {note}"
        
        # Troncate note per formattazione
        if len(note) > 30:
            note = note[:27] + "..."

        print(f"{linea_num:<12} | {emoji} | {rit_att:<9} | {rit_picco:<10} | {rit_cap:<9} | {prog:<12} | {note}")

    print("-" * 85)
    disagio = (treni_anomali / totale_treni * 100) if totale_treni > 0 else 0
    print(f"\nTreni Totali: {totale_treni} | Treni Anomali (Critici): {treni_anomali}")
    print(f"GRADO DI DISAGIO: {disagio:.1f}%\n")

REGISTRO_PATH = os.path.join(DATA_DIR, "registro_storico.json")

def load_reconstructed_history(filter_month=None):
    """
    Carica lo storico completo ricostruendo i dizionari dei giorni passati 
    dal registro storico, combinandoli con il file giornaliero corrente in data/.
    """
    all_data = []
    
    # 1. Carica dal registro storico
    mappatura = {}
    registro = {}
    if os.path.exists(REGISTRO_PATH):
        try:
            with open(REGISTRO_PATH, "r", encoding="utf-8") as f:
                db = json.load(f)
                mappatura = db.get("mappatura_treni", {})
                registro = db.get("registro", {})
        except Exception as e:
            print(f"Errore lettura registro storico: {e}")

    for date_str, trains_data in sorted(registro.items()):
        if filter_month and not date_str.startswith(filter_month):
            continue
            
        day_dict = {
            "data": date_str,
            "treni": {}
        }
        for num_str, t in trains_data.items():
            t_info = mappatura.get(num_str, {})
            day_dict["treni"][num_str] = {
                "critico": t.get("c", False),
                "ritardo_capolinea": t.get("r", 0),
                "stato": t.get("s", "REGOLARE"),
                "direttrice": t_info.get("direttrice", ""),
                "linea": t_info.get("linea", ""),
                "numero": int(num_str)
            }
        all_data.append(day_dict)
        
    # 2. Carica i file giornalieri correnti presenti in data/ (es. oggi)
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    for file_path in sorted(files):
        filename = os.path.basename(file_path)
        date_str = filename.replace("database_totale_", "").replace(".json", "")
        
        # Evita duplicati se il giorno è già consolidato nello storico
        if date_str in registro:
            continue
            
        if filter_month and not date_str.startswith(filter_month):
            continue
            
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                day_db = json.load(f)
                
            cleaned_db = {
                "data": date_str,
                "treni": {}
            }
            for num_str, t in day_db.get("treni", {}).items():
                cleaned_db["treni"][num_str] = {
                    "critico": t.get("critico", False),
                    "ritardo_capolinea": t.get("ritardo_capolinea", 0),
                    "stato": t.get("stato", "REGOLARE"),
                    "direttrice": t.get("direttrice", ""),
                    "linea": t.get("linea", ""),
                    "numero": int(num_str)
                }
            all_data.append(cleaned_db)
        except Exception as e:
            print(f"Errore lettura file corrente {filename}: {e}")
            
    return sorted(all_data, key=lambda x: x["data"])

def get_monthly_data():
    """Legge i dati del mese corrente."""
    current_month = datetime.now().strftime("%Y-%m")
    return load_reconstructed_history(filter_month=current_month)

def get_all_data():
    """Legge tutti i file storici disponibili."""
    return load_reconstructed_history()

def compute_monthly_aggregates(all_data):
    """Raggruppa i dati giornalieri per mese e calcola gli indici aggregati."""
    mesi = {}
    for day_data in all_data:
        data_str = day_data.get("data", "")
        if not data_str or len(data_str) < 7:
            continue
        mese_key = data_str[:7]  # YYYY-MM
        treni = day_data.get("treni", {})
        day_tot = len(treni)
        day_an = sum(1 for t in treni.values() if t.get("critico", False))
        if mese_key not in mesi:
            mesi[mese_key] = {"treni_totali": 0, "treni_anomali": 0, "giorni": 0}
        mesi[mese_key]["treni_totali"] += day_tot
        mesi[mese_key]["treni_anomali"] += day_an
        mesi[mese_key]["giorni"] += 1

    result = []
    for mese_key, stats in sorted(mesi.items(), reverse=True):
        tot = stats["treni_totali"]
        an = stats["treni_anomali"]
        disagio = round((an / tot * 100) if tot > 0 else 0, 1)
        result.append({
            "data": mese_key,
            "treni_totali": tot,
            "treni_anomali": an,
            "giorni": stats["giorni"],
            "disagio": disagio
        })
    return result

def print_monthly_report():
    monthly_data = get_monthly_data()
    if not monthly_data:
        print("Nessun dato disponibile per questo mese.")
        return
        
    totale_treni = 0
    totale_anomali = 0
    
    print(f"=== REPORT MENSILE TRENORD ({datetime.now().strftime('%Y-%m')}) ===")
    
    for day_data in monthly_data:
        treni = day_data.get("treni", {})
        t_tot = len(treni)
        t_an = sum(1 for t in treni.values() if t.get("critico", False))
        totale_treni += t_tot
        totale_anomali += t_an
        print(f"Data: {day_data.get('data')} | Treni: {t_tot} | Anomali: {t_an}")
        
    disagio = (totale_anomali / totale_treni * 100) if totale_treni > 0 else 0
    print("-" * 40)
    print(f"TOTALE MESE: {totale_treni} treni monitorati")
    print(f"TOTALE ANOMALI: {totale_anomali} treni")
    print(f"GRADO DI DISAGIO MENSILE: {disagio:.1f}%")

def load_treno_direttrice_mapping():
    mapping = {}
    import glob
    direttrici_files = glob.glob(os.path.join("direttrici", "*.txt"))
    for file_path in direttrici_files:
        basename = os.path.basename(file_path)
        direttrice_nome, _ = os.path.splitext(basename)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception:
            continue
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                if "NOME:" in line:
                    direttrice_nome = line.split("NOME:", 1)[1].strip()
                continue
            numeri = line.replace(",", " ").replace(";", " ").split()
            for num_str in numeri:
                clean_num = num_str.split("-")[0]
                if clean_num.isdigit():
                    mapping[clean_num] = direttrice_nome
    return mapping

def export_html(data):
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)

    html_path = os.path.join(DOCS_DIR, "index.html")
    template_path = os.path.join("templates", "index.html")
    
    if not os.path.exists(template_path):
        print("Errore: template index.html non trovato!")
        return

    mapping = load_treno_direttrice_mapping()
    direttrici = set(mapping.values())

    monthly_data = get_monthly_data()
    all_data = get_all_data()

    static_monthly = {}
    static_daily_trend = {}

    # Calcolo statistiche complessive per "Tutto Trenord" (Indice IVOL)
    totale_treni_tot = 0
    totale_anomali_tot = 0
    trend_tot = []
    
    for day_data in monthly_data:
        treni = day_data.get("treni", {})
        day_totale = len(treni)
        day_anomali = sum(1 for t in treni.values() if t.get("critico", False))
        
        totale_treni_tot += day_totale
        totale_anomali_tot += day_anomali
        
        day_disagio = (day_anomali / day_totale * 100) if day_totale > 0 else 0
        trend_tot.append({
            "data": day_data.get("data", ""),
            "disagio": round(day_disagio, 1),
            "treni_totali": day_totale,
            "treni_anomali": day_anomali
        })
        
    disagio_mese_tot = (totale_anomali_tot / totale_treni_tot * 100) if totale_treni_tot > 0 else 0
    static_monthly["Tutto Trenord"] = {
        "disagio": round(disagio_mese_tot, 1),
        "treni_totali": totale_treni_tot,
        "treni_anomali": totale_anomali_tot,
        "giorni": len(monthly_data),
        "trend": trend_tot
    }

    # Calcola storico mensile aggregato complessivo (mese per mese)
    mesi_tot = {}
    for day_data in all_data:
        data_str = day_data.get("data", "")
        if not data_str or len(data_str) < 7:
            continue
        mese_key = data_str[:7]
        treni = day_data.get("treni", {})
        day_tot = len(treni)
        day_an = sum(1 for t in treni.values() if t.get("critico", False))
        
        if mese_key not in mesi_tot:
            mesi_tot[mese_key] = {"treni_totali": 0, "treni_anomali": 0, "giorni": 0}
        mesi_tot[mese_key]["treni_totali"] += day_tot
        mesi_tot[mese_key]["treni_anomali"] += day_an
        mesi_tot[mese_key]["giorni"] += 1
        
    aggregates_tot = []
    for mese_key, stats in sorted(mesi_tot.items(), reverse=True):
        tot = stats["treni_totali"]
        an = stats["treni_anomali"]
        disagio = round((an / tot * 100) if tot > 0 else 0, 1)
        aggregates_tot.append({
            "data": mese_key,
            "treni_totali": tot,
            "treni_anomali": an,
            "giorni": stats["giorni"],
            "disagio": disagio
        })
    static_daily_trend["Tutto Trenord"] = aggregates_tot

    for d_name in direttrici:
        totale_treni = 0
        totale_anomali = 0
        trend = []
        
        for day_data in monthly_data:
            treni = day_data.get("treni", {})
            treni_filtered = {
                k: v for k, v in treni.items()
                if v.get("direttrice") == d_name or mapping.get(k) == d_name
            }
            day_totale = len(treni_filtered)
            day_anomali = sum(1 for t in treni_filtered.values() if t.get("critico", False))
            
            totale_treni += day_totale
            totale_anomali += day_anomali
            
            day_disagio = (day_anomali / day_totale * 100) if day_totale > 0 else 0
            trend.append({
                "data": day_data.get("data", ""),
                "disagio": round(day_disagio, 1),
                "treni_totali": day_totale,
                "treni_anomali": day_anomali
            })
            
        disagio_mese = (totale_anomali / totale_treni * 100) if totale_treni > 0 else 0
        static_monthly[d_name] = {
            "disagio": round(disagio_mese, 1),
            "treni_totali": totale_treni,
            "treni_anomali": totale_anomali,
            "giorni": len(monthly_data),
            "trend": trend
        }

        # Calcola storico mensile aggregato (mese per mese)
        mesi = {}
        for day_data in all_data:
            data_str = day_data.get("data", "")
            if not data_str or len(data_str) < 7:
                continue
            mese_key = data_str[:7]
            treni = day_data.get("treni", {})
            treni_filtered = {
                k: v for k, v in treni.items()
                if v.get("direttrice") == d_name or mapping.get(k) == d_name
            }
            day_tot = len(treni_filtered)
            day_an = sum(1 for t in treni_filtered.values() if t.get("critico", False))
            
            if mese_key not in mesi:
                mesi[mese_key] = {"treni_totali": 0, "treni_anomali": 0, "giorni": 0}
            mesi[mese_key]["treni_totali"] += day_tot
            mesi[mese_key]["treni_anomali"] += day_an
            mesi[mese_key]["giorni"] += 1
            
        aggregates = []
        for mese_key, stats in sorted(mesi.items(), reverse=True):
            tot = stats["treni_totali"]
            an = stats["treni_anomali"]
            disagio = round((an / tot * 100) if tot > 0 else 0, 1)
            aggregates.append({
                "data": mese_key,
                "treni_totali": tot,
                "treni_anomali": an,
                "giorni": stats["giorni"],
                "disagio": disagio
            })
        static_daily_trend[d_name] = aggregates

    # Calcola storico treni (solo il mese corrente)
    train_history = {}
    for day_data in monthly_data:
        date_str = day_data.get("data", "")
        for num_str, t in day_data.get("treni", {}).items():
            if num_str not in train_history:
                train_history[num_str] = []
            train_history[num_str].append({
                "data": date_str,
                "ritardo_capolinea": t.get("ritardo_capolinea", 0),
                "critico": t.get("critico", False),
                "stato": t.get("stato", "REGOLARE")
            })

    css_path = os.path.join("static", "css", "style.css")
    js_path = os.path.join("static", "js", "app.js")
    
    css_content = ""
    js_content = ""
    
    if os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()
            
    if os.path.exists(js_path):
        with open(js_path, "r", encoding="utf-8") as f:
            js_content = f.read()

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Inline di CSS e JS
    html = html.replace('<link rel="stylesheet" href="/static/css/style.css">', f'<style>\n{css_content}\n</style>')
    html = html.replace('<script src="/static/js/app.js"></script>', f'<script>\n{js_content}\n</script>')

    html = html.replace("const IS_STATIC = false;", "const IS_STATIC = true;")
    html = html.replace("const STATIC_DATA = null;", f"const STATIC_DATA = {json.dumps(data)};")
    html = html.replace("const STATIC_MONTHLY = null;", f"const STATIC_MONTHLY = {json.dumps(static_monthly)};")
    html = html.replace("const STATIC_HISTORY = null;", f"const STATIC_HISTORY = {json.dumps(train_history)};")
    html = html.replace("const STATIC_DAILY_TREND = null;", f"const STATIC_DAILY_TREND = {json.dumps(static_daily_trend)};")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    
    # Copia file PWA per l'esportazione statica
    import shutil
    try:
        shutil.copy(os.path.join("static", "manifest.json"), os.path.join(DOCS_DIR, "manifest.json"))
        shutil.copy(os.path.join("static", "js", "sw.js"), os.path.join(DOCS_DIR, "sw.js"))
        
        docs_icons_dir = os.path.join(DOCS_DIR, "static", "icons")
        if not os.path.exists(docs_icons_dir):
            os.makedirs(docs_icons_dir)
        shutil.copy(os.path.join("static", "icons", "icon-192.png"), os.path.join(docs_icons_dir, "icon-192.png"))
        shutil.copy(os.path.join("static", "icons", "icon-512.png"), os.path.join(docs_icons_dir, "icon-512.png"))
        
        # Copia i dati degli orari per la ricerca tratte statica
        docs_data_dir = os.path.join(DOCS_DIR, "data")
        if not os.path.exists(docs_data_dir):
            os.makedirs(docs_data_dir)
        shutil.copy(os.path.join("data", "stazioni.json"), os.path.join(docs_data_dir, "stazioni.json"))
        shutil.copy(os.path.join("data", "orari_tratte_compresso.json"), os.path.join(docs_data_dir, "orari_tratte_compresso.json"))
        
        print("Asset PWA e indici orari copiati con successo in docs/")
    except Exception as e:
        print(f"Avviso: Errore durante la copia degli asset PWA in docs: {e}")
        
    print(f"Esportazione HTML statica interattiva completata: {html_path}")

def main():
    parser = argparse.ArgumentParser(description="Bollettino Trenord")
    parser.add_argument("--export-html", action="store_true", help="Esporta i dati in formato HTML statico")
    parser.add_argument("--monthly", action="store_true", help="Stampa il report mensile aggregato")
    args = parser.parse_args()

    if args.monthly:
        print_monthly_report()
        return

    data = load_latest_data()
    if not data:
        print("Nessun dato disponibile. Esegui prima monitor.py.")
        return

    print_bollettino(data)
    
    if args.export_html:
        export_html(data)

if __name__ == "__main__":
    main()
