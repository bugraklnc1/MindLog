import joblib
import numpy as np

model = joblib.load('burnout_model_v2.pkl')

test_cases = [
    {"name": "Klasik Tükenmişlik",    "vals": [2.0, 0.20, 3,  -4.0]},
    {"name": "Anksiyeteli/Çırpınan",  "vals": [3.5, 0.10, 14, -2.5]},
    {"name": "Toksik Üretken",        "vals": [2.5, 0.95, 13, -3.5]},
    {"name": "Ortalama Kullanıcı",    "vals": [5.0, 0.30, 8,  -1.0]},
    {"name": "İyileşme Sürecinde",    "vals": [5.5, 0.50, 7,  +2.5]},
    {"name": "Odaklı/Minimalist",     "vals": [8.0, 0.85, 4,  +1.0]},
    {"name": "Hevesli Başlangıç",     "vals": [9.0, 0.15, 12, +2.0]},
    {"name": "Tatildeki Kullanıcı",   "vals": [9.0, 0.10, 3,  +0.3]},
]

for tc in test_cases:
    feat = np.array([tc["vals"]])
    pred = model.predict(feat)[0]
    prob = model.predict_proba(feat)[0]
    risk_label = "🔴 Riskli" if pred == 1 else "🟢 Sağlıklı"
    print(f"| {tc['name']} | {tc['vals'][0]} | {tc['vals'][1]:.2f} | {tc['vals'][2]} | {tc['vals'][3]:+.1f} | {risk_label} | %{max(prob)*100:.0f} |")
