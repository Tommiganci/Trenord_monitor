import os
import glob
import json
from datetime import datetime
from flask import Flask, jsonify, render_template

app = Flask(__name__)
DATA_DIR = "data"

def get_latest_data():
    if not os.path.exists(DATA_DIR):
        return None
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    if not files:
        return None
    latest_file = sorted(files)[-1]
    with open(latest_file, "r", encoding="utf-8") as f:
        return json.load(f)

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

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/data")
def api_data():
    data = get_latest_data()
    if data:
        return jsonify(data)
    return jsonify({"error": "Nessun dato disponibile"}), 404

@app.route("/api/monthly_stats")
def api_monthly_stats():
    monthly_data = get_monthly_data()
    if not monthly_data:
        return jsonify({"disagio": 0, "treni_totali": 0, "treni_anomali": 0, "giorni": 0, "trend": []})
    
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
