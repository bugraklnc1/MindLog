"""
train_model_v2.py
=================
Burnout Tahmin Modeli - Versiyon 2

Değişiklikler:
- 4. özellik eklendi: mood_trend (son 7 gün - önceki 7 gün ruh hali farkı)
- Zaman penceresi 14 güne çıkarıldı → login_count artık 0-14 arasında
- Profil 7 yenilendi: "İyileşme" durumu (pozitif trend, orta mood)

Çalıştırma:
  cd burnout_api
  source venv/bin/activate
  python train_model_v2.py
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

np.random.seed(42)

# ===========================================================
# 4 ÖZELLIK:
#   mood_avg   → 14 günlük ruh hali ortalaması (1.0 - 10.0)
#   task_rate  → Tamamlanan habit / (14 gün × aktif habit)  (0.0 - 1.0)
#   login_count→ 14 günde uygulamaya girildiği gün sayısı  (0 - 14)
#   mood_trend → Son 7 gün avg - Önceki 7 gün avg          (-9.0 - +9.0)
#                Negatif = kötüleşme, Pozitif = iyileşme
# ===========================================================

# -----------------------------------------------------------
# Profil 1: Klasik Tükenmişlik (300 kişi) - Risk: 1
# Düşük mood, düşük görev, az giriş, mood sürekli düşüyor
# -----------------------------------------------------------
p1_mood  = np.random.uniform(1.0, 4.0, 300)
p1_task  = np.random.uniform(0.0, 0.4, 300)
p1_login = np.random.uniform(2, 14, 300)
p1_trend = np.random.uniform(-5.0, -1.0, 300)
p1_label = np.ones(300)

# -----------------------------------------------------------
# Profil 2: Çırpınan / Anksiyeteli (200 kişi) - Risk: 1
# Düşük mood ama her gün giriyor — kaygı ile sürekli kontrol ediyor
# -----------------------------------------------------------
p2_mood  = np.random.uniform(1.0, 4.5, 200)
p2_task  = np.random.uniform(0.0, 0.4, 200)
p2_login = np.random.uniform(5, 14, 200)
p2_trend = np.random.uniform(-4.0, -0.5, 200)
p2_label = np.ones(200)

# -----------------------------------------------------------
# Profil 3: Dinlenen / Tatildeki Kullanıcı (150 kişi) - Risk: 0
# Yüksek mood, az çalışma, az giriş — kasıtlı mola
# -----------------------------------------------------------
p3_mood  = np.random.uniform(7.0, 10.0, 150)
p3_task  = np.random.uniform(0.0, 0.3, 150)
p3_login = np.random.uniform(2, 14, 150)
p3_trend = np.random.uniform(0.0, 2.5, 150)
p3_label = np.zeros(150)

# -----------------------------------------------------------
# Profil 4: Toksik Üretken / Makine Modu (240 kişi) - Risk: 1
# Mutsuz ama yüksek tempoda çalışıyor — sürdürülemez durum
# -----------------------------------------------------------
p4_mood  = np.random.uniform(2.0, 6.5, 240) 
p4_task  = np.random.uniform(0.8, 1.0, 240)
p4_login = np.random.uniform(5, 14, 240)
p4_trend = np.random.uniform(-3.0, 0.0, 240)
p4_label = np.ones(240)

# -----------------------------------------------------------
# Profil 5: Hevesli Başlangıç (150 kişi) - Risk: 0
# Mutlu, her gün giriyor ama henüz alışkanlık oturtamadı
# -----------------------------------------------------------
p5_mood  = np.random.uniform(7.0, 10.0, 150)
p5_task  = np.random.uniform(0.0, 0.4, 150)
p5_login = np.random.uniform(5, 14, 150)
p5_trend = np.random.uniform(1.0, 4.0, 150)
p5_label = np.zeros(150)

# -----------------------------------------------------------
# Profil 6: Odaklı / Minimalist (150 kişi) - Risk: 0
# Sadece işi olduğunda giriyor, görevini tam yapıyor, morali iyi
# -----------------------------------------------------------
p6_mood  = np.random.uniform(6.0, 9.0, 150)
p6_task  = np.random.uniform(0.7, 1.0, 150)
p6_login = np.random.uniform(2, 14, 150)
p6_trend = np.random.uniform(0.0, 3.0, 150)
p6_label = np.zeros(150)

# -----------------------------------------------------------
# Profil 7: İyileşme Sürecindeki Kullanıcı (150 kişi) - Risk: 0
# Orta mood ama belirgin şekilde artıyor — tükenmişlikten çıkış
# -----------------------------------------------------------
p7_mood  = np.random.uniform(3.5, 7.0, 150)
p7_task  = np.random.uniform(0.3, 0.6, 150)
p7_login = np.random.uniform(5, 14, 150)
p7_trend = np.random.uniform(1.0, 4.0, 150)
p7_label = np.zeros(150)

# -----------------------------------------------------------
# Profil 8: Ortalama Kullanıcı (240 kişi) - Risk: 0 ← YENİ
# Profil 4 ile ruh hali ve trend açısından kesişir, ancak görev oranı düşüktür
# -----------------------------------------------------------
p8_mood  = np.random.uniform(2.0, 6.5, 240)
p8_task  = np.random.uniform(0.1, 0.45, 240)
p8_login = np.random.uniform(5, 14, 240)
p8_trend = np.random.uniform(-3.0, 0.0, 240)
p8_label = np.zeros(240)

# -----------------------------------------------------------
# Veriyi birleştir
# -----------------------------------------------------------
X = np.column_stack([
    np.concatenate([p1_mood, p2_mood, p3_mood, p4_mood, p5_mood, p6_mood, p7_mood, p8_mood]),
    np.concatenate([p1_task, p2_task, p3_task, p4_task, p5_task, p6_task, p7_task, p8_task]),
    np.concatenate([p1_login, p2_login, p3_login, p4_login, p5_login, p6_login, p7_login, p8_login]),
    np.concatenate([p1_trend, p2_trend, p3_trend, p4_trend, p5_trend, p6_trend, p7_trend, p8_trend]),
])
y = np.concatenate([p1_label, p2_label, p3_label, p4_label, p5_label, p6_label, p7_label, p8_label])

# Doğal gürültü ekleyerek modelin ezberlemesini (overfitting) önleme
X[:,0] += np.random.normal(0, 0.35, len(y)) 
X[:,1] += np.random.normal(0, 0.05, len(y)) 
X[:,2] += np.random.normal(0, 1.0, len(y)) 
X[:,3] += np.random.normal(0, 0.45, len(y)) 

# Gerçekçilik için %0.6 etiket gürültüsü
flip_idx = np.random.choice(len(y), int(len(y)*0.006), replace=False)
y[flip_idx] = 1 - y[flip_idx]

feature_names = ['mood_avg', 'task_rate', 'login_count', 'mood_trend']
df = pd.DataFrame(X, columns=feature_names)

print(f"Toplam veri: {len(df)} örnek")
print(f"Risk=1 (Tükenmişlik): {int(y.sum())} | Risk=0 (Sağlıklı): {int((y == 0).sum())}")
print()

# -----------------------------------------------------------
# Eğitim / Test ayrımı
# -----------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# -----------------------------------------------------------
# Random Forest Classifier
# -----------------------------------------------------------
model = RandomForestClassifier(
    n_estimators=200,    
    max_depth=8,
    random_state=42,
    class_weight='balanced'  
)

model.fit(X_train, y_train)

# -----------------------------------------------------------
# Değerlendirme
# -----------------------------------------------------------
y_pred = model.predict(X_test)

print("=" * 50)
print("SINIFLANDIRMA RAPORU")
print("=" * 50)
print(classification_report(
    y_test, y_pred,
    target_names=['Sağlıklı (0)', 'Tükenmişlik (1)']
))

print("KARMAŞIKLIK MATRİSİ (Confusion Matrix)")
print("=" * 50)
cm = confusion_matrix(y_test, y_pred)
print(f"                 Tahmin: Sağlıklı  Tahmin: Riskli")
print(f"Gerçek: Sağlıklı      {cm[0][0]:>8}        {cm[0][1]:>8}")
print(f"Gerçek: Riskli        {cm[1][0]:>8}        {cm[1][1]:>8}")
print()

print("ÖZELLİK ÖNEMLİLİK SIRALAMA")
print("=" * 50)
importances = model.feature_importances_
for name, imp in sorted(zip(feature_names, importances), key=lambda x: -x[1]):
    bar = "█" * int(imp * 40)
    print(f"  {name:<15} {imp:.4f}  {bar}")
print()

# -----------------------------------------------------------
# Modeli kaydet
# -----------------------------------------------------------
output_path = 'burnout_model_v2.pkl'
joblib.dump(model, output_path)
print(f"✅ Model kaydedildi: {output_path}")
print()

# -----------------------------------------------------------
# Hızlı test
# -----------------------------------------------------------
print("ÖRNEK TAHMİNLER")
print("=" * 50)

test_cases = [
    {"name": "Klasik Tükenmişlik",    "vals": [2.0, 0.2, 3,  -4.0]},
    {"name": "Toksik Üretken",        "vals": [2.5, 0.95, 13, -3.5]},
    {"name": "Sağlıklı Minimalist",   "vals": [7.5, 0.9, 4,   0.5]},
    {"name": "İyileşme Sürecinde",    "vals": [5.5, 0.5, 7,  +2.5]},
    {"name": "Tatildeki Kullanıcı",   "vals": [9.0, 0.1, 3,   0.3]},
]

for tc in test_cases:
    feat = np.array([tc["vals"]])
    pred = model.predict(feat)[0]
    prob = model.predict_proba(feat)[0]
    risk_label = "🔴 RİSKLİ" if pred == 1 else "🟢 SAĞLIKLI"
    print(f"  {tc['name']:<28} → {risk_label}  (güven: %{max(prob)*100:.0f})")
    print(f"    mood={tc['vals'][0]}, task={tc['vals'][1]}, login={tc['vals'][2]}, trend={tc['vals'][3]}")
