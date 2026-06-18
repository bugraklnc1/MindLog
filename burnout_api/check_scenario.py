import joblib
import numpy as np

model = joblib.load('burnout_model_v2.pkl')
features = np.array([[3.1, 0.82, 11, -2.4]]) # mood_avg, task_rate, login_count, mood_trend
pred = model.predict(features)[0]
prob = model.predict_proba(features)[0]

print(f"Prediction: {pred}")
print(f"Probability: {max(prob):.4f}")
