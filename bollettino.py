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

    print(f"=== BOLLETTINO TRENORD (S11 & RE80) ===")
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

def get_monthly_data():
    if not os.path.exists(DATA_DIR):
        return []
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    current_month = datetime.now().strftime("%Y-%m")
    monthly_data = []
    for f in sorted(files):
        if current_month in f:
            with open(f, "r", encoding="utf-8") as file:
                monthly_data.append(json.load(file))
    return monthly_data

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

def export_html(data):
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)

    html_path = os.path.join(DOCS_DIR, "index.html")
    template_path = os.path.join("templates", "index.html")
    
    if not os.path.exists(template_path):
        print("Errore: template index.html non trovato!")
        return

    # Calcola statistiche mensili
    monthly_data = get_monthly_data()
    
    totale_treni = 0
    totale_anomali = 0
    trend = []
    
    for day_data in monthly_data:
        treni = day_data.get("treni", {})
        day_totale = len(treni)
        day_anomali = sum(1 for t in treni.values() if t.get("critico", False))
        
        totale_treni += day_totale
        totale_anomali += day_anomali
        
        day_disagio = (day_anomali / day_totale * 100) if day_totale > 0 else 0
        trend.append({
            "data": day_data.get("data", ""),
            "disagio": round(day_disagio, 1)
        })
        
    disagio_mese = (totale_anomali / totale_treni * 100) if totale_treni > 0 else 0
    
    monthly_stats = {
        "disagio": round(disagio_mese, 1),
        "treni_totali": totale_treni,
        "treni_anomali": totale_anomali,
        "giorni": len(monthly_data),
        "trend": trend
    }

    # Calcola storico treni
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

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    html = html.replace("const IS_STATIC = false;", "const IS_STATIC = true;")
    html = html.replace("const STATIC_DATA = null;", f"const STATIC_DATA = {json.dumps(data)};")
    html = html.replace("const STATIC_MONTHLY = null;", f"const STATIC_MONTHLY = {json.dumps(monthly_stats)};")
    html = html.replace("const STATIC_HISTORY = null;", f"const STATIC_HISTORY = {json.dumps(train_history)};")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    
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
