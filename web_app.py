import os
import glob
import json
from datetime import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DATA_DIR = "data"

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


def get_latest_data():
    if not os.path.exists(DATA_DIR):
        return None
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json")) + \
            glob.glob(os.path.join(DATA_DIR, "archive", "*", "database_totale_*.json"))
    if not files:
        return None
    latest_file = sorted(files)[-1]
    with open(latest_file, "r", encoding="utf-8") as f:
        return json.load(f)

def get_monthly_data():
    if not os.path.exists(DATA_DIR):
        return []
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json")) + \
            glob.glob(os.path.join(DATA_DIR, "archive", "*", "database_totale_*.json"))
    current_month = datetime.now().strftime("%Y-%m")
    monthly_data = []
    for f in sorted(files):
        if current_month in f:
            with open(f, "r", encoding="utf-8") as file:
                monthly_data.append(json.load(file))
    return monthly_data

def get_all_data():
    if not os.path.exists(DATA_DIR):
        return []
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json")) + \
            glob.glob(os.path.join(DATA_DIR, "archive", "*", "database_totale_*.json"))
    all_data = []
    for f in sorted(files):
        try:
            with open(f, "r", encoding="utf-8") as file:
                all_data.append(json.load(file))
        except Exception:
            continue
    return all_data

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/manifest.json")
def serve_manifest():
    return app.send_static_file("manifest.json")

@app.route("/sw.js")
def serve_sw():
    return app.send_static_file("js/sw.js")

@app.route("/api/data")
def api_data():
    data = get_latest_data()
    if data:
        return jsonify(data)
    return jsonify({"error": "Nessun dato disponibile"}), 404

@app.route("/api/historical_stats")
def api_historical_stats():
    direttrice_filter = request.args.get("direttrice")
    all_data = get_all_data()
    if not all_data:
        return jsonify([])
        
    mapping = load_treno_direttrice_mapping()
    
    mesi = {}
    for day_data in all_data:
        data_str = day_data.get("data", "")
        if not data_str or len(data_str) < 7:
            continue
        mese_key = data_str[:7]  # YYYY-MM
        treni = day_data.get("treni", {})
        
        if direttrice_filter:
            treni_filtered = {
                k: v for k, v in treni.items()
                if v.get("direttrice") == direttrice_filter or mapping.get(k) == direttrice_filter
            }
        else:
            treni_filtered = treni
            
        day_tot = len(treni_filtered)
        day_an = sum(1 for t in treni_filtered.values() if t.get("critico", False))
        
        if day_tot == 0:
            continue
            
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
    return jsonify(result)

@app.route("/api/monthly_stats")
def api_monthly_stats():
    direttrice_filter = request.args.get("direttrice")
    monthly_data = get_monthly_data()
    if not monthly_data:
        return jsonify({"disagio": 0, "treni_totali": 0, "treni_anomali": 0, "giorni": 0, "trend": []})
    
    mapping = load_treno_direttrice_mapping()
    
    totale_treni = 0
    totale_anomali = 0
    trend = []
    
    for day_data in monthly_data:
        treni = day_data.get("treni", {})
        if direttrice_filter:
            treni_filtered = {}
            for num, t in treni.items():
                t_dir = t.get("direttrice") or mapping.get(num)
                if t_dir == direttrice_filter:
                    treni_filtered[num] = t
        else:
            treni_filtered = treni
            
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
        
    disagio = (totale_anomali / totale_treni * 100) if totale_treni > 0 else 0
    return jsonify({
        "disagio": round(disagio, 1),
        "treni_totali": totale_treni,
        "treni_anomali": totale_anomali,
        "giorni": len(monthly_data),
        "trend": trend
    })


@app.route("/api/train_history/<numero>")
def api_train_history(numero):
    monthly_data = get_monthly_data()
    history = []
    for day_data in monthly_data:
        date_str = day_data.get("data", "")
        treno = day_data.get("treni", {}).get(str(numero))
        if treno:
            history.append({
                "data": date_str,
                "ritardo_capolinea": treno.get("ritardo_capolinea", 0),
                "critico": treno.get("critico", False),
                "stato": treno.get("stato", "REGOLARE")
            })
    return jsonify({"numero": numero, "history": history})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)