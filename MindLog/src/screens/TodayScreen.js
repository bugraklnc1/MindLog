import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { supabase } from '../lib/supabase';
import { analyzeJournalEntry } from '../lib/gemini';
import { checkBurnoutRisk, updateUserActualState } from '../lib/burnout';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export default function TodayScreen() {
  const [habits, setHabits] = useState([]);
  const [completedHabits, setCompletedHabits] = useState({});
  const [journalText, setJournalText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Yeni state'ler - Mood ve AI
  const [moodScore, setMoodScore] = useState(0); // 0 = seçilmedi
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null); // AI sonucu

  // Streak state'leri
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [hasEntryToday, setHasEntryToday] = useState(false);

  // ==================== BURNOUT UYARI STATE'LERİ ====================
  const [burnoutRisk, setBurnoutRisk] = useState(null);
  const [burnoutChecking, setBurnoutChecking] = useState(false);
  const [burnoutDismissed, setBurnoutDismissed] = useState(false);
  const [burnoutPredictionId, setBurnoutPredictionId] = useState(null); // DB'ye kaydedilen satırın id'si
  const [burnoutFeedbackSent, setBurnoutFeedbackSent] = useState(false); // Kullanıcı g.bildirimi verdi mi
  // ===================================================================


  // ==================== SES TANIMA STATE'LERİ ====================
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  // ===============================================================

  // Habit ekleme modal
  const [addHabitModalVisible, setAddHabitModalVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('📌');
  const [addingHabit, setAddingHabit] = useState(false);

  // Emoji seçenekleri - kategorilere göre
  const emojiOptions = [
    // Spor & Sağlık
    '🏃', '💪', '🧘', '🚴', '🏋️', '⚽', '🎾', '🏊',
    // Beslenme & İçecek
    '💧', '🍎', '🥗', '☕', '🍵',
    // Üretkenlik & İş
    '💻', '📚', '✍️', '📝', '🎯', '💼', '📊',
    // Yaratıcılık & Hobiler
    '🎨', '🎵', '📷', '🎮', '🎬',
    // Kişisel Gelişim
    '🧠', '💭', '🙏', '😴', '🌅',
    // Sosyal & İletişim
    '👨‍👩‍👧', '💬', '📞', '❤️',
    // Diğer
    '🌿', '🐕', '🏠', '💰', '✈️', '📌',
  ];

  // Alışkanlıkları Supabase'den çek + burnout kontrolü yap
  useEffect(() => {
    fetchHabits();
    fetchStreakData();
    runBurnoutCheck();
  }, []);

  // ==================== BURNOUT KONTROL FONKSİYONU ====================
  const runBurnoutCheck = async () => {
    setBurnoutChecking(true);
    setBurnoutDismissed(false);
    setBurnoutFeedbackSent(false);
    setBurnoutPredictionId(null);
    try {
      const result = await checkBurnoutRisk();
      if (result && result.status === 'success') {
        setBurnoutRisk(result);
        // predictionId artık checkBurnoutRisk içinde kaydedilip döndürülüyor
        if (result.predictionId) {
          setBurnoutPredictionId(result.predictionId);
        }
      }
    } catch (error) {
      console.warn('[Burnout] Kontrol yapılamadı (sunucu kapalı olabilir):', error.message);
      setBurnoutRisk(null);
    } finally {
      setBurnoutChecking(false);
    }
  };

  // Kullanıcı geri bildirim handlerı
  const handleBurnoutFeedback = async (userState) => {
    setBurnoutFeedbackSent(true);
    if (burnoutPredictionId) {
      await updateUserActualState(burnoutPredictionId, userState);
    }
    // Kısa bir süre sonra kartı kapat
    setTimeout(() => setBurnoutDismissed(true), 1200);
  };
  // ===================================================================

  const fetchHabits = async () => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (error) {
        console.log('Supabase hatası:', error.message);
        setHabits([]);
      } else {
        // API'den gelen verileri uygun formata çevir
        const formattedHabits = (data || []).map(h => ({
          id: h.id,
          title: h.name || h.title,
          emoji: h.emoji || '📌',
        }));
        setHabits(formattedHabits);
      }
    } catch (err) {
      console.log('Bağlantı hatası:', err.message);
      setHabits([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== STREAK HESAPLAMA ====================

  // Saat dilimi sorunundan kaçınmak için her zaman YEREL takvim tarihini kullan.
  // toISOString() UTC döndürdüğü için UTC+3'te her tarih 1 gün geri gider — bu yüzden kullanmıyoruz.
  const toLocalDateStr = (dateInput) => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const calculateStreak = (dates) => {
    if (!dates || dates.length === 0) {
      return { currentStreak: 0, bestStreak: 0, hasEntryToday: false };
    }

    // Tarihleri yerel YYYY-MM-DD formatına çevir ve tekilleştir
    const uniqueDates = [...new Set(
      dates.map(d => toLocalDateStr(d))
    )].sort((a, b) => b.localeCompare(a)); // Büyükten küçüğe sırala

    const todayStr = toLocalDateStr(new Date());
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = toLocalDateStr(yesterdayObj);

    const entryToday = uniqueDates.includes(todayStr);

    // ---- Current Streak Hesaplama ----
    let current = 0;
    const latestDate = uniqueDates[0];

    // Son kayıt bugün veya dün değilse → seri kırılmış
    if (latestDate !== todayStr && latestDate !== yesterdayStr) {
      current = 0;
    } else {
      // Geriye doğru ardışık günleri say
      let checkDate = new Date(latestDate + 'T00:00:00');
      for (let i = 0; i < uniqueDates.length; i++) {
        const expectedStr = toLocalDateStr(checkDate); // toISOString yerine yerel tarih
        if (uniqueDates[i] === expectedStr) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // ---- Best Streak Hesaplama ----
    let best = 0;
    let tempStreak = 1;
    const sortedAsc = [...uniqueDates].sort((a, b) => a.localeCompare(b));

    for (let i = 1; i < sortedAsc.length; i++) {
      const prevDate = new Date(sortedAsc[i - 1] + 'T00:00:00');
      const currDate = new Date(sortedAsc[i] + 'T00:00:00');
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        tempStreak++;
      } else {
        best = Math.max(best, tempStreak);
        tempStreak = 1;
      }
    }
    best = Math.max(best, tempStreak);

    // Current da best olabilir
    best = Math.max(best, current);

    return { currentStreak: current, bestStreak: best, hasEntryToday: entryToday };
  };

  const fetchStreakData = async () => {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Streak veri hatası:', error.message);
        return;
      }

      const dates = (data || []).map(entry => entry.created_at);
      const result = calculateStreak(dates);

      setCurrentStreak(result.currentStreak);
      setBestStreak(result.bestStreak);
      setHasEntryToday(result.hasEntryToday);
    } catch (err) {
      console.log('Streak hesaplama hatası:', err.message);
    }
  };
  // ============================================================





  // ==================== SES TANIMA (SPEECH-TO-TEXT) ====================
  // Pulse animasyonu — dinlerken mikrofon butonu etrafında nabız efekti
  useEffect(() => {
    let animation;
    if (isListening) {
      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          ]),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }
    return () => { if (animation) animation.stop(); };
  }, [isListening, pulseAnim, pulseOpacity]);

  // Event: Dinleme başladı
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setVoiceError(null);
  });

  // Event: Dinleme sona erdi
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  // Event: Sonuç geldi → journalText'e ekle
  useSpeechRecognitionEvent('result', (event) => {
    const result = event.results[0];
    if (result && event.isFinal) {
      setJournalText((prev) => {
        const separator = prev.trim().length > 0 ? ' ' : '';
        return prev + separator + result.transcript;
      });
    }
  });

  // Event: Hata oluştu
  useSpeechRecognitionEvent('error', (event) => {
    const messages = {
      'not-allowed': 'Mikrofon izni reddedildi.',
      'no-speech': 'Konuşma algılanamadı.',
      'audio-capture': 'Mikrofona erişilemedi.',
      'network': 'Ağ hatası.',
    };
    setVoiceError(messages[event.error] || event.message);
    setIsListening(false);
    console.error('[Voice] Hata:', event.error, event.message);
  });

  // Dinlemeyi başlat
  const startListening = useCallback(async () => {
    setVoiceError(null);
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setVoiceError('Mikrofon izni verilmedi.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'tr-TR',
        interimResults: false,
        continuous: true,
        maxAlternatives: 1,
      });
    } catch (err) {
      setVoiceError('Dinleme başlatılamadı: ' + err.message);
    }
  }, []);

  // Dinlemeyi durdur
  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error('[Voice] Durdurma hatası:', err);
    }
  }, []);
  // ==================================================================

  // Yeni alışkanlık ekle
  const handleAddHabit = async () => {
    if (!newHabitName.trim()) {
      Alert.alert('Uyarı', 'Lütfen alışkanlık adı girin.');
      return;
    }

    setAddingHabit(true);
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert([
          {
            name: newHabitName.trim(),
            emoji: newHabitEmoji,
            is_active: true,
          },
        ])
        .select();

      if (error) {
        console.error('Habit ekleme hatası:', error);
        Alert.alert('Hata', 'Alışkanlık eklenemedi: ' + error.message);
      } else {
        console.log('Habit eklendi:', data);
        setNewHabitName('');
        setNewHabitEmoji('📌');
        setAddHabitModalVisible(false);
        fetchHabits(); // Listeyi yenile
      }
    } catch (err) {
      Alert.alert('Hata', 'Bir sorun oluştu: ' + err.message);
    } finally {
      setAddingHabit(false);
    }
  };

  // Alışkanlık sil
  const handleDeleteHabit = (habit) => {
    Alert.alert(
      'Alışkanlığı Sil',
      `"${habit.title}" alışkanlığını silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('habits')
                .delete()
                .eq('id', habit.id);

              if (error) {
                Alert.alert('Hata', 'Alışkanlık silinemedi: ' + error.message);
              } else {
                fetchHabits(); // Listeyi yenile
              }
            } catch (err) {
              Alert.alert('Hata', 'Bir sorun oluştu: ' + err.message);
            }
          },
        },
      ]
    );
  };

  // Alışkanlık tamamlama toggle
  const toggleHabit = (habitId) => {
    setCompletedHabits((prev) => ({
      ...prev,
      [habitId]: !prev[habitId],
    }));
  };

  // Günü bitir butonuna tıklandığında
  const handleFinishDay = () => {
    setModalVisible(true);
  };

  // AI ile mood tahmini yap
  const handleAiPredict = async () => {
    if (!journalText.trim()) {
      Alert.alert('Uyarı', 'AI analizi için önce günlük yazmanız gerekiyor.');
      return;
    }

    setAiAnalyzing(true);
    try {
      const result = await analyzeJournalEntry(journalText);
      setAiResult(result);
      setMoodScore(result.mood_score);
      console.log('AI Analiz sonucu:', result);
    } catch (error) {
      console.error('AI analiz hatası:', error);
      Alert.alert('Hata', 'AI analizi yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Veriyi Supabase'e kaydet
  const handleSave = async () => {
    setSaving(true);

    try {
      let finalMoodScore = moodScore;
      let finalSummary = 'Özet oluşturulmadı';

      // Adım 1: AI Analizi (özet ve aktiviteler için her zaman çalıştır)
      if (journalText.trim().length > 0) {
        // Eğer daha önce AI analizi yapılmadıysa veya metin değiştiyse
        if (!aiResult) {
          setAiAnalyzing(true);
          try {
            const result = await analyzeJournalEntry(journalText);
            setAiResult(result);

            // Eğer kullanıcı mood seçmediyse AI'dan al
            if (moodScore === 0) {
              finalMoodScore = result.mood_score;
            }
            finalSummary = result.summary;
          } catch (error) {
            console.error('AI analiz hatası:', error);
            finalSummary = 'AI analizi yapılamadı';
          } finally {
            setAiAnalyzing(false);
          }
        } else {
          // Daha önce analiz yapılmış, sonuçları kullan
          if (moodScore === 0) {
            finalMoodScore = aiResult.mood_score;
          }
          finalSummary = aiResult.summary;
        }
      }

      // Adım 2: Puan kararı - kullanıcı seçmediyse varsayılan 5
      if (finalMoodScore === 0) {
        finalMoodScore = 5;
      }

      let savedEntryId = null;

      // Adım 3: Entry oluştur
      if (journalText.trim().length > 0) {
        const { data: entryData, error: entryError } = await supabase
          .from('entries')
          .insert([
            {
              content: journalText.trim(),
              mood_score: finalMoodScore,
              ai_summary: finalSummary,
            },
          ])
          .select();

        if (entryError) {
          console.error('Entry kayıt hatası:', entryError);
          Alert.alert('Hata', 'Günlük kaydedilemedi: ' + entryError.message);
          setSaving(false);
          return;
        }

        if (entryData && entryData.length > 0) {
          savedEntryId = entryData[0].id;
          console.log('Entry başarıyla kaydedildi, ID:', savedEntryId);
        }
      }

      // Habit logs kaydet
      const completedHabitIds = Object.keys(completedHabits).filter(
        (id) => completedHabits[id]
      );

      if (completedHabitIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];

        const { data: existingLogs, error: fetchError } = await supabase
          .from('habit_logs')
          .select('habit_id')
          .eq('completed_at', today);

        if (fetchError) {
          console.error('Mevcut logları kontrol hatası:', fetchError);
        }

        const alreadyLoggedHabitIds = new Set(
          (existingLogs || []).map(log => log.habit_id)
        );

        const newHabitIds = completedHabitIds.filter(
          habitId => !alreadyLoggedHabitIds.has(habitId)
        );

        if (newHabitIds.length > 0) {
          const habitLogs = newHabitIds.map((habitId) => ({
            habit_id: habitId,
            completed_at: today,
          }));

          const { error: logsError } = await supabase
            .from('habit_logs')
            .insert(habitLogs);

          if (logsError) {
            console.error('Habit logs kayıt hatası:', logsError);
            Alert.alert('Hata', 'Alışkanlıklar kaydedilemedi: ' + logsError.message);
            setSaving(false);
            return;
          }
        }
      }

      // Başarılı - formu sıfırla
      setJournalText('');
      setCompletedHabits({});
      setMoodScore(0);
      setAiResult(null);
      setModalVisible(false);

      // Streak verisini güncelle
      fetchStreakData();
      setSaving(false);

      // Başarı mesajı
      Alert.alert(
        '✅ Kaydedildi!',
        `Puan: ${finalMoodScore}/10\n${finalSummary}`,
        [{ text: 'Tamam' }]
      );

    } catch (err) {
      console.error('Kaydetme hatası:', err);
      Alert.alert('Hata', 'Bir hata oluştu: ' + err.message);
      setSaving(false);
      setModalVisible(false);
    }
  };

  // Mood emoji ve renk
  const getMoodEmoji = (score) => {
    if (score === 0) return '❓';
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    if (score >= 2) return '😕';
    return '😔';
  };

  const getMoodColor = (score) => {
    if (score === 0) return '#adb5bd';
    if (score >= 8) return '#16a34a';
    if (score >= 6) return '#84cc16';
    if (score >= 4) return '#eab308';
    if (score >= 2) return '#f97316';
    return '#dc2626';
  };

  // Tamamlanan alışkanlık sayısı
  const completedCount = Object.values(completedHabits).filter(Boolean).length;

  // Alışkanlık kartı render
  const renderHabitItem = ({ item }) => {
    // Ekleme butonu için özel kart
    if (item.isAddButton) {
      return (
        <TouchableOpacity
          style={styles.addHabitCard}
          onPress={() => setAddHabitModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={32} color="#6366f1" />
          <Text style={styles.addHabitText}>Ekle</Text>
        </TouchableOpacity>
      );
    }

    const isCompleted = completedHabits[item.id];
    return (
      <TouchableOpacity
        style={[styles.habitCard, isCompleted && styles.habitCardCompleted]}
        onPress={() => toggleHabit(item.id)}
        onLongPress={() => handleDeleteHabit(item)}
        activeOpacity={0.7}
        delayLongPress={500}
      >
        <Text style={styles.habitEmoji}>{item.emoji}</Text>
        <Text style={[styles.habitTitle, isCompleted && styles.habitTitleCompleted]}>
          {item.title}
        </Text>
        <View style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}>
          {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  // Habits listesine ekleme butonunu ekle
  const habitsWithAddButton = [...habits, { id: 'add-button', isAddButton: true }];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bugün</Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert(
              'Çıkış Yap',
              'Oturumunuzu kapatmak istediğinize emin misiniz?',
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Çıkış Yap',
                  style: 'destructive',
                  onPress: () => supabase.auth.signOut(),
                },
              ]
            )
          }
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 🔥 Streak Kartı */}
        <View style={[styles.streakCard, currentStreak === 0 && styles.streakCardInactive]}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFireIcon}>
              {currentStreak > 0 ? '🔥' : '💤'}
            </Text>
            <View style={styles.streakInfo}>
              <Text style={[styles.streakText, currentStreak === 0 && styles.streakTextInactive]}>
                🔥 Seri: {currentStreak} Gün  |  🏆 Rekor: {bestStreak} Gün
              </Text>
              <Text style={[styles.streakMotivation, currentStreak === 0 && styles.streakMotivationInactive]}>
                {currentStreak === 0
                  ? 'Yeni bir seri başlatmak için günlüğünü yaz!'
                  : hasEntryToday
                    ? 'Harikasın! Ateş yanmaya devam ediyor 🔥'
                    : 'Seriyi bozmamak için bugün de günlüğünü yaz!'}
              </Text>
            </View>
          </View>
        </View>

        {/* 🚨 Burnout Uyarı Kartı */}
        {burnoutRisk && burnoutRisk.burnout_risk === 1 && !burnoutDismissed && (
          <View style={styles.burnoutCard}>
            <View style={styles.burnoutCardHeader}>
              <Text style={styles.burnoutTitle}>🚨 Tükenmişlik Uyarısı</Text>
              <TouchableOpacity
                onPress={() => setBurnoutDismissed(true)}
                style={styles.burnoutDismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.burnoutMessage}>
              Yapay Zeka son 14 günün verisini inceledi ve sende tükenmişlik belirtileri tespit etti.
            </Text>
            <Text style={styles.burnoutAdvice}>
              💡 Biraz mola vermeyi ve sevdiklerin ile zaman geçirmeyi düşünebilirsin.
            </Text>

            {/* Kullanıcı Geri Bildirimi */}
            {burnoutFeedbackSent ? (
              <Text style={styles.burnoutFeedbackThanks}>
                ✅ Geri bildiriminiz kaydedildi, teşekkürler!
              </Text>
            ) : (
              <View style={styles.burnoutFeedbackRow}>
                <Text style={styles.burnoutFeedbackLabel}>Bu tespite katılıyor musun?</Text>
                <View style={styles.burnoutFeedbackButtons}>
                  <TouchableOpacity
                    style={styles.burnoutFeedbackAgree}
                    onPress={() => handleBurnoutFeedback(1)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.burnoutFeedbackBtnText}>👍 Katılıyorum</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.burnoutFeedbackDisagree}
                    onPress={() => handleBurnoutFeedback(0)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.burnoutFeedbackBtnText}>👎 Katılmıyorum</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Üst Bölüm - Alışkanlıklar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alışkanlıklar</Text>
            <Text style={styles.sectionSubtitle}>
              {completedCount}/{habits.length} tamamlandı
            </Text>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          ) : habits.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyHabitsCard}
              onPress={() => setAddHabitModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={40} color="#6366f1" />
              <Text style={styles.emptyHabitsText}>İlk alışkanlığını ekle</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={habitsWithAddButton}
              renderItem={renderHabitItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.habitsList}
            />
          )}
        </View>

        {/* Orta Bölüm - Günlük Girişi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Günlük</Text>
          <View style={styles.journalContainer}>
            <TextInput
              style={styles.journalInput}
              placeholder="Günün nasıl geçti? Düşüncelerini, aktivitelerini ve duygularını yaz..."
              placeholderTextColor="#adb5bd"
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              value={journalText}
              onChangeText={setJournalText}
            />

          </View>
        </View>
      </ScrollView>

      {/* Alt Bölüm - Mikrofon ve Buton */}
      <View style={styles.bottomSection}>
        {/* Ses Tanıma Hata Mesajı */}
        {voiceError && (
          <View style={styles.voiceErrorContainer}>
            <Ionicons name="warning" size={14} color="#dc2626" />
            <Text style={styles.voiceErrorText}>{voiceError}</Text>
            <TouchableOpacity onPress={() => setVoiceError(null)}>
              <Ionicons name="close" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}

        {/* Mikrofon Butonu - Ses Tanıma */}
        <View style={styles.micContainer}>
          <Text style={styles.micLabel}>
            {isListening ? '🎙️ Dinleniyor...' : 'Sesli Günlük Kaydet'}
          </Text>

          <View style={styles.micButtonWrapper}>
            {/* Pulse halkaları — dinlerken görünür */}
            {isListening && (
              <Animated.View
                style={[
                  styles.micPulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
            )}

            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonListening,
              ]}
              onPress={isListening ? stopListening : startListening}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={36}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.micHint}>
            {isListening
              ? 'Konuşmanız metne dönüştürülüyor...'
              : 'Mikrofona bas ve konuş'}
          </Text>
        </View>

        {/* Günü Bitir Butonu - İkincil */}
        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinishDay}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
          <Text style={styles.finishButtonText}>Günü Bitir</Text>
        </TouchableOpacity>
      </View>

      {/* Modal - Mood Seçimi ve Kaydetme */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => !saving && !aiAnalyzing && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bugün nasıl hissettin?</Text>
              <TouchableOpacity
                onPress={() => !saving && !aiAnalyzing && setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6c757d" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Mood Göstergesi */}
              <View style={styles.moodDisplay}>
                <Text style={styles.moodEmoji}>{getMoodEmoji(moodScore)}</Text>
                <Text style={[styles.moodValue, { color: getMoodColor(moodScore) }]}>
                  {moodScore === 0 ? '-' : moodScore}/10
                </Text>
                <Text style={styles.moodHint}>
                  {moodScore === 0 ? 'Slider ile seç veya AI tahmin etsin' :
                    moodScore >= 8 ? 'Harika!' :
                      moodScore >= 6 ? 'İyi' :
                        moodScore >= 4 ? 'Orta' : 'Düşük'}
                </Text>
              </View>

              {/* Slider */}
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>1</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={moodScore || 5}
                  onValueChange={(value) => setMoodScore(value)}
                  minimumTrackTintColor={getMoodColor(moodScore || 5)}
                  maximumTrackTintColor="#e9ecef"
                  thumbTintColor={getMoodColor(moodScore || 5)}
                />
                <Text style={styles.sliderLabel}>10</Text>
              </View>

              {/* AI Tahmin Butonu */}
              <TouchableOpacity
                style={[styles.aiPredictButton, aiAnalyzing && styles.aiPredictButtonDisabled]}
                onPress={handleAiPredict}
                disabled={aiAnalyzing || !journalText.trim()}
                activeOpacity={0.7}
              >
                {aiAnalyzing ? (
                  <>
                    <ActivityIndicator size="small" color="#6366f1" />
                    <Text style={styles.aiPredictText}>AI Analiz Ediyor...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#6366f1" />
                    <Text style={styles.aiPredictText}>✨ AI Tahmin Et</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* AI Sonucu (varsa) */}
              {aiResult && (
                <View style={styles.aiResultContainer}>
                  <Text style={styles.aiResultTitle}>AI Analizi:</Text>
                  <Text style={styles.aiResultText}>📝 {aiResult.summary}</Text>
                </View>
              )}

              {/* Özet Bilgiler */}
              <View style={styles.summarySection}>
                <View style={styles.summaryItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4caf50" />
                  <Text style={styles.summaryText}>
                    {completedCount} alışkanlık tamamlandı
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="document-text" size={18} color="#6366f1" />
                  <Text style={styles.summaryText}>
                    {journalText.trim().length > 0
                      ? `${journalText.trim().length} karakter günlük`
                      : 'Günlük yazılmadı'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Aksiyon Butonları - ScrollView dışında sabit */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setMoodScore(0);
                  setAiResult(null);
                  setModalVisible(false);
                }}
                disabled={saving || aiAnalyzing}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, (saving || aiAnalyzing) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || aiAnalyzing}
                activeOpacity={0.8}
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.saveButtonText}>Kaydediliyor...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Habit Ekleme Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addHabitModalVisible}
        onRequestClose={() => !addingHabit && setAddHabitModalVisible(false)}
      >
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalContent}>
            <Text style={styles.addModalTitle}>Yeni Alışkanlık</Text>

            {/* Emoji Seçici */}
            <Text style={styles.addModalLabel}>Emoji Seç</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.emojiScrollView}
            >
              {emojiOptions.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.emojiOption,
                    newHabitEmoji === emoji && styles.emojiOptionSelected,
                  ]}
                  onPress={() => setNewHabitEmoji(emoji)}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* İsim Girişi */}
            <Text style={styles.addModalLabel}>Alışkanlık Adı</Text>
            <TextInput
              style={styles.addModalInput}
              placeholder="örn: Kitap Oku"
              placeholderTextColor="#adb5bd"
              value={newHabitName}
              onChangeText={setNewHabitName}
              autoFocus
            />

            {/* Butonlar */}
            <View style={styles.addModalActions}>
              <TouchableOpacity
                style={styles.addModalCancelButton}
                onPress={() => {
                  setNewHabitName('');
                  setNewHabitEmoji('📌');
                  setAddHabitModalVisible(false);
                }}
                disabled={addingHabit}
              >
                <Text style={styles.addModalCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalSaveButton, addingHabit && styles.saveButtonDisabled]}
                onPress={handleAddHabit}
                disabled={addingHabit}
              >
                {addingHabit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addModalSaveText}>Ekle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerDate: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6c757d',
    paddingVertical: 20,
  },
  habitsList: {
    paddingRight: 20,
  },
  habitCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  habitCardCompleted: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  addHabitCard: {
    backgroundColor: '#f0f0ff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  addHabitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 4,
  },
  emptyHabitsCard: {
    backgroundColor: '#f0f0ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  emptyHabitsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 8,
  },
  habitEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  habitTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
    textAlign: 'center',
    marginBottom: 8,
  },
  habitTitleCompleted: {
    color: '#2e7d32',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dee2e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  journalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  journalInput: {
    fontSize: 16,
    color: '#212529',
    minHeight: 180,
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  micContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  micLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 10,
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 90,
  },
  micPulseRing: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  micButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 9,
    elevation: 6,
  },
  micButtonListening: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  micHint: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
  },
  voiceErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  voiceErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  finishButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mood Display
  moodDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  moodEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  moodValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  moodHint: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  // Slider
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    width: 24,
    textAlign: 'center',
  },
  // AI Predict Button
  aiPredictButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0ff',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  aiPredictButtonDisabled: {
    opacity: 0.6,
  },
  aiPredictText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 8,
  },
  // AI Result
  aiResultContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  aiResultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 6,
  },
  aiResultText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 4,
  },
  // Summary Section
  summarySection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#495057',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  // Add Habit Modal Styles
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  addModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 20,
  },
  addModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  emojiScrollView: {
    marginBottom: 16,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    backgroundColor: '#e8f0fe',
    borderColor: '#6366f1',
  },
  emojiOptionText: {
    fontSize: 24,
  },
  addModalInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#212529',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  addModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
  },
  addModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  addModalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  addModalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // ==================== STREAK STYLES ====================
  streakCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: '#FFF4EC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  streakCardInactive: {
    backgroundColor: '#F1F3F5',
    borderColor: '#CED4DA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFireIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D84315',
    marginBottom: 4,
  },
  streakTextInactive: {
    color: '#868E96',
  },
  streakMotivation: {
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
    opacity: 0.85,
  },
  streakMotivationInactive: {
    color: '#ADB5BD',
  },



  // ==================== BURNOUT KART STİLLERİ ====================
  burnoutCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    padding: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  burnoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  burnoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  burnoutDismiss: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  burnoutMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 19,
    marginBottom: 12,
  },
  burnoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  burnoutStat: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  burnoutCertainty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  burnoutAdvice: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  burnoutFeedbackRow: {
    marginTop: 4,
  },
  burnoutFeedbackLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  burnoutFeedbackButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  burnoutFeedbackAgree: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  burnoutFeedbackDisagree: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  burnoutFeedbackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  burnoutFeedbackThanks: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  // ==============================================================
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0f8',
  },
});
