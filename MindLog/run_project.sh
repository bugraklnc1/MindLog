#!/bin/bash

# Port 8000'i (Flask varsayılanı) kullanan eski bir python süreci varsa onu temizle
echo "🧹 Eski API süreçleri temizleniyor..."
kill -9 $(lsof -t -i:8000) 2>/dev/null

# Burnout API (Python) başlatılıyor
echo "🚀 Burnout API (Flask) başlatılıyor..."
cd ../burnout_api
source venv/bin/activate
python app.py > flask_api.log 2>&1 &
API_PID=$!
echo "📡 API arka planda başlatıldı (PID: $API_PID). Loglar flask_api.log dosyasına yazılıyor."

# Android cihazı/emülatörü için port yönlendirmesi (Reverse) yap
echo "🔄 Android cihaz için port yönlendirmesi yapılıyor (Port: 8000)..."
adb reverse tcp:8000 tcp:8000 2>/dev/null

# React Native (Android) başlatılıyor
echo "📱 Android uygulaması başlatılıyor..."
cd ../MindLog
npm run android

# Terminal kapatıldığında veya Ctrl+C yapıldığında Python API'sini de durdur
cleanup() {
    echo "🛑 Kapatılıyor, Python API durduruluyor (PID: $API_PID)..."
    kill $API_PID 2>/dev/null
    exit
}

# Ctrl+C sinyalini yakala
trap cleanup INT TERM EXIT

# Ana sürecin bitmesini bekle (Expo/Android)
wait
