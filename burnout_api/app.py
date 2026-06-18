from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# Modeli yüklüyoruz (v2: 4 özellik — mood_avg, task_rate, login_count, mood_trend)
model = joblib.load('burnout_model_v2.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # React Native'den gelen JSON verisini alıyoruz
        data = request.get_json()
        
        # Gelen verileri ayıklıyoruz (mood_avg, task_rate, login_count, mood_trend)
        # Örn: {"mood_avg": 2.5, "task_rate": 0.9, "login_count": 12, "mood_trend": -3.5}
        mood  = float(data.get('mood_avg'))
        task  = float(data.get('task_rate'))
        logins = int(data.get('login_count'))
        trend  = float(data.get('mood_trend', 0.0))  # Varsayılan: nötr
        
        # Veriyi modelin anlayacağı formata sokuyoruz (4 özellik)
        features = np.array([[mood, task, logins, trend]])
        
        # Tahmin yapıyoruz
        prediction = model.predict(features)
        probability = model.predict_proba(features) # Olasılık değerini alıyoruz
        
        # Sonucu döndürüyoruz
        # prediction[0] -> 0 (Sağlıklı) veya 1 (Riskli) döner
        return jsonify({
            'burnout_risk': int(prediction[0]),
            'risk_probability': float(np.max(probability)), # Ne kadar emin?
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    # Localde test etmek için 8000 portunda çalıştırıyoruz
    app.run(host='0.0.0.0', port=8000, debug=True)