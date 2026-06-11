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
        except Exception:
            pass

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
        except Exception:
            continue
            
    return sorted(all_data, key=lambda x: x["data"])

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
    current_month = datetime.now().strftime("%Y-%m")
    return load_reconstructed_history(filter_month=current_month)

def get_all_data():
    return load_reconstructed_history()

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


def calculate_reliability(train_num, all_data):
    """
    Calcola le statistiche di affidabilità di un treno negli ultimi 30 giorni.
    """
    train_history = []
    for day_data in all_data:
        treno = day_data.get("treni", {}).get(str(train_num))
        if treno:
            train_history.append(treno)
            
    if not train_history:
        return {
            "puntualita": 100.0,
            "ritardo_medio": 0.0,
            "soppressioni": 0.0,
            "corse_totali": 0
        }
        
    totale_corse = len(train_history)
    puntuali = 0
    soppressi = 0
    ritardi = []
    
    for t in train_history:
        stato = t.get("stato", "REGOLARE")
        rit = t.get("ritardo_capolinea", 0)
        
        if stato in ["SOPPRESSO", "LIMITATO", "PARZ. SOPPRESSO"]:
            soppressi += 1
        else:
            if rit <= 5:
                puntuali += 1
            ritardi.append(max(0, rit))
            
    tasso_puntualita = round((puntuali / totale_corse) * 100, 1)
    tasso_soppressioni = round((soppressi / totale_corse) * 100, 1)
    ritardo_medio = round(sum(ritardi) / len(ritardi) if ritardi else 0.0, 1)
    
    return {
        "puntualita": tasso_puntualita,
        "ritardo_medio": ritardo_medio,
        "soppressioni": tasso_soppressioni,
        "corse_totali": totale_corse
    }


@app.route("/api/route_search")
def api_route_search():
    start_station = request.args.get("da", "").strip()
    end_station = request.args.get("a", "").strip()
    
    if not start_station or not end_station:
        return jsonify({"error": "Stazioni di partenza e arrivo obbligatorie"}), 400
        
    orari_path = os.path.join(DATA_DIR, "orari_tratte.json")
    if not os.path.exists(orari_path):
        return jsonify({"error": "Orari non disponibili"}), 404
        
    try:
        with open(orari_path, "r", encoding="utf-8") as f:
            timetable = json.load(f)
    except Exception as e:
        return jsonify({"error": f"Errore caricamento orari: {str(e)}"}), 500
        
    start_trains = timetable.get(start_station, {})
    end_trains = timetable.get(end_station, {})
    
    matching_trains = []
    common_nums = set(start_trains.keys()) & set(end_trains.keys())
    
    all_data = get_all_data() # Carica lo storico
    
    for num_str in common_nums:
        st_info = start_trains[num_str]
        end_info = end_trains[num_str]
        
        if st_info["seq"] < end_info["seq"]:
            stats = calculate_reliability(num_str, all_data)
            matching_trains.append({
                "numero": int(num_str),
                "linea": st_info["line"],
                "partenza": st_info["dep"],
                "arrivo": end_info["dep"],
                "affidabilita": stats
            })
            
    matching_trains.sort(key=lambda x: x["partenza"])
    return jsonify(matching_trains)


from flask import send_from_directory
@app.route("/data/<path:filename>")
def serve_data_files(filename):
    return send_from_directory(DATA_DIR, filename)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)