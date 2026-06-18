import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score
import joblib

def evaluate():
    np.random.seed(42)
    
    p1_mood = np.random.uniform(1.0, 4.0, 300)
    p1_task = np.random.uniform(0.0, 0.4, 300)
    p1_login = np.random.uniform(2, 14, 300)
    p1_trend = np.random.uniform(-5.0, -1.0, 300)
    p1_label = np.ones(300)

    p2_mood = np.random.uniform(1.0, 4.5, 200)
    p2_task = np.random.uniform(0.0, 0.4, 200)
    p2_login = np.random.uniform(5, 14, 200)
    p2_trend = np.random.uniform(-4.0, -0.5, 200)
    p2_label = np.ones(200)

    p3_mood = np.random.uniform(7.0, 10.0, 150)
    p3_task = np.random.uniform(0.0, 0.3, 150)
    p3_login = np.random.uniform(2, 14, 150)
    p3_trend = np.random.uniform(0.0, 2.5, 150)
    p3_label = np.zeros(150)

    # Toxic Productivity
    p4_mood = np.random.uniform(2.0, 6.5, 240) 
    p4_task = np.random.uniform(0.8, 1.0, 240)
    p4_login = np.random.uniform(5, 14, 240)
    p4_trend = np.random.uniform(-3.0, 0.0, 240)
    p4_label = np.ones(240)

    p5_mood = np.random.uniform(7.0, 10.0, 150)
    p5_task = np.random.uniform(0.0, 0.4, 150)
    p5_login = np.random.uniform(5, 14, 150)
    p5_trend = np.random.uniform(1.0, 4.0, 150)
    p5_label = np.zeros(150)

    p6_mood = np.random.uniform(6.0, 9.0, 150)
    p6_task = np.random.uniform(0.7, 1.0, 150)
    p6_login = np.random.uniform(2, 14, 150)
    p6_trend = np.random.uniform(0.0, 3.0, 150)
    p6_label = np.zeros(150)

    p7_mood = np.random.uniform(3.5, 7.0, 150)
    p7_task = np.random.uniform(0.3, 0.6, 150)
    p7_login = np.random.uniform(5, 14, 150)
    p7_trend = np.random.uniform(1.0, 4.0, 150)
    p7_label = np.zeros(150)
    
    # Overlapping healthy profile
    p8_mood = np.random.uniform(2.0, 6.5, 240)
    p8_task = np.random.uniform(0.1, 0.45, 240)
    p8_login = np.random.uniform(5, 14, 240)
    p8_trend = np.random.uniform(-3.0, 0.0, 240)
    p8_label = np.zeros(240)
    
    X = np.column_stack([
        np.concatenate([p1_mood, p2_mood, p3_mood, p4_mood, p5_mood, p6_mood, p7_mood, p8_mood]),
        np.concatenate([p1_task, p2_task, p3_task, p4_task, p5_task, p6_task, p7_task, p8_task]),
        np.concatenate([p1_login, p2_login, p3_login, p4_login, p5_login, p6_login, p7_login, p8_login]),
        np.concatenate([p1_trend, p2_trend, p3_trend, p4_trend, p5_trend, p6_trend, p7_trend, p8_trend]),
    ])
    y = np.concatenate([p1_label, p2_label, p3_label, p4_label, p5_label, p6_label, p7_label, p8_label])
    
    X[:,0] += np.random.normal(0, 0.35, len(y)) 
    X[:,1] += np.random.normal(0, 0.05, len(y)) 
    X[:,2] += np.random.normal(0, 1.0, len(y)) 
    X[:,3] += np.random.normal(0, 0.45, len(y)) 
    
    flip_idx = np.random.choice(len(y), int(len(y)*0.006), replace=False)
    y[flip_idx] = 1 - y[flip_idx]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=200, max_depth=7, random_state=42, class_weight='balanced')
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    prec = precision_score(y_test, y_pred, pos_label=1)
    rec = recall_score(y_test, y_pred, pos_label=1)
    f1 = f1_score(y_test, y_pred, average='weighted')
    
    print(f"Precision: {prec:.4f}")
    print(f"Recall: {rec:.4f}")
    print(f"F1 Score: {f1:.4f}")
    print("-" * 30)
    importances = model.feature_importances_
    print(f"Mood Trend: {importances[3]*100:.2f}%")
    print(f"Mood Avg: {importances[0]*100:.2f}%")
    print(f"Task Rate: {importances[1]*100:.2f}%")
    print(f"Login Count: {importances[2]*100:.2f}%")

    # Modeli overwrite edelim
    joblib.dump(model, 'burnout_model_v2.pkl')

evaluate()
