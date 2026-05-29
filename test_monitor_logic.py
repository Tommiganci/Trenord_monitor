import unittest
from datetime import datetime, timedelta
import zoneinfo
import logging

# Disabilita i log di monitor.py durante il test per pulizia dell'output
logging.disable(logging.CRITICAL)

import monitor

class TestMonitorLogic(unittest.TestCase):
    def setUp(self):
        self.it_tz = zoneinfo.ZoneInfo("Europe/Rome")
        monitor.IT_TZ = self.it_tz

    def test_calcola_stato_futuro(self):
        # Treno programmato tra 30 minuti (non ancora partito)
        dep_time = datetime.now(self.it_tz) + timedelta(minutes=30)
        dep_ts = int(dep_time.timestamp() * 1000)
        
        api_data = {
            "provvedimento": 0,
            "ritardo": 0,
            "nonPartito": True,
            "orarioPartenza": dep_ts,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "fermate": []
        }
        res = monitor.calcola_stato(api_data, "R16", ["ASSO"])
        self.assertEqual(res["stato"], "INATTIVO")

    def test_calcola_stato_recente(self):
        # Treno programmato 60 minuti fa (non ancora partito) -> Entro i 90 min, quindi ancora INATTIVO
        dep_time = datetime.now(self.it_tz) - timedelta(minutes=60)
        dep_ts = int(dep_time.timestamp() * 1000)
        
        api_data = {
            "provvedimento": 0,
            "ritardo": 0,
            "nonPartito": True,
            "orarioPartenza": dep_ts,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "fermate": []
        }
        res = monitor.calcola_stato(api_data, "R16", ["ASSO"])
        self.assertEqual(res["stato"], "INATTIVO")

    def test_calcola_stato_scaduto(self):
        # Treno programmato 100 minuti fa (non ancora partito) -> Oltre i 90 min, quindi SOPPRESSO
        dep_time = datetime.now(self.it_tz) - timedelta(minutes=100)
        dep_ts = int(dep_time.timestamp() * 1000)
        
        api_data = {
            "provvedimento": 0,
            "ritardo": 0,
            "nonPartito": True,
            "orarioPartenza": dep_ts,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "fermate": []
        }
        res = monitor.calcola_stato(api_data, "R16", ["ASSO"])
        self.assertEqual(res["stato"], "SOPPRESSO")

    def test_calcola_stato_provvedimento_soppresso(self):
        # Treno soppresso ufficialmente fin da subito
        dep_time = datetime.now(self.it_tz) + timedelta(minutes=30)
        dep_ts = int(dep_time.timestamp() * 1000)
        
        api_data = {
            "provvedimento": 1,
            "ritardo": 0,
            "nonPartito": True,
            "orarioPartenza": dep_ts,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "fermate": []
        }
        res = monitor.calcola_stato(api_data, "R16", ["ASSO"])
        self.assertEqual(res["stato"], "SOPPRESSO")

    def test_merge_dati_partenza(self):
        # Test transizione: INATTIVO -> REGOLARE
        now_dt = datetime.now(self.it_tz)
        
        old_data = {
            "stato": "INATTIVO",
            "critico": False,
            "ritardo_attuale": 0,
            "ritardo_picco": 0,
            "ritardo_capolinea": 0,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "storico_ritardi": []
        }
        
        new_scan = {
            "stato": "REGOLARE",
            "ritardo_attuale": 0,
            "ritardo_capolinea": 0,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "non_partito": False,
            "provvedimento": 0
        }
        
        merged = monitor.merge_dati(old_data, new_scan, now_dt)
        self.assertEqual(merged["stato"], "REGOLARE")

    def test_merge_dati_ripristino_da_soppresso(self):
        # Test ripristino: SOPPRESSO per timeout -> parte in ritardo (es. RITARDO 95 min)
        now_dt = datetime.now(self.it_tz)
        
        old_data = {
            "stato": "SOPPRESSO",
            "critico": True,
            "ritardo_attuale": 0,
            "ritardo_picco": 0,
            "ritardo_capolinea": 0,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "storico_ritardi": []
        }
        
        # Scansione corrente rileva che è partito ed ha 95 minuti di ritardo
        new_scan = {
            "stato": "RITARDO",
            "ritardo_attuale": 95,
            "ritardo_capolinea": 95,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "non_partito": False,
            "provvedimento": 0
        }
        
        merged = monitor.merge_dati(old_data, new_scan, now_dt)
        self.assertEqual(merged["stato"], "RITARDO")

    def test_merge_dati_soppressione_ufficiale_irreversibile(self):
        # Se c'è un provvedimento ufficiale di soppressione (provvedimento = 1), lo stato rimane SOPPRESSO
        now_dt = datetime.now(self.it_tz)
        
        old_data = {
            "stato": "SOPPRESSO",
            "critico": True,
            "ritardo_attuale": 0,
            "ritardo_picco": 0,
            "ritardo_capolinea": 0,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "storico_ritardi": []
        }
        
        new_scan = {
            "stato": "REGOLARE",
            "ritardo_attuale": 0,
            "ritardo_capolinea": 0,
            "origine": "MILANO",
            "destinazione": "ASSO",
            "orario_programmato": "12:00",
            "note": "",
            "non_partito": False,
            "provvedimento": 1
        }
        
        merged = monitor.merge_dati(old_data, new_scan, now_dt)
        self.assertEqual(merged["stato"], "SOPPRESSO")

if __name__ == "__main__":
    unittest.main()
