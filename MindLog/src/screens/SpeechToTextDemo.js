/**
 * SpeechToTextDemo.js
 * ===========================
 * expo-speech-recognition kütüphanesi ile anlık ses-metin dönüşümü (Speech-to-Text) demo bileşeni.
 *
 * Özellikler:
 * - Tek butonla Başlat/Durdur toggle
 * - Anlık (interim) ve nihai (final) transkripsiyon gösterimi
 * - Pulse animasyonu ile dinleme durumu göstergesi
 * - Kapsamlı hata yönetimi (izin reddi, servis hatası vb.)
 * - useEffect cleanup ile kaynak temizliği
 * - Türkçe dil desteği (tr-TR)
 *
 * Kullanım:
 *   import SpeechToTextDemo from './src/screens/SpeechToTextDemo';
 *   export default function App() { return <SpeechToTextDemo />; }
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// ─── RENK PALETİ ────────────────────────────────────────────────────
const COLORS = {
  bg: '#0F0F1A',             // Koyu arkaplan
  surface: '#1A1A2E',        // Kart yüzeyi
  surfaceLight: '#252542',   // Hafif açık yüzey
  primary: '#6C63FF',        // Ana renk (mor)
  primaryDark: '#5A52D5',    // Koyu mor
  accent: '#FF6B6B',         // Vurgu (kırmızı - durdur)
  success: '#4ECDC4',        // Başarı (yeşil-turkuaz)
  textPrimary: '#EAEAEA',    // Ana metin
  textSecondary: '#8A8AA0',  // İkincil metin
  textMuted: '#5A5A7A',      // Sönük metin
  error: '#FF6B6B',          // Hata rengi
  errorBg: 'rgba(255,107,107,0.12)', // Hata arkaplanı
  border: '#2A2A4A',         // Kenarlık
  pulseOuter: 'rgba(108,99,255,0.15)',
  pulseMiddle: 'rgba(108,99,255,0.08)',
};

export default function SpeechToTextDemo() {
  // ─── STATE ───────────────────────────────────────────────────────
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(null); // null=bilinmiyor

  // ─── ANİMASYON REF'LERİ ──────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // ─── PULSE ANİMASYONU ─────────────────────────────────────────────
  useEffect(() => {
    let animation;
    if (recognizing) {
      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.6,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [recognizing, pulseAnim, pulseOpacity]);

  // ─── EXPO SPEECH RECOGNITION EVENT HOOK'LARI ──────────────────────
  // Dinleme başladığında
  useSpeechRecognitionEvent('start', () => {
    setRecognizing(true);
    setError(null);
    console.log('[SpeechToText] Dinleme başladı');
  });

  // Dinleme sona erdiğinde
  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    setPartialTranscript('');
    console.log('[SpeechToText] Dinleme sona erdi');
  });

  // Sonuç geldiğinde (final + interim)
  useSpeechRecognitionEvent('result', (event) => {
    const currentResult = event.results[0];
    if (currentResult) {
      if (event.isFinal) {
        // Nihai sonuç — transcript'e ekle
        setTranscript((prev) => {
          const separator = prev.length > 0 ? ' ' : '';
          return prev + separator + currentResult.transcript;
        });
        setPartialTranscript('');
      } else {
        // Ara (interim) sonuç — partialTranscript'e yaz
        setPartialTranscript(currentResult.transcript);
      }
    }
  });

  // Hata oluştuğunda
  useSpeechRecognitionEvent('error', (event) => {
    const errorMessages = {
      'not-allowed': 'Mikrofon izni reddedildi. Lütfen ayarlardan izin verin.',
      'no-speech': 'Konuşma algılanamadı. Lütfen tekrar deneyin.',
      'audio-capture': 'Mikrofona erişilemedi. Lütfen başka bir uygulamanın kullanmadığından emin olun.',
      'network': 'Ağ hatası. Lütfen internet bağlantınızı kontrol edin.',
      'service-not-allowed': 'Konuşma tanıma servisi kullanılamıyor.',
      'aborted': 'Dinleme iptal edildi.',
    };

    const friendlyMessage = errorMessages[event.error] || `Hata: ${event.error} — ${event.message}`;
    setError(friendlyMessage);
    setRecognizing(false);
    console.error('[SpeechToText] Hata:', event.error, event.message);
  });

  // ─── İZİN İSTEME ─────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermissionGranted(result.granted);
      if (!result.granted) {
        setError('Mikrofon izni verilmedi. Konuşma tanıma için mikrofon erişimi gereklidir.');
      }
      return result.granted;
    } catch (err) {
      console.error('[SpeechToText] İzin hatası:', err);
      setError('İzin kontrolü sırasında hata oluştu.');
      return false;
    }
  }, []);

  // ─── DİNLEMEYİ BAŞLAT ────────────────────────────────────────────
  const startListening = useCallback(async () => {
    // Buton animasyonu
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setError(null);

    // İzin kontrolü
    const granted = await requestPermission();
    if (!granted) return;

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'tr-TR',          // Türkçe
        interimResults: true,   // Anlık (kısmi) sonuçlar
        continuous: true,       // Sürekli dinleme (kullanıcı durdurana kadar)
        maxAlternatives: 1,
      });
    } catch (err) {
      console.error('[SpeechToText] Başlatma hatası:', err);
      setError('Dinleme başlatılamadı: ' + err.message);
    }
  }, [requestPermission, buttonScale]);

  // ─── DİNLEMEYİ DURDUR ────────────────────────────────────────────
  const stopListening = useCallback(() => {
    // Buton animasyonu
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error('[SpeechToText] Durdurma hatası:', err);
    }
  }, [buttonScale]);

  // ─── METNİ TEMİZLE ───────────────────────────────────────────────
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setPartialTranscript('');
    setError(null);
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* ── BAŞLIK ── */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎙️</Text>
        <Text style={styles.headerTitle}>Ses Tanıma Demo</Text>
        <Text style={styles.headerSubtitle}>
          expo-speech-recognition · Türkçe (tr-TR)
        </Text>
      </View>

      {/* ── DURUM GÖSTERGESI ── */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: recognizing ? COLORS.success : COLORS.textMuted },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: recognizing ? COLORS.success : COLORS.textSecondary },
          ]}
        >
          {recognizing ? 'Dinleniyor...' : 'Hazır'}
        </Text>
      </View>

      {/* ── MİKROFON BUTONU (PULSE ANİMASYONLU) ── */}
      <View style={styles.buttonWrapper}>
        {/* Pulse halkaları (sadece dinlerken görünür) */}
        {recognizing && (
          <>
            <Animated.View
              style={[
                styles.pulseRing,
                styles.pulseRingOuter,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRing,
                styles.pulseRingMiddle,
                {
                  transform: [
                    {
                      scale: Animated.multiply(pulseAnim, 0.75),
                    },
                  ],
                  opacity: Animated.multiply(pulseOpacity, 1.5),
                },
              ]}
            />
          </>
        )}

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[
              styles.micButton,
              recognizing ? styles.micButtonActive : styles.micButtonIdle,
            ]}
            onPress={recognizing ? stopListening : startListening}
            activeOpacity={0.8}
          >
            <Text style={styles.micButtonIcon}>
              {recognizing ? '⏹️' : '🎤'}
            </Text>
            <Text style={styles.micButtonText}>
              {recognizing ? 'Durdur' : 'Dinlemeyi Başlat'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── HATA MESAJI ── */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── TRANSKRİPSİYON ALANI ── */}
      <View style={styles.transcriptSection}>
        <View style={styles.transcriptHeader}>
          <Text style={styles.transcriptLabel}>Transkripsiyon</Text>
          {(transcript.length > 0 || partialTranscript.length > 0) && (
            <TouchableOpacity onPress={clearTranscript} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcript.length === 0 && partialTranscript.length === 0 ? (
            <Text style={styles.placeholderText}>
              Mikrofon butonuna basıp konuşmaya başlayın.{'\n'}
              Konuşmanız burada metin olarak görünecek.
            </Text>
          ) : (
            <>
              {/* Nihai metin */}
              {transcript.length > 0 && (
                <Text style={styles.transcriptText}>{transcript}</Text>
              )}
              {/* Anlık (interim) metin — soluk renkte */}
              {partialTranscript.length > 0 && (
                <Text style={styles.partialText}>
                  {transcript.length > 0 ? ' ' : ''}
                  {partialTranscript}
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* ── ALT BİLGİ ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {Platform.OS === 'android' ? 'Android' : 'iOS'} · expo-speech-recognition
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── STİLLER ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Başlık
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 48 : 16,
    paddingBottom: 8,
  },
  headerEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Durum göstergesi
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Mikrofon butonu
  buttonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    marginVertical: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  pulseRingOuter: {
    backgroundColor: COLORS.pulseOuter,
  },
  pulseRingMiddle: {
    backgroundColor: COLORS.pulseMiddle,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  micButtonIdle: {
    backgroundColor: COLORS.primary,
  },
  micButtonActive: {
    backgroundColor: COLORS.accent,
  },
  micButtonIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  micButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Hata mesajı
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorBg,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
  },

  // Transkripsiyon alanı
  transcriptSection: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  clearButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  transcriptScroll: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transcriptContent: {
    padding: 16,
    minHeight: 120,
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  transcriptText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
  },
  partialText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 26,
    fontStyle: 'italic',
  },

  // Alt bilgi
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
