import os
import json
import urllib.request
import urllib.parse
from datetime import datetime
import glob

TOKEN = os.environ.get("TELEGRAM_TOKEN")
API_URL = f"https://api.telegram.org/bot{TOKEN}"
DATA_DIR = "data"
USERS_FILE = os.path.join(DATA_DIR, "telegram_users.json")
OFFSET_FILE = os.path.join(DATA_DIR, "telegram_offset.json")
NOTIFIED_FILE = os.path.join(DATA_DIR, "telegram_notified_today.json")

def load_json(filepath, default):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return default

def save_json(filepath, data):
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def api_call(method, params=None):
    if not TOKEN: return None
    url = f"{API_URL}/{method}"
    if params:
        data = urllib.parse.urlencode(params).encode('utf-8')
        req = urllib.request.Request(url, data=data)
    else:
        req = urllib.request.Request(url)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Telegram API Error: {e}")
        return None

def process_messages():
    offset_data = load_json(OFFSET_FILE, {"offset": 0})
    users_data = load_json(USERS_FILE, {})
    
    params = {"offset": offset_data["offset"], "timeout": 0}
    updates = api_call("getUpdates", params)
    
    if not updates or not updates.get("ok"):
        return users_data
    
    max_offset = offset_data["offset"]
    
    for update in updates.get("result", []):
        update_id = update["update_id"]
        max_offset = max(max_offset, update_id + 1)
        
        message = update.get("message")
        if not message or "text" not in message: continue
        
        chat_id = str(message["chat"]["id"])
        text = message["text"].strip().lower()
        
        if chat_id not in users_data:
            users_data[chat_id] = {"preferiti": []}
            
        parts = text.split()
        cmd = parts[0]
        
        if cmd == "/start":
            reply = "🚄 *Benvenuto nel Monitor Trenord!*\nQuesto bot ti avviserà se i tuoi treni sono in forte ritardo (>15 min) o cancellati.\n\nComandi:\n`/add NUMERO` (es. /add 25016)\n`/remove NUMERO`\n`/list`"
            api_call("sendMessage", {"chat_id": chat_id, "text": reply, "parse_mode": "Markdown"})
            
        elif cmd == "/add" and len(parts) > 1:
            treno = parts[1]
            if treno not in users_data[chat_id]["preferiti"]:
                users_data[chat_id]["preferiti"].append(treno)
            api_call("sendMessage", {"chat_id": chat_id, "text": f"✅ Treno {treno} aggiunto ai preferiti."})
            
        elif cmd == "/remove" and len(parts) > 1:
            treno = parts[1]
            if treno in users_data[chat_id]["preferiti"]:
                users_data[chat_id]["preferiti"].remove(treno)
                api_call("sendMessage", {"chat_id": chat_id, "text": f"🗑 Treno {treno} rimosso."})
            else:
                api_call("sendMessage", {"chat_id": chat_id, "text": "Treno non trovato nei preferiti."})
                
        elif cmd == "/list":
            pref = users_data[chat_id]["preferiti"]
            msg = f"Treni monitorati: {', '.join(pref)}" if pref else "Nessun treno salvato."
            api_call("sendMessage", {"chat_id": chat_id, "text": msg})
    
    # Salva stato
    save_json(USERS_FILE, users_data)
    save_json(OFFSET_FILE, {"offset": max_offset})
    return users_data

def get_today_data():
    files = glob.glob(os.path.join(DATA_DIR, "database_totale_*.json"))
    if not files: return None
    latest = sorted(files)[-1]
    with open(latest, "r", encoding="utf-8") as f:
        return json.load(f)

def send_alerts(users_data):
    today_data = get_today_data()
    if not today_data: return
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    notified_data = load_json(NOTIFIED_FILE, {})
    
    # Reset file se è un nuovo giorno
    if notified_data.get("date") != today_str:
        notified_data = {"date": today_str, "alerts": {}}
        
    alerts_dict = notified_data["alerts"] # { "CHAT_ID": ["NUMERO_TRENO"] }
    
    treni = today_data.get("treni", {})
    
    for chat_id, user_info in users_data.items():
        preferiti = user_info.get("preferiti", [])
        if chat_id not in alerts_dict:
            alerts_dict[chat_id] = []
            
        for p in preferiti:
            if p in treni and p not in alerts_dict[chat_id]:
                t = treni[p]
                # Se è inattivo, lo skippiamo (non è ancora partito)
                if t.get("stato") == "INATTIVO":
                    continue
                    
                if t.get("critico", False):
                    stato = t.get("stato", "")
                    ritardo = t.get("ritardo_attuale", 0)
                    msg = f"🚨 *Allerta Treno {p}!*\n"
                    if stato in ["SOPPRESSO", "PARZ. SOPPRESSO"]:
                        msg += f"Il treno risulta *{stato}*.\n"
                    else:
                        msg += f"Il treno è in *{stato}* di *{ritardo} minuti*.\n"
                        
                    note = t.get("note", "")
                    if note: msg += f"\n📝 Note: {note}"
                    
                    res = api_call("sendMessage", {"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"})
                    if res and res.get("ok"):
                        alerts_dict[chat_id].append(p)
                        print(f"Allerta inviata a {chat_id} per treno {p}")
                        
    save_json(NOTIFIED_FILE, notified_data)

if __name__ == "__main__":
    if TOKEN:
        print("Telegram Token trovato. Controllo messaggi e allerte...")
        users = process_messages()
        send_alerts(users)
    else:
        print("TELEGRAM_TOKEN non impostato. Bot disattivato.")
