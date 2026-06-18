# MindLog 🧠

> A productivity and mental wellness tracker that uses AI to detect burnout risk.

MindLog is a mobile application that helps users track their daily mood, habits, and journal entries. It leverages machine learning to analyze behavioral patterns and proactively warn users about potential burnout.

---

## 📱 Features

- **Daily Journal** — Write daily entries with voice-to-text support
- **Habit Tracking** — Track custom habits with streaks and completion rates
- **AI Mood Analysis** — Google Gemini analyzes journal entries and scores your mood (1–10)
- **Smart Chips** — AI generates personalized follow-up questions to help you reflect deeper
- **Burnout Detection** — ML model monitors 14-day patterns and warns you before you burn out
- **User Feedback Loop** — Confirm or deny burnout predictions to improve model accuracy over time

---

## 🗂️ Project Structure

```
MindLog/
├── MindLog/          # React Native (Expo) mobile app
│   ├── src/
│   │   ├── lib/      # Core services (Supabase, Gemini AI, Burnout)
│   │   ├── screens/  # App screens
│   │   └── navigation/
│   └── ...
└── burnout_api/      # Python / Flask ML API
    ├── app.py        # Flask REST API
    ├── train_model_v2.py
    └── requirements.txt
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| AI Analysis | Google Gemini 2.5 Flash |
| ML Model | scikit-learn (Random Forest) |
| ML API | Python / Flask, deployed on Render |
| Voice Input | expo-speech-recognition |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- Expo CLI
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/MindLog.git
cd MindLog
```

### 2. Set up the mobile app

```bash
cd MindLog
npm install
cp .env.example .env   # Fill in your own API keys
npx expo start
```

### 3. Set up the ML API (optional — already deployed)

```bash
cd burnout_api
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

> **Note:** The ML API is already deployed at `https://productivitylog-api.onrender.com`. You only need to run it locally if you want to modify the model.

---

## ⚙️ Environment Variables

Copy `MindLog/.env.example` to `MindLog/.env` and fill in your values:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_GEMINI_API_KEY=...
EXPO_PUBLIC_ML_API_URL=...
```

---

## 📊 How Burnout Detection Works

1. Every time the app opens, it fetches the last 14 days of data from Supabase
2. It calculates 4 features: `mood_avg`, `task_rate`, `login_count`, `mood_trend`
3. These are sent to the Flask ML API (Random Forest classifier)
4. If burnout risk is detected, a warning card appears with a feedback prompt
5. User feedback (agree/disagree) is stored to improve the model over time

---

## 📄 License

MIT
