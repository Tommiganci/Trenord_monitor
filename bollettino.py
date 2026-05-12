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
    
    # Dati oggi
    treni = data.get("treni", {})
    totale_treni = len(treni)
    treni_anomali = sum(1 for t in treni.values() if t.get("critico", False))
    disagio = (treni_anomali / totale_treni * 100) if totale_treni > 0 else 0
    
    # Dati mese
    m_data = get_monthly_data()
    m_totale = 0
    m_anomali = 0
    for d in m_data:
        m_treni = d.get("treni", {})
        m_totale += len(m_treni)
        m_anomali += sum(1 for t in m_treni.values() if t.get("critico", False))
    disagio_mese = (m_anomali / m_totale * 100) if m_totale > 0 else 0
    
    ultima_scansione = data.get("ultima_scansione", "")
    sorted_treni = sorted(treni.values(), key=lambda x: (x.get("linea", ""), x.get("numero", 0)))

    html_content = f"""<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bollettino Trenord S11 & RE80</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }}
        h1, h2, h3 {{ color: #ffffff; }}
        .container {{ max-width: 1000px; margin: 0 auto; }}
        .header-card {{ background-color: #1e1e1e; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 1px solid #333; }}
        .stats-grid {{ display: flex; justify-content: space-around; margin-top: 15px; }}
        .stat-box {{ text-align: center; }}
        .disagio {{ font-size: 2.5em; font-weight: bold; color: { '#ff5252' if disagio > 20 else '#ffb142' if disagio > 5 else '#33d9b2' }; }}
        .disagio-mese {{ font-size: 2.5em; font-weight: bold; color: { '#ff5252' if disagio_mese > 20 else '#ffb142' if disagio_mese > 5 else '#33d9b2' }; }}
        table {{ width: 100%; border-collapse: collapse; background-color: #1e1e1e; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }}
        th, td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #333; }}
        th {{ background-color: #2c2c2c; color: #fff; font-weight: 600; text-transform: uppercase; font-size: 0.9em; }}
        tr:hover {{ background-color: #2a2a2a; }}
        .critico {{ background-color: rgba(255, 82, 82, 0.1); border-left: 4px solid #ff5252; }}
        .regolare {{ border-left: 4px solid #33d9b2; }}
        .footer {{ text-align: center; margin-top: 30px; font-size: 0.8em; color: #888; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header-card">
            <h1>Bollettino Trenord (S11 & RE80)</h1>
            <p>Dati aggiornati al: <strong>{ultima_scansione}</strong></p>
            <div class="stats-grid">
                <div class="stat-box">
                    <p style="margin:0; color:#888;">Disagio Oggi</p>
                    <div class="disagio">{disagio:.1f}%</div>
                    <p style="margin:0; font-size:0.9em;">(Critici: {treni_anomali} / {totale_treni})</p>
                </div>
                <div class="stat-box">
                    <p style="margin:0; color:#888;">Disagio Mensile</p>
                    <div class="disagio-mese">{disagio_mese:.1f}%</div>
                    <p style="margin:0; font-size:0.9em;">(Critici: {m_anomali} / {m_totale})</p>
                </div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Treno</th>
                    <th>Stato</th>
                    <th>Rit. Attuale</th>
                    <th>Rit. Picco</th>
                    <th>Rit. Capolinea</th>
                    <th>Orario Prog.</th>
                    <th>Note</th>
                </tr>
            </thead>
            <tbody>
"""

    for t in sorted_treni:
        linea_num = f"{t.get('linea', '')} {t.get('numero', '')}"
        stato = t.get("stato", "REGOLARE")
        critico = t.get("critico", False)
        
        row_class = "critico" if critico else "regolare"
        if stato == "INATTIVO":
            row_class = ""
            
        emoji = get_emoji_stato(stato, critico)
        
        note = t.get('note', '')
        if stato in ["SOPPRESSO", "PARZ. SOPPRESSO", "LIMITATO"]:
            note = f"<strong>{stato}</strong> {note}"

        html_content += f"""
                <tr class="{row_class}">
                    <td><strong>{linea_num}</strong></td>
                    <td>{emoji}</td>
                    <td>{t.get('ritardo_attuale', 0)}'</td>
                    <td>{t.get('ritardo_picco', 0)}'</td>
                    <td>{t.get('ritardo_capolinea', 0)}'</td>
                    <td>{t.get('orario_programmato', '')}</td>
                    <td>{note}</td>
                </tr>
"""

    html_content += """
            </tbody>
        </table>
        <div class="footer">
            Generato automaticamente da Trenord Monitor
        </div>
    </div>
</body>
</html>
"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"Esportazione HTML completata: {html_path}")

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
