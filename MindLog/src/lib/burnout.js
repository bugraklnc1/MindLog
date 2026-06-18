/**
 * burnout.js
 *
 * Tükenmişlik (Burnout) Tespit Servisi
 * -------------------------------------
 * 1. Supabase'den son 7 günün gerçek verilerini çeker.
 * 2. ML API'sine gönderir.
 * 3. Sonucu döndürür: { burnout_risk, risk_probability, status }
 */

import { supabase } from './supabase';

// ⚠️ ML API URL — .env dosyanızdaki EXPO_PUBLIC_ML_API_URL değişkenini ayarlayın
// (.env.example dosyasına bakın)
const ML_API_URL = process.env.EXPO_PUBLIC_ML_API_URL || 'https://productivitylog-api.onrender.com/predict';



// Son 14 günün istatistiklerini Supabase'den çeker
const fetchUserStats = async () => {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();

  // Mood trendi için pencere ortası: tam 7 gün önce (tarih formatında)
  const sevenDaysAgoDateStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // 1. Son 14 günün entry'lerini çek (mood_score ve created_at)
  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('mood_score, created_at')
    .gte('created_at', fourteenDaysAgoStr)
    .order('created_at', { ascending: false });

  if (entriesError) {
    console.error('[Burnout] Entry çekme hatası:', entriesError.message);
    throw new Error('Kullanıcı verileri alınamadı.');
  }

  // 2. Son 7 günün habit_logs sayısını çek (görev tamamlama oranı için)
  const { data: habitLogs, error: logsError } = await supabase
    .from('habit_logs')
    .select('habit_id, completed_at')
    .gte('completed_at', fourteenDaysAgo.toISOString().split('T')[0]);

  if (logsError) {
    console.error('[Burnout] Habit log çekme hatası:', logsError.message);
    // Kritik değil, devam et
  }

  // 3. Toplam aktif alışkanlık sayısı
  const { data: allHabits, error: habitsError } = await supabase
    .from('habits')
    .select('id')
    .eq('is_active', true);

  if (habitsError) {
    console.error('[Burnout] Habit çekme hatası:', habitsError.message);
  }

  // ---- Hesaplamalar ----

  // mood_avg: Son 14 günün genel ruh hali ortalaması
  const allMoodScores = (entries || [])
    .map(e => e.mood_score)
    .filter(s => s != null && s > 0);

  const mood_avg =
    allMoodScores.length > 0
      ? parseFloat(
        (allMoodScores.reduce((sum, s) => sum + s, 0) / allMoodScores.length).toFixed(2)
      )
      : 5.0;

  // mood_trend: Son 7 gün ortalaması − önceki 7 gün ortalaması
  // Negatif = kötüleşme (tükenmişlik sinyali) | Pozitif = iyileşme
  const recentEntries = (entries || []).filter(
    e => e.created_at.split('T')[0] >= sevenDaysAgoDateStr
  );
  const earlyEntries = (entries || []).filter(
    e => e.created_at.split('T')[0] < sevenDaysAgoDateStr
  );

  const recentMoods = recentEntries.map(e => e.mood_score).filter(s => s != null && s > 0);
  const earlyMoods  = earlyEntries.map(e => e.mood_score).filter(s => s != null && s > 0);

  const recentAvg = recentMoods.length > 0
    ? recentMoods.reduce((sum, s) => sum + s, 0) / recentMoods.length
    : null;
  const earlyAvg = earlyMoods.length > 0
    ? earlyMoods.reduce((sum, s) => sum + s, 0) / earlyMoods.length
    : null;

  // İki yarım da varsa trend hesapla; yoksa 0.0 (nötr / yeterli veri yok)
  const mood_trend = (recentAvg !== null && earlyAvg !== null)
    ? parseFloat((recentAvg - earlyAvg).toFixed(2))
    : 0.0;

  // login_count: Son 14 günde giriş (entry) yapılan gün sayısı
  const uniqueDays = new Set(
    (entries || []).map(e => e.created_at.split('T')[0])
  );
  const login_count = uniqueDays.size;

  // task_rate: (tamamlanan habit sayısı) / (14 gün * aktif habit sayısı)
  const totalHabits  = (allHabits || []).length;
  const completedLogs = (habitLogs || []).length;
  const maxPossible  = 14 * (totalHabits > 0 ? totalHabits : 1);
  const task_rate = parseFloat(
    Math.min(completedLogs / maxPossible, 1.0).toFixed(4)
  );

  return { mood_avg, task_rate, login_count, mood_trend };
};

/**
 * Ana fonksiyon: Burnout riskini kontrol eder.
 * @returns {{ burnout_risk: number, risk_probability: number, status: string, userStats: object }}
 */
export const checkBurnoutRisk = async () => {
  try {
    // Giriş yapmış kullanıcının ID'sini çek
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      console.error('[Burnout] Giriş yapmış kullanıcı bulunamadı.');
      return null;
    }

    const currentUserId = authData.user.id;

    // Kullanıcının gerçek verilerini Supabase'den çek
    const userStats = await fetchUserStats();

    console.log('[Burnout] Gönderilen istatistikler:', userStats);

    // 2. ML API'sine gönder
    const response = await fetch(ML_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userStats),
    });

    if (!response.ok) {
      throw new Error(`ML API hatası: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Burnout] ML API yanıtı:', result);

    let predictionId = null;

    // ---------------------------------------------------------
    // 3. SONUCU SUPABASE'E KAYDET VE ID'SİNİ AL (Feedback Loop)
    // ---------------------------------------------------------
    if (currentUserId) {
      const { data: insertedData, error: insertError } = await supabase
        .from('ai_predictions')
        .insert([
          {
            user_id: currentUserId,
            mood_avg: userStats.mood_avg,
            task_rate: userStats.task_rate,
            login_count: userStats.login_count,
            mood_trend: userStats.mood_trend,  // ← yeni özellik
            ai_risk_score: result.burnout_risk
            // user_actual_state şu an boş bırakılıyor (Kullanıcı butona basınca dolacak)
          }
        ])
        .select('id') // Kaydedilen satırın ID'sini istiyoruz
        .single();

      if (insertError) {
        console.error("[Burnout] Tahmin Supabase'e kaydedilemedi (RLS Hatası Olabilir):", insertError.message);
      } else if (insertedData) {
        console.log("✅ Tahmin başarıyla Supabase'e kaydedildi! ID:", insertedData.id);
        predictionId = insertedData.id; // Bu ID'yi uyarı kartındaki butonlar için saklıyoruz
      }
    }

    // 4. Yanıta userStats'ı ve predictionId'yi de ekleyerek döndür
    // (predictionId'yi UI'a yolluyoruz ki kullanıcı 👍/👎 butonlarına basabilsin)
    return { ...result, userStats, predictionId };

  } catch (error) {
    console.error("[Burnout] checkBurnoutRisk Fonksiyonunda Hata:", error);
    throw error;
  }
};

/**
 * Burnout tahminini ai_predictions tablosuna kaydeder.
 * user_actual_state başlangıçta NULL — kullanıcı geri bildirim verince doldurulur.
 * @returns {string|null} Kaydedilen satırın id'si
 */
export const savePrediction = async (userStats, aiRiskScore) => {
  try {
    const { data, error } = await supabase
      .from('ai_predictions')
      .insert([
        {
          mood_avg: userStats.mood_avg,
          task_rate: userStats.task_rate,
          login_count: userStats.login_count,
          ai_risk_score: aiRiskScore,
          // user_actual_state: NULL — henüz kullanıcı yanıtlamadı
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[Burnout] Tahmin kayıt hatası:', error.message);
      return null;
    }

    console.log('[Burnout] Tahmin kaydedildi, id:', data.id);
    return data.id;
  } catch (err) {
    console.error('[Burnout] savePrediction hatası:', err.message);
    return null;
  }
};

/**
 * Kullanıcının geri bildirimini (Katılıyorum/Katılmıyorum) kaydeder.
 * @param {string} predictionId - Kaydedilen tahminin id'si
 * @param {0|1} state - 1: Katılıyorum (burnout var), 0: Katılmıyorum
 */
export const updateUserActualState = async (predictionId, state) => {
  try {
    const { error } = await supabase
      .from('ai_predictions')
      .update({ user_actual_state: state })
      .eq('id', predictionId);

    if (error) {
      console.error('[Burnout] Kullanıcı geri bildirim kayıt hatası:', error.message);
      return false;
    }

    console.log(`[Burnout] Kullanıcı geri bildirimi kaydedildi: ${state === 1 ? 'Katılıyorum' : 'Katılmıyorum'}`);
    return true;
  } catch (err) {
    console.error('[Burnout] updateUserActualState hatası:', err.message);
    return false;
  }
};
